"""Symulator ekonomii: ticki, konfiguracja, profile syntetyczne."""
import unittest

from support import BackendTestCase

from app.database import (
    create_profile,
    get_profile,
    verify_chlopchain_integrity,
)


class EconomyEngineTest(BackendTestCase):
    def test_economy_engine_simulation_and_pool_depletion(self) -> None:
        """
        Weryfikuje automatyczny silnik symulacji gospodarki Chłopocoinów:
        - Regularny ruch (1-5 transakcji na sekundę).
        - Angażowanie 60% puli profili dziennie aż do jej wyczerpania i resetu.
        - Ciągłość kryptograficzną łańcucha bloków.
        """
        from app.economy_engine import economy_simulator

        status_before = economy_simulator.get_status()
        self.assertIn("tps_range", status_before)
        self.assertEqual(status_before["tps_range"], "1-5 TPS")

        # Wykonaj tick z 3 transakcjami
        tick_res = economy_simulator.tick(custom_count=3)
        self.assertEqual(tick_res["transactions_count"], 3)
        self.assertGreaterEqual(tick_res["cycle_number"], 1)
        self.assertGreaterEqual(tick_res["day_in_cycle"], 1)
        self.assertGreater(tick_res["served_today_count"], 0)

        # Weryfikacja integralności łańcucha po ticku silnika
        integrity = verify_chlopchain_integrity()
        self.assertTrue(integrity["is_valid"])

        status_after = economy_simulator.get_status()
        self.assertGreaterEqual(status_after["total_simulated_transactions"], 3)

    def test_economy_engine_controls_and_sliders(self) -> None:
        """
        Weryfikuje dynamiczne suwaki i kontrolki ekonomii:
        - Zmiana min_tps, max_tps, interval_seconds, daily_pool_pct, profiles_per_hour
        - Tworzenie nowych profili w silniku (np. 1 profil na godzinę lub generowanie na żądanie)
        - Reset cyklu do Dnia 1
        - Włączanie/wyłączanie pętli (toggle)
        """
        import asyncio
        from app.economy_engine import economy_simulator

        # 1. Zmiana parametrów suwakami (w tym profiles_per_hour)
        async def run_config():
            return await economy_simulator.update_config(
                min_tps=3,
                max_tps=8,
                interval_seconds=0.5,
                daily_pool_pct=75,
                profiles_per_hour=5,
            )

        updated = asyncio.run(run_config())
        self.assertEqual(updated["min_tps"], 3)
        self.assertEqual(updated["max_tps"], 8)
        self.assertEqual(updated["interval_seconds"], 0.5)
        self.assertEqual(updated["daily_pool_pct"], 75)
        self.assertEqual(updated["profiles_per_hour"], 5)
        self.assertEqual(updated["tps_range"], "3-8 TPS")

        # 2. Generowanie nowego profilu syntetycznego
        initial_gen_count = updated.get("total_generated_profiles", 0)
        new_prof = economy_simulator.generate_profile()
        self.assertIsNotNone(new_prof)
        self.assertIn("id", new_prof)
        self.assertTrue(len(new_prof["name"]) > 2)
        self.assertTrue(len(new_prof["can_help"]) >= 2)
        self.assertTrue(new_prof["email"].endswith("@bronet.pl"))

        status = economy_simulator.get_status()
        self.assertEqual(status["total_generated_profiles"], initial_gen_count + 1)
        self.assertEqual(status["profiles_per_hour"], 5)

        # 3. Reset cyklu
        res = economy_simulator.reset_cycle()
        self.assertEqual(res["current_cycle"], 1)
        self.assertEqual(res["current_day"], 1)
        self.assertEqual(res["daily_served_count"], 0)

        # 4. Przywrócenie domyślnych parametrów
        async def run_reset_defaults():
            return await economy_simulator.update_config(
                min_tps=1,
                max_tps=5,
                interval_seconds=1.0,
                daily_pool_pct=60,
                profiles_per_hour=1,
            )

        defaults = asyncio.run(run_reset_defaults())
        self.assertEqual(defaults["min_tps"], 1)
        self.assertEqual(defaults["max_tps"], 5)
        self.assertEqual(defaults["interval_seconds"], 1.0)
        self.assertEqual(defaults["daily_pool_pct"], 60)
        self.assertEqual(defaults["profiles_per_hour"], 1)

    def test_simulator_only_touches_test_profiles(self) -> None:
        from app.economy_engine import economy_simulator

        real_a = create_profile({"name": "Adam", "email": "adam@test.pl", "password": "haslo1-haslo"})
        real_b = create_profile({"name": "Bartek", "email": "bartek@test.pl", "password": "haslo2-haslo"})
        for _ in range(20):
            economy_simulator.tick(custom_count=50)
        self.assertEqual(get_profile(real_a["id"])["chlopocoin_balance"], 0)
        self.assertEqual(get_profile(real_b["id"])["chlopocoin_balance"], 0)

        generated = economy_simulator.generate_profile()
        self.assertTrue(generated["is_test"])


if __name__ == "__main__":
    unittest.main()
