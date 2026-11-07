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
    create_chat_message,
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
    list_chat_messages,
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

    def test_global_chat_persistence_and_listing(self) -> None:
        """Weryfikuje globalny czat chłopów (tworzenie i pobieranie wiadomości)."""
        initial_messages = list_chat_messages(limit=20)
        self.assertGreaterEqual(len(initial_messages), 2)
        self.assertTrue(any("Siemanko" in m["message"] for m in initial_messages))

        # Dodaj wiadomość od usera
        created = create_chat_message(
            message="Testowa wiadomość z telefonu 📱",
            author_name="Janusz",
        )
        self.assertEqual(created["author_name"], "Janusz")
        self.assertEqual(created["message"], "Testowa wiadomość z telefonu 📱")

        after_messages = list_chat_messages(limit=10)
        self.assertTrue(any(m["id"] == created["id"] for m in after_messages))

        # Test walidacji pustej wiadomości
        with self.assertRaises(ProfileValidationError):
            create_chat_message(message="   ")

    def test_account_roles_admin_and_user_and_permissions(self) -> None:
        """
        Weryfikuje role w kontach:
        - pawel.zygler@gmail.com otrzymuje rolę 'admin'
        - Inne profile otrzymują rolę 'user'
        - Zwykły user nie może nadać sobie uprawnień admina
        - Kontrolki ekonomii wymagają uprawnień admina (403 vs 200)
        """
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import create_profile, get_profile, ADMIN_EMAIL

        client = TestClient(app)

        # 1. Zwykły profil
        user_prof = create_profile({
            "name": "Bogusław Zwykły",
            "email": "boguslaw.user@bronet.test",
            "password": "haslo123user",
            "role": "admin", # Próba samozwańczego admina
        })
        self.assertEqual(user_prof["role"], "user")

        # 2. Profil administratora
        admin_prof = create_profile({
            "name": "Paweł Zygler",
            "email": "pawel.zygler@gmail.com",
            "password": "adminhaslo123",
        })
        self.assertEqual(admin_prof["role"], "admin")
        self.assertEqual(admin_prof["email"], "pawel.zygler@gmail.com")

        # 3. Kontrolki ekonomii bez uprawnień -> 403 Forbidden
        res_no_auth = client.post("/api/chlopocoin/simulator/tick")
        self.assertEqual(res_no_auth.status_code, 403)
        self.assertIn("Brak uprawnień", res_no_auth.json()["detail"])

        res_user_auth = client.post(
            "/api/chlopocoin/simulator/tick",
            headers={"X-Admin-Email": "boguslaw.user@bronet.test"},
        )
        self.assertEqual(res_user_auth.status_code, 403)

        # 4. Kontrolki ekonomii z uprawnieniem admina -> 200 OK
        res_admin_auth = client.post(
            "/api/chlopocoin/simulator/tick",
            headers={"X-Admin-Email": "pawel.zygler@gmail.com"},
        )
        self.assertEqual(res_admin_auth.status_code, 200)
        self.assertIn("cycle_number", res_admin_auth.json())

        # 5. Generowanie profilu bez uprawnień vs z uprawnieniem admina
        res_gen_no_auth = client.post("/api/chlopocoin/simulator/generate-profile")
        self.assertEqual(res_gen_no_auth.status_code, 403)

        res_gen_admin = client.post(
            "/api/chlopocoin/simulator/generate-profile",
            headers={"X-Admin-Email": "pawel.zygler@gmail.com"},
        )
        self.assertEqual(res_gen_admin.status_code, 200)
        created_gen = res_gen_admin.json()
        self.assertIn("name", created_gen)
        self.assertIn("location_name", created_gen)

    def test_direct_messages_and_chat_history_options(self) -> None:
        """
        Weryfikuje wiadomości prywatne (Direct Messages) między profilami:
        - Wysyłanie 1:1, blokada wysłania do samego siebie
        - Pobieranie wątku konwersacji i automatyczne oznaczanie jako przeczytane
        - Pobieranie listy aktywnych konwersacji (z podglądem ostatniej wiadomości i licznikiem nieprzeczytanych)
        - Opcje historii: wyczyszczenie całej historii konwersacji oraz usunięcie pojedynczej wiadomości
        """
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)

        # Utwórz 2 testowe profile
        p1 = create_profile({
            "name": "Wojtek Nadawca",
            "email": "wojtek.dm@bronet.test",
            "password": "haslo123wojtek",
        })
        p2 = create_profile({
            "name": "Bartek Odbiorca",
            "email": "bartek.dm@bronet.test",
            "password": "haslo123bartek",
        })

        # 1. Próba wysłania wiadomości do samego siebie -> 422
        res_self = client.post(
            f"/api/dm/messages/{p1['id']}",
            json={"message": "Hej do lustra", "profile_id": p1["id"]},
        )
        self.assertEqual(res_self.status_code, 422)

        # 2. Wysyłanie DM z p1 do p2
        res_send = client.post(
            f"/api/dm/messages/{p2['id']}",
            json={"message": "Cześć Bartek, potrzebujesz pomocy z spawaniem?", "profile_id": p1["id"]},
        )
        self.assertEqual(res_send.status_code, 201)
        msg_data = res_send.json()
        self.assertEqual(msg_data["sender_id"], p1["id"])
        self.assertEqual(msg_data["receiver_id"], p2["id"])
        self.assertFalse(msg_data["is_read"])
        msg1_id = msg_data["id"]

        # 3. Sprawdzenie licznika nieprzeczytanych dla p2
        unread_res = client.get(f"/api/dm/unread-count?profile_id={p2['id']}")
        self.assertEqual(unread_res.status_code, 200)
        self.assertEqual(unread_res.json()["unread_count"], 1)

        # 4. Lista konwersacji dla p2 (Messenger/LinkedIn inbox)
        convs_res = client.get(f"/api/dm/conversations?profile_id={p2['id']}")
        self.assertEqual(convs_res.status_code, 200)
        convs = convs_res.json()
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["partner_id"], p1["id"])
        self.assertEqual(convs[0]["partner_name"], "Wojtek Nadawca")
        self.assertEqual(convs[0]["unread_count"], 1)
        self.assertIn("spawaniem", convs[0]["last_message"])

        # 5. Odczyt wiadomości przez p2 (mark_read=True domyślnie)
        thread_res = client.get(f"/api/dm/messages/{p1['id']}?profile_id={p2['id']}")
        self.assertEqual(thread_res.status_code, 200)
        thread = thread_res.json()
        self.assertEqual(len(thread), 1)
        self.assertEqual(thread[0]["id"], msg1_id)

        # Licznik nieprzeczytanych p2 po odczycie -> 0
        unread_res_after = client.get(f"/api/dm/unread-count?profile_id={p2['id']}")
        self.assertEqual(unread_res_after.json()["unread_count"], 0)

        # 6. Odpowiedź od p2 do p1
        res_reply = client.post(
            f"/api/dm/messages/{p1['id']}",
            json={"message": "Jasne, chętnie! Kiedy masz czas?", "profile_id": p2["id"]},
        )
        self.assertEqual(res_reply.status_code, 201)
        msg2_id = res_reply.json()["id"]

        # Wątek p1 ma teraz 2 wiadomości
        thread_p1 = client.get(f"/api/dm/messages/{p2['id']}?profile_id={p1['id']}")
        self.assertEqual(len(thread_p1.json()), 2)

        # 7. Usunięcie pojedynczej wiadomości przez p1
        del_single = client.delete(f"/api/dm/messages/{msg1_id}?profile_id={p1['id']}")
        self.assertEqual(del_single.status_code, 200)

        # Wątek p1 ma teraz 1 wiadomość (druga została ukryta dla p1)
        thread_p1_after = client.get(f"/api/dm/messages/{p2['id']}?profile_id={p1['id']}")
        self.assertEqual(len(thread_p1_after.json()), 1)
        self.assertEqual(thread_p1_after.json()[0]["id"], msg2_id)

        # Dla p2 wiadomość msg1 nadal istnieje (chyba że p2 też ją usunie)
        thread_p2_after = client.get(f"/api/dm/messages/{p1['id']}?profile_id={p2['id']}")
        self.assertEqual(len(thread_p2_after.json()), 2)

        # 8. Wyczyść całą historię konwersacji z p1 dla p2
        clear_res = client.delete(f"/api/dm/conversations/{p1['id']}?profile_id={p2['id']}")
        self.assertEqual(clear_res.status_code, 200)

        # Teraz p2 ma pusty wątek z p1
        thread_p2_cleared = client.get(f"/api/dm/messages/{p1['id']}?profile_id={p2['id']}")
        self.assertEqual(len(thread_p2_cleared.json()), 0)

    def test_achievements_gamification_and_notifications(self) -> None:
        """
        Weryfikuje system gamifikacji i osiągnięć w stylu World of Warcraft:
        - Definicje osiągnięć w /api/achievements/global
        - 'Pierwsza pomoc!' przy 1st CC (+1 CC) oraz kolejne poziomy (5 CC itd.)
        - 'Server first: 10 Coinów!' jest przyznawane pierwszemu chłopowi, a drugi go nie otrzymuje
        - 'Billboard hot 200' po 7 dniach utrzymania pozycji #1
        - Powiadomienia w /api/achievements/notifications (oznaczanie jako przeczytane)
        - Punkty osiągnięć widoczne na profilu chłopa
        """
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import create_profile, get_db, confirm_chlop_help

        client = TestClient(app)

        # 1. Globalny feed osiągnięć
        global_res = client.get("/api/achievements/global")
        self.assertEqual(global_res.status_code, 200)
        data = global_res.json()
        self.assertIn("stats", data)
        self.assertIn("server_firsts", data)
        self.assertIn("achievements", data)
        self.assertIn("billboard", data)
        self.assertGreaterEqual(data["stats"]["total_definitions"], 10)

        # Sprawdź obecność kluczowych osiągnięć
        ach_ids = {a["id"] for a in data["achievements"]}
        self.assertIn("first_aid_1", ach_ids)
        self.assertIn("first_aid_2", ach_ids)
        self.assertIn("server_first_10", ach_ids)
        self.assertIn("billboard_hot_200", ach_ids)

        # 2. Utwórz dwóch chłopów do testu
        prof_a = create_profile({
            "name": "Stanisław Pomocny",
            "email": "stanislaw.ach@bronet.test",
            "password": "haslo123ach",
            "can_help": ["stolarka", "spawanie", "mechanika"],
            "need_help": ["it"],
            "location_name": "Lublin",
            "bio": "Chłop ze wschodu",
        })
        prof_b = create_profile({
            "name": "Kazimierz Biorca",
            "email": "kazimierz.ach@bronet.test",
            "password": "haslo123ach",
            "can_help": ["it"],
            "need_help": ["stolarka"],
            "location_name": "Zamość",
            "bio": "Chłop z Roztocza",
        })

        # Przed wymianą: profil Stanisława nie ma jeszcze Pierwszej Pomocy
        prof_ach_before = client.get(f"/api/achievements/profile/{prof_a['id']}")
        self.assertEqual(prof_ach_before.status_code, 200)
        unlocked_before = {u["id"] for u in prof_ach_before.json()["unlocked"]}
        self.assertNotIn("first_aid_1", unlocked_before)

        # 3. Przeprowadź wzajemne potwierdzenie pomocy (Konsensus 2/2 -> +1 CC dla obu)
        confirm_chlop_help(prof_a["id"], prof_b["id"])
        confirm_chlop_help(prof_b["id"], prof_a["id"])

        # Po zdobyciu 1st CC: Stanisław odblokował 'Pierwsza pomoc!' oraz 'Mój pierwszy blok'
        prof_ach_after = client.get(f"/api/achievements/profile/{prof_a['id']}")
        self.assertEqual(prof_ach_after.status_code, 200)
        unlocked_after = {u["id"] for u in prof_ach_after.json()["unlocked"]}
        self.assertIn("first_aid_1", unlocked_after)
        self.assertIn("first_block", unlocked_after)

        # Powiadomienia w stylu WoW: endpoint /api/achievements/notifications zwraca nowe osiągnięcie
        notif_res = client.get(f"/api/achievements/notifications?profile_id={prof_a['id']}")
        self.assertEqual(notif_res.status_code, 200)
        notifs = notif_res.json()
        notif_ids = {n["id"] for n in notifs}
        self.assertIn("first_aid_1", notif_ids)

        # Drugie pobranie powiadomień: lista jest pusta (oznaczone jako przeczytane)
        notif_empty = client.get(f"/api/achievements/notifications?profile_id={prof_a['id']}")
        self.assertEqual(len(notif_empty.json()), 0)

        # 4. Test Server First: pierwszy do zdobycia 10 Coinów
        with get_db() as conn:
            conn.execute("UPDATE profiles SET chlopocoin_balance = 10 WHERE id = ?", (prof_a["id"],))

        client.post(f"/api/achievements/evaluate?profile_id={prof_a['id']}")
        prof_a_ach = client.get(f"/api/achievements/profile/{prof_a['id']}").json()
        unlocked_a = {u["id"] for u in prof_a_ach["unlocked"]}
        self.assertIn("server_first_10", unlocked_a)
        self.assertIn("first_aid_2", unlocked_a) # Pomocna dłoń (5 CC)

        # Drugi chłop (Kazimierz) również osiąga 10 coinów, ale NIE dostaje 'server_first_10'
        with get_db() as conn:
            conn.execute("UPDATE profiles SET chlopocoin_balance = 10 WHERE id = ?", (prof_b["id"],))

        client.post(f"/api/achievements/evaluate?profile_id={prof_b['id']}")
        prof_b_ach = client.get(f"/api/achievements/profile/{prof_b['id']}").json()
        unlocked_b = {u["id"] for u in prof_b_ach["unlocked"]}
        self.assertIn("first_aid_2", unlocked_b)
        self.assertNotIn("server_first_10", unlocked_b) # Już zajęte przez Stanisława!

        # 5. Test Billboard Hot 200 (Pozostań #1 przez 7 dni)
        client.post(f"/api/achievements/evaluate?profile_id={prof_a['id']}&billboard_force_days=7")
        prof_a_billboard = client.get(f"/api/achievements/profile/{prof_a['id']}").json()
        unlocked_billboard = {u["id"] for u in prof_a_billboard["unlocked"]}
        self.assertIn("billboard_hot_200", unlocked_billboard)


if __name__ == "__main__":
    unittest.main()
