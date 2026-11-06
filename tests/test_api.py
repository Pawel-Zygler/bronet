import os
import tempfile
import unittest

# Configure isolated test DB before importing app
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["BRONET_DB_PATH"] = _tmp.name

from app.database import (
    ProfileAuthError,
    ProfileValidationError,
    authenticate_profile_by_email,
    confirm_chlop_help,
    create_profile,
    delete_profile,
    get_chlopocoin_rankings,
    get_chlopocoin_stats,
    get_chlopocoin_status,
    get_global_chlopocoin_stats,
    get_matches_for_profile,
    get_profile,
    get_skills_catalog,
    init_db,
    is_female_email,
    is_female_name,
    list_profiles,
    update_profile,
    verify_chlopchain_integrity,
)


class BronetBackendTest(unittest.TestCase):
    def setUp(self) -> None:
        if os.path.exists(_tmp.name):
            os.remove(_tmp.name)
        init_db(seed=True)

    @classmethod
    def tearDownClass(cls) -> None:
        if os.path.exists(_tmp.name):
            os.remove(_tmp.name)

    def test_seed_and_search_diacritics(self) -> None:
        all_profiles = list_profiles()
        self.assertGreaterEqual(len(all_profiles), 5)

        found = list_profiles(query="zwiazki", mode="can_help")
        self.assertTrue(any(p["name"] == "Marek" for p in found))

        need_sdlc = list_profiles(query="sdlc", mode="need_help")
        self.assertTrue(any(p["name"] == "Marek" for p in need_sdlc))
        self.assertFalse(any(p["name"] == "Tomek" for p in need_sdlc))

        can_sdlc = list_profiles(query="sdlc", mode="can_help")
        self.assertTrue(any(p["name"] == "Tomek" for p in can_sdlc))

        by_email = list_profiles(query="marek@bronet.pl", mode="all")
        self.assertEqual(len(by_email), 1)
        self.assertEqual(by_email[0]["name"], "Marek")

        by_email_in_skill_mode = list_profiles(query="tomek@bronet.pl", mode="can_help")
        self.assertEqual(len(by_email_in_skill_mode), 1)
        self.assertEqual(by_email_in_skill_mode[0]["name"], "Tomek")

    def test_crud_and_matching(self) -> None:
        # Password is required on profile creation
        with self.assertRaises(ProfileAuthError):
            create_profile(
                {
                    "name": "Paweł",
                    "email": "pawel@test.pl",
                    "can_help": ["finanse, sdlc", "python"],
                    "need_help": ["qa", "związki"],
                }
            )

        # Create profile with a simple password (zero complexity restrictions, e.g. "12")
        created = create_profile(
            {
                "name": "Paweł",
                "email": "pawel@test.pl",
                "password": "12",
                "can_help": ["finanse, sdlc", "python"],
                "need_help": ["qa", "związki"],
                "contact": "pawel@test.pl",
                "bio": "Testowy profil",
            }
        )
        self.assertEqual(created["name"], "Paweł")
        self.assertTrue(created["has_password"])
        self.assertEqual(created["can_help"], ["finanse", "sdlc", "python"])
        self.assertEqual(created["need_help"], ["qa", "związki"])

        fetched = get_profile(created["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["contact"], "pawel@test.pl")

        matches = get_matches_for_profile(created["id"])
        self.assertIsNotNone(matches)
        mutual_names = [m["profile"]["name"] for m in matches["mutual"]]
        self.assertIn("Marek", mutual_names)

        # Login without password or wrong password must fail
        with self.assertRaises(ProfileAuthError):
            authenticate_profile_by_email("pawel@test.pl", "")
        with self.assertRaises(ProfileAuthError):
            authenticate_profile_by_email("pawel@test.pl", "zle")

        # Login with correct password succeeds
        authed = authenticate_profile_by_email("pawel@test.pl", "12")
        self.assertEqual(authed["id"], created["id"])

        # Update without password fails, with password + new_password succeeds
        with self.assertRaises(ProfileAuthError):
            update_profile(created["id"], {"name": "Intruz", "email": "pawel@test.pl"})

        changed_pw = update_profile(
            created["id"],
            {
                "name": "Paweł Z.",
                "email": "pawel@test.pl",
                "password": "12",
                "new_password": "kawa",
                "can_help": ["architektura"],
                "need_help": ["figma"],
                "contact": "nowy@test.pl",
                "bio": "Zaktualizowano",
            },
        )
        self.assertEqual(changed_pw["name"], "Paweł Z.")
        self.assertTrue(changed_pw["has_password"])
        self.assertEqual(authenticate_profile_by_email("pawel@test.pl", "kawa")["id"], created["id"])

        # Delete requires the updated password
        with self.assertRaises(ProfileAuthError):
            delete_profile(created["id"], password="")
        with self.assertRaises(ProfileAuthError):
            delete_profile(created["id"], password="12")
        self.assertTrue(delete_profile(created["id"], password="kawa"))
        self.assertIsNone(get_profile(created["id"]))

        catalog = get_skills_catalog()
        self.assertTrue(len(catalog["all"]) > 0)

    def test_men_only_no_female_profiles_in_db(self) -> None:
        """Weryfikuje, że w bazie nie ma żadnych profili 'Kasia', 'Basia' ani innych żeńskich."""
        profiles = list_profiles()
        self.assertGreater(len(profiles), 0)

        for p in profiles:
            name_lower = p["name"].lower()
            email_lower = (p.get("email") or "").lower()

            self.assertNotIn("kasia", name_lower, f"Znaleziono 'kasia' w imieniu profilu {p['id']}")
            self.assertNotIn("basia", name_lower, f"Znaleziono 'basia' w imieniu profilu {p['id']}")
            self.assertFalse(
                email_lower.startswith("kasia@") or email_lower.startswith("kasia."),
                f"Znaleziono e-mail 'kasia' w profilu {p['id']}",
            )
            self.assertFalse(
                email_lower.startswith("basia@") or email_lower.startswith("basia."),
                f"Znaleziono e-mail 'basia' w profilu {p['id']}",
            )
            self.assertFalse(
                is_female_name(p["name"]),
                f"Imię '{p['name']}' (id: {p['id']}) zostało zakwalifikowane jako żeńskie!",
            )
            self.assertFalse(
                is_female_email(p["email"]),
                f"E-mail '{p['email']}' (id: {p['id']}) został zakwalifikowany jako żeński!",
            )

    def test_men_only_rejects_female_profile_creation_and_update(self) -> None:
        """Weryfikuje, że próba założenia lub edycji profilu na 'Kasia', 'Basia' itp. jest blokowana."""
        forbidden_names = [
            "Kasia",
            "Basia",
            "Ania",
            "Anna",
            "Katarzyna",
            "Barbara",
            "Basia Kowalska",
            "Kasia (Księgowa)",
            "Zofia",
        ]
        for bad_name in forbidden_names:
            with self.assertRaises(ProfileValidationError, msg=f"Powinno odrzucić imię: {bad_name}"):
                create_profile(
                    {
                        "name": bad_name,
                        "email": f"test.{bad_name.split()[0].lower()}@bronet.test",
                        "password": "123",
                        "can_help": ["it"],
                        "need_help": ["mechanik"],
                    }
                )

        forbidden_emails = [
            "kasia@test.pl",
            "basia@test.pl",
            "kasia.nowak@test.pl",
            "basia.kowalska@test.pl",
        ]
        for bad_email in forbidden_emails:
            with self.assertRaises(ProfileValidationError, msg=f"Powinno odrzucić e-mail: {bad_email}"):
                create_profile(
                    {
                        "name": "Marek",
                        "email": bad_email,
                        "password": "123",
                        "can_help": ["it"],
                        "need_help": ["mechanik"],
                    }
                )

        # Męskie imiona (w tym kończące się na 'a', np. Kuba) są dozwolone
        allowed = create_profile(
            {
                "name": "Kuba",
                "email": "kuba.test@bronet.test",
                "password": "123",
                "can_help": ["it"],
                "need_help": ["mechanik"],
            }
        )
        self.assertEqual(allowed["name"], "Kuba")

        # Próba zmiany imienia na żeńskie przy edycji profilu jest blokowana
        with self.assertRaises(ProfileValidationError):
            update_profile(
                allowed["id"],
                {
                    "name": "Basia",
                    "email": "kuba.test@bronet.test",
                    "password": "123",
                    "can_help": ["it"],
                    "need_help": ["mechanik"],
                },
            )

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
                "password": "pw_a",
                "can_help": ["hydraulik"],
                "need_help": ["mechanik"],
            }
        )
        chlop_b = create_profile(
            {
                "name": "Kazik",
                "email": "kazik.chlopocoin@bronet.test",
                "password": "pw_b",
                "can_help": ["mechanik"],
                "need_help": ["hydraulik"],
            }
        )

        # 1. Próba potwierdzenia samemu sobie jest odrzucana
        with self.assertRaises(ProfileValidationError):
            confirm_chlop_help(chlop_a["id"], chlop_a["id"], "pw_a")

        # 2. Wojtek (A) potwierdza Kazika (B) -> 1/2 potwierdzenia
        res1 = confirm_chlop_help(chlop_a["id"], chlop_b["id"], "pw_a")
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
        res2 = confirm_chlop_help(chlop_b["id"], chlop_a["id"], "pw_b")
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
        res3 = confirm_chlop_help(chlop_a["id"], chlop_b["id"], "pw_a")
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


if __name__ == "__main__":
    unittest.main()
