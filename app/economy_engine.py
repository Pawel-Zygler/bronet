import asyncio
import hashlib
import json
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.database import (
    BLOCKCHAIN_LOCK,
    get_connection,
    update_cached_balances,
)

logger = logging.getLogger("bronet.economy_engine")


class ChlopchainEconomySimulator:
    """
    Automatyczny silnik ruchu ekonomii Chłopocoinów.
    - Generuje od 1 do 5 transakcji na sekundę między losowymi profilami.
    - Każdego dnia angażuje 60% aktywnej puli profili w pomoc i wybijanie coinów.
    - Kolejnego dnia angażuje 60% z pozostałej puli, aż do jej pełnego wyczerpania.
    - Po wyczerpaniu puli cykl resetuje się i rozpoczyna od nowa.
    - Każda transakcja tworzy kryptograficzny blok w sieci Chłopchain (SHA-256)
      i przyznaje po +1 CC obu uczestnikom.
    """

    def __init__(self) -> None:
        self._is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._min_tps: int = 1
        self._max_tps: int = 5
        self._interval_seconds: float = 1.0
        self._daily_pool_pct: int = 60
        self._last_tick_time: Optional[str] = None
        self._last_tick_count: int = 0
        self._total_simulated: int = 0
        self._lock = asyncio.Lock()

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _load_state(self, conn) -> Dict[str, Any]:
        cur = conn.cursor()
        rows = cur.execute("SELECT key, value FROM economy_simulator_state").fetchall()
        data = {r["key"]: r["value"] for r in rows}

        cycle = int(data.get("cycle_number", 1))
        day = int(data.get("day_in_cycle", 1))
        total_tx = int(data.get("total_simulated_transactions", 0))

        if "config_min_tps" in data:
            try:
                self._min_tps = max(1, int(data["config_min_tps"]))
            except Exception:
                pass
        if "config_max_tps" in data:
            try:
                self._max_tps = max(self._min_tps, int(data["config_max_tps"]))
            except Exception:
                pass
        if "config_interval_seconds" in data:
            try:
                self._interval_seconds = max(0.05, float(data["config_interval_seconds"]))
            except Exception:
                pass
        if "config_daily_pool_pct" in data:
            try:
                self._daily_pool_pct = max(5, min(95, int(data["config_daily_pool_pct"])))
            except Exception:
                pass

        try:
            served_cycle = set(json.loads(data.get("served_in_cycle_ids", "[]")))
        except Exception:
            served_cycle = set()

        try:
            served_today = set(json.loads(data.get("served_today_ids", "[]")))
        except Exception:
            served_today = set()

        return {
            "cycle_number": cycle,
            "day_in_cycle": day,
            "served_in_cycle_ids": served_cycle,
            "served_today_ids": served_today,
            "total_simulated_transactions": total_tx,
        }

    def _save_config(self, conn) -> None:
        state_records = [
            ("config_min_tps", str(self._min_tps)),
            ("config_max_tps", str(self._max_tps)),
            ("config_interval_seconds", str(self._interval_seconds)),
            ("config_daily_pool_pct", str(self._daily_pool_pct)),
            ("config_is_running", "true" if self._is_running else "false"),
        ]
        conn.executemany(
            """
            INSERT INTO economy_simulator_state (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            state_records,
        )

    def _save_state(
        self,
        conn,
        cycle_number: int,
        day_in_cycle: int,
        served_in_cycle: Set[int],
        served_today: Set[int],
        total_tx: int,
    ) -> None:
        state_records = [
            ("cycle_number", str(cycle_number)),
            ("day_in_cycle", str(day_in_cycle)),
            ("served_in_cycle_ids", json.dumps(list(served_in_cycle))),
            ("served_today_ids", json.dumps(list(served_today))),
            ("total_simulated_transactions", str(total_tx)),
            ("config_min_tps", str(self._min_tps)),
            ("config_max_tps", str(self._max_tps)),
            ("config_interval_seconds", str(self._interval_seconds)),
            ("config_daily_pool_pct", str(self._daily_pool_pct)),
            ("config_is_running", "true" if self._is_running else "false"),
        ]
        conn.executemany(
            """
            INSERT INTO economy_simulator_state (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            state_records,
        )

    def tick(self, custom_count: Optional[int] = None) -> Dict[str, Any]:
        """
        Pojedynczy cykl silnika ekonomicznego:
        Wybiera losowo transakcje (1-5 lub skonfigurowany zakres TPS) i realizuje wzajemną pomoc między profilami.
        """
        low = min(self._min_tps, self._max_tps)
        high = max(self._min_tps, self._max_tps)
        num_transactions = (
            custom_count if custom_count is not None else random.randint(low, high)
        )
        conn = get_connection()
        minted_blocks: List[Dict[str, Any]] = []

        try:
            with conn:
                # 1. Pobierz wszystkie dostępne identyfikatory profili męskich
                all_ids_rows = conn.execute(
                    "SELECT id FROM profiles ORDER BY id ASC"
                ).fetchall()
                all_ids = [r["id"] for r in all_ids_rows]

                if len(all_ids) < 2:
                    return {
                        "transactions_count": 0,
                        "status": "not_enough_profiles",
                    }

                # 2. Wczytaj obecny stan cyklu i puli
                state = self._load_state(conn)
                cycle_num = state["cycle_number"]
                day_num = state["day_in_cycle"]
                served_in_cycle = state["served_in_cycle_ids"]
                served_today = state["served_today_ids"]
                total_tx = state["total_simulated_transactions"]

                # Pula profili, które nie pomagały jeszcze w tym cyklu
                unserved = [pid for pid in all_ids if pid not in served_in_cycle]

                # Jeśli cała pula została wyczerpana (< 4 profili zostało), resetuj cykl i zacznij Dzień 1 od nowa
                if len(unserved) < 4:
                    cycle_num += 1
                    day_num = 1
                    served_in_cycle = set()
                    served_today = set()
                    unserved = list(all_ids)

                # Cel na dany dzień: daily_pool_pct (domyślnie 60%) z aktualnie pozostałej puli
                target_ratio = max(0.05, min(0.95, self._daily_pool_pct / 100.0))
                daily_target = max(2, int(round(len(unserved) * target_ratio)))

                # 3. Wykonaj zaplanowane transakcje
                for _ in range(num_transactions):
                    # Sprawdź, czy dzisiejsza pula została zrealizowana
                    if len(served_today) >= daily_target:
                        day_num += 1
                        served_today = set()
                        unserved = [
                            pid for pid in all_ids if pid not in served_in_cycle
                        ]
                        if len(unserved) < 4:
                            cycle_num += 1
                            day_num = 1
                            served_in_cycle = set()
                            unserved = list(all_ids)
                        daily_target = max(2, int(round(len(unserved) * target_ratio)))

                    if not unserved:
                        break

                    # Wybierz Chłopa A z puli nieobsłużonych dzisiaj
                    p_a = random.choice(unserved)

                    # Wybierz Chłopa B (najlepiej z nieobsłużonych, lub ogólnej puli)
                    candidate_pool = [
                        pid for pid in unserved if pid != p_a
                    ] or [pid for pid in all_ids if pid != p_a]
                    if not candidate_pool:
                        break

                    # Spróbuj znaleźć partnera, z którym jeszcze nie ma rozliczonego bloku
                    p_b = None
                    random.shuffle(candidate_pool)
                    for candidate in candidate_pool[:10]:
                        p1, p2 = min(p_a, candidate), max(p_a, candidate)
                        has_block = conn.execute(
                            "SELECT 1 FROM chlopocoin_blocks WHERE profile_a_id = ? AND profile_b_id = ?",
                            (p1, p2),
                        ).fetchone()
                        if not has_block:
                            p_b = candidate
                            break

                    if not p_b:
                        # Jeśli z pierwszymi 10 nie wyszło, weź pierwszego z ogólnej puli
                        p_b = candidate_pool[0]

                    p1, p2 = min(p_a, p_b), max(p_a, p_b)
                    now_str = self._now_iso()

                    # Sprawdź ponownie istnienie bloku (ochrona przed UNIQUE)
                    existing_block = conn.execute(
                        "SELECT id FROM chlopocoin_blocks WHERE profile_a_id = ? AND profile_b_id = ?",
                        (p1, p2),
                    ).fetchone()

                    if existing_block:
                        # Para już ma blok, oznacz jako obsłużonych i przejdź dalej
                        served_today.add(p_a)
                        served_in_cycle.add(p_a)
                        if p_a in unserved:
                            unserved.remove(p_a)
                        continue

                    # Zapisz potwierdzenia w obu kierunkach (konsensus 2/2)
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (p1, p2, now_str),
                    )
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (p2, p1, now_str),
                    )

                    # Pobierz ostatni blok i wybij nowy blok pod zamkiem łańcucha
                    with BLOCKCHAIN_LOCK:
                        last_block = conn.execute(
                            "SELECT block_index, block_hash FROM chlopocoin_blocks ORDER BY block_index DESC LIMIT 1"
                        ).fetchone()
                        prev_hash = (
                            last_block["block_hash"] if last_block else "0" * 64
                        )
                        block_index = (
                            (last_block["block_index"] + 1) if last_block else 1
                        )

                        # Wylicz poprawny kryptograficzny hasz SHA-256 bloku
                        payload = f"{block_index}:{prev_hash}:{p1}:{p2}:{now_str}:proof_of_chlop_help"
                        block_hash = hashlib.sha256(
                            payload.encode("utf-8")
                        ).hexdigest()

                        # Pobierz imiona obu chłopów do trwałej księgi bloku
                        r1 = conn.execute("SELECT name FROM profiles WHERE id = ?", (p1,)).fetchone()
                        r2 = conn.execute("SELECT name FROM profiles WHERE id = ?", (p2,)).fetchone()
                        p1_name = r1["name"] if r1 else f"Chłop #{p1}"
                        p2_name = r2["name"] if r2 else f"Chłop #{p2}"

                        # Wstaw nowy blok do łańcucha
                        conn.execute(
                            """
                            INSERT INTO chlopocoin_blocks (block_index, profile_a_id, profile_b_id, profile_a_name, profile_b_name, block_hash, prev_hash, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (block_index, p1, p2, p1_name, p2_name, block_hash, prev_hash, now_str),
                        )

                        # Przyznaj po 1 Chłopocoinie dla obu profili
                        conn.execute(
                            "UPDATE profiles SET chlopocoin_balance = chlopocoin_balance + 1 WHERE id IN (?, ?)",
                            (p1, p2),
                        )

                    # Zaktualizuj stan puli
                    served_today.add(p_a)
                    served_today.add(p_b)
                    served_in_cycle.add(p_a)
                    served_in_cycle.add(p_b)
                    if p_a in unserved:
                        unserved.remove(p_a)
                    if p_b in unserved:
                        unserved.remove(p_b)

                    total_tx += 1
                    minted_blocks.append(
                        {
                            "block_index": block_index,
                            "profile_a_id": p1,
                            "profile_b_id": p2,
                            "block_hash": block_hash,
                        }
                    )

                # Zapisz zaktualizowany stan silnika
                self._save_state(
                    conn,
                    cycle_num,
                    day_num,
                    served_in_cycle,
                    served_today,
                    total_tx,
                )

                # Zaktualizuj saldo w pamięci podręcznej dla uczestników transakcji
                affected_pids = []
                for mb in minted_blocks:
                    affected_pids.extend([mb["profile_a_id"], mb["profile_b_id"]])
                if affected_pids:
                    update_cached_balances(affected_pids)

            self._last_tick_time = self._now_iso()
            self._last_tick_count = len(minted_blocks)
            self._total_simulated = total_tx

            return {
                "transactions_count": len(minted_blocks),
                "cycle_number": cycle_num,
                "day_in_cycle": day_num,
                "served_today_count": len(served_today),
                "daily_target_60_pct": daily_target,
                "daily_target": daily_target,
                "daily_pool_pct": self._daily_pool_pct,
                "remaining_pool_count": len(unserved),
                "minted_blocks": minted_blocks,
            }

        except Exception as err:
            logger.exception("Błąd w trakcie ticku symulatora ekonomii: %s", err)
            return {"error": str(err), "transactions_count": 0}
        finally:
            conn.close()

    def get_status(self) -> Dict[str, Any]:
        """Zwraca bieżący stan i parametry konfiguracyjne silnika symulacji gospodarki Chłopocoinów."""
        conn = get_connection()
        try:
            all_ids_cnt = conn.execute(
                "SELECT COUNT(*) AS c FROM profiles"
            ).fetchone()["c"]
            state = self._load_state(conn)

            cycle_num = state["cycle_number"]
            day_num = state["day_in_cycle"]
            served_in_cycle_cnt = len(state["served_in_cycle_ids"])
            served_today_cnt = len(state["served_today_ids"])
            total_tx = state["total_simulated_transactions"]

            unserved_cnt = max(0, all_ids_cnt - served_in_cycle_cnt)
            target_ratio = max(0.05, min(0.95, self._daily_pool_pct / 100.0))
            daily_target = max(2, int(round(unserved_cnt * target_ratio)))
            progress_pct = (
                min(100.0, round((served_today_cnt / max(1, daily_target)) * 100, 1))
                if daily_target > 0
                else 100.0
            )

            return {
                "is_running": self._is_running,
                "min_tps": self._min_tps,
                "max_tps": self._max_tps,
                "interval_seconds": self._interval_seconds,
                "daily_pool_pct": self._daily_pool_pct,
                "tps_range": f"{self._min_tps}-{self._max_tps} TPS",
                "current_cycle": cycle_num,
                "current_day": day_num,
                "daily_pool_initial": unserved_cnt + served_today_cnt,
                "daily_target_60_pct": daily_target,
                "daily_target": daily_target,
                "daily_served_count": served_today_cnt,
                "daily_progress_pct": progress_pct,
                "remaining_pool_count": unserved_cnt,
                "total_profiles_count": all_ids_cnt,
                "total_simulated_transactions": total_tx,
                "last_tick_time": self._last_tick_time,
                "last_tick_transactions": self._last_tick_count,
            }
        finally:
            conn.close()

    async def update_config(
        self,
        min_tps: Optional[int] = None,
        max_tps: Optional[int] = None,
        interval_seconds: Optional[float] = None,
        daily_pool_pct: Optional[int] = None,
        is_running: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Aktualizuje parametry pracy silnika ekonomii i trwale zapisuje je w bazie danych."""
        if min_tps is not None:
            self._min_tps = max(1, min(100, int(min_tps)))
        if max_tps is not None:
            self._max_tps = max(self._min_tps, min(200, int(max_tps)))
        if interval_seconds is not None:
            self._interval_seconds = max(0.05, min(10.0, float(interval_seconds)))
        if daily_pool_pct is not None:
            self._daily_pool_pct = max(5, min(95, int(daily_pool_pct)))

        if is_running is not None:
            if is_running and not self._is_running:
                await self.start()
            elif not is_running and self._is_running:
                self.stop()

        conn = get_connection()
        try:
            with conn:
                self._save_config(conn)
        finally:
            conn.close()

        return self.get_status()

    def reset_cycle(self) -> Dict[str, Any]:
        """Resetuje stan cyklu symulatora ekonomii do Dnia 1 i czyści listy obsłużonych."""
        conn = get_connection()
        try:
            with conn:
                state_records = [
                    ("cycle_number", "1"),
                    ("day_in_cycle", "1"),
                    ("served_in_cycle_ids", "[]"),
                    ("served_today_ids", "[]"),
                ]
                conn.executemany(
                    """
                    INSERT INTO economy_simulator_state (key, value)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    """,
                    state_records,
                )
            return self.get_status()
        finally:
            conn.close()

    async def toggle_running(self) -> Dict[str, Any]:
        """Włącza lub zatrzymuje pętlę symulatora."""
        if self._is_running:
            self.stop()
        else:
            await self.start()

        conn = get_connection()
        try:
            with conn:
                self._save_config(conn)
        finally:
            conn.close()

        return self.get_status()

    async def _run_loop(self) -> None:
        """Pętla asynchroniczna pracująca w tle — generuje transakcje zgodnie z konfiguracją."""
        logger.info("Chłopchain Economy Simulator wystartował pomyślnie.")
        while self._is_running:
            try:
                base_interval = max(0.05, self._interval_seconds)
                sleep_min = max(0.05, base_interval * 0.8)
                sleep_max = max(sleep_min, base_interval * 1.2)
                sleep_duration = random.uniform(sleep_min, sleep_max)
                await asyncio.sleep(sleep_duration)

                if not self._is_running:
                    break

                # Wykonaj transakcje w wątku roboczym
                await asyncio.to_thread(self.tick)
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Błąd w pętli symulatora ekonomii: %s", err)
                await asyncio.sleep(1.0)

        logger.info("Chłopchain Economy Simulator został zatrzymany.")

    async def start(self) -> None:
        """Uruchamia pętlę symulatora w tle."""
        async with self._lock:
            if self._is_running:
                return
            conn = get_connection()
            try:
                self._load_state(conn)
            finally:
                conn.close()
            self._is_running = True
            self._task = asyncio.create_task(self._run_loop())

    def stop(self) -> None:
        """Zatrzymuje pętlę symulatora."""
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None


# Globalna instancja silnika ekonomii
economy_simulator = ChlopchainEconomySimulator()

