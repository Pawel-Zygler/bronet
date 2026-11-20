"""Chłopchain: konsensus 2/2, bloki, statystyki i rankingi."""
import unittest

from support import BackendTestCase

from app.database import (
    ProfileValidationError,
    confirm_chlop_help,
    create_profile,
    get_chlopocoin_rankings,
    get_chlopocoin_stats,
    get_chlopocoin_status,
    get_global_chlopocoin_stats,
    get_profile,
)


class ChlopchainTest(BackendTestCase):
    def test_chlopocoin_blockchain_consensus(self) -> None:
        """
        Weryfikuje rozdział 1.7:
        - Obaj chłopi potwierdzają pomoc.
        - Po pierwszym potwierdzeniu status jest 'pending' (1/2).
        - Po drugim potwierdzeniu następuje konsensus 2/2, wybicie bloku i przyznanie po +1 Chłopocoinie.
        - Statystyki profilu prezentują bilans, liczbę wymian i księgę bloków.
        """
        chlop_a = create_profile(
            {
                "name": "Wojtek",
                "email": "wojtek.chlopocoin@bronet.test",
                "password": "pw_a-haslo",
                "can_help": ["hydraulik"],
                "need_help": ["mechanik"],
            }
        )
        chlop_b = create_profile(
            {
                "name": "Kazik",
                "email": "kazik.chlopocoin@bronet.test",
                "password": "pw_b-haslo",
                "can_help": ["mechanik"],
                "need_help": ["hydraulik"],
            }
        )

        # 1. Próba potwierdzenia samemu sobie jest odrzucana
        with self.assertRaises(ProfileValidationError):
            confirm_chlop_help(chlop_a["id"], chlop_a["id"], "pw_a-haslo")

        # 2. Wojtek (A) potwierdza Kazika (B) -> 1/2 potwierdzenia
        res1 = confirm_chlop_help(chlop_a["id"], chlop_b["id"], "pw_a-haslo")
        self.assertEqual(res1["status"], "pending")
        self.assertFalse(res1["mutual_settled"])
        self.assertEqual(res1["chlopocoin_balance"], 0)

        # Sprawdzenie statusu z perspektywy obu chłopów
        status_a = get_chlopocoin_status(chlop_a["id"], chlop_b["id"])
        self.assertTrue(status_a["confirmed_by_me"])
        self.assertFalse(status_a["confirmed_by_them"])
        self.assertFalse(status_a["mutual_settled"])

        status_b = get_chlopocoin_status(chlop_b["id"], chlop_a["id"])
        self.assertFalse(status_b["confirmed_by_me"])
        self.assertTrue(status_b["confirmed_by_them"])
        self.assertFalse(status_b["mutual_settled"])

        # 3. Kazik (B) potwierdza Wojtka (A) -> KONSENSUS 2/2 OSIĄGNIĘTY!
        res2 = confirm_chlop_help(chlop_b["id"], chlop_a["id"], "pw_b-haslo")
        self.assertEqual(res2["status"], "minted")
        self.assertTrue(res2["mutual_settled"])
        self.assertGreaterEqual(res2["block_index"], 1)
        self.assertEqual(len(res2["block_hash"]), 64)
        self.assertEqual(res2["chlopocoin_balance"], 1)

        # 4. Sprawdzenie stanu obu profili po zatwierdzeniu bloku
        fresh_a = get_profile(chlop_a["id"])
        fresh_b = get_profile(chlop_b["id"])
        self.assertEqual(fresh_a["chlopocoin_balance"], 1)
        self.assertEqual(fresh_b["chlopocoin_balance"], 1)

        # 5. Sprawdzenie statystyk blockchain w profilu
        stats_a = get_chlopocoin_stats(chlop_a["id"])
        self.assertEqual(stats_a["balance"], 1)
        self.assertEqual(stats_a["completed_helps"], 1)
        self.assertEqual(len(stats_a["blocks"]), 1)
        self.assertEqual(stats_a["blocks"][0]["partner_id"], chlop_b["id"])
        self.assertEqual(stats_a["blocks"][0]["partner_name"], "Kazik")
        self.assertEqual(stats_a["blocks"][0]["reward"], 1)

        # 6. Ponowna próba potwierdzenia informuje o wcześniejszym rozliczeniu
        res3 = confirm_chlop_help(chlop_a["id"], chlop_b["id"], "pw_a-haslo")
        self.assertEqual(res3["status"], "already_settled")
        self.assertTrue(res3["mutual_settled"])

        # 7. Weryfikacja globalnych statystyk sieci Chłopchain
        global_stats = get_global_chlopocoin_stats()
        self.assertGreaterEqual(global_stats["total_supply"], 2)
        self.assertGreaterEqual(global_stats["total_blocks"], 1)
        self.assertGreaterEqual(global_stats["active_holders_count"], 2)
        self.assertTrue(global_stats["chain_integrity"]["is_valid"])
        self.assertGreaterEqual(len(global_stats["blocks"]), 1)
        # Obaj chłopi są obecni w rankingu
        leaderboard_ids = [p["id"] for p in global_stats["leaderboard"]]
        self.assertIn(chlop_a["id"], leaderboard_ids)
        self.assertIn(chlop_b["id"], leaderboard_ids)

        # 8. Weryfikacja dedykowanej metody rankingów dla zakładki 'Rankingi'
        rankings = get_chlopocoin_rankings()
        self.assertGreaterEqual(rankings["total_coins_minted"], 2)
        self.assertGreaterEqual(rankings["total_holders_count"], 2)
        r_ids = [p["id"] for p in rankings["leaderboard"]]
        self.assertIn(chlop_a["id"], r_ids)
        self.assertIn(chlop_b["id"], r_ids)
        self.assertGreaterEqual(len(rankings["top_three"]), 2)


if __name__ == "__main__":
    unittest.main()
