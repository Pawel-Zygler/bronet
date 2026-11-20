"""Osiągnięcia i powiadomienia."""
import unittest

from support import BackendTestCase

from app.database import (
    confirm_chlop_help,
    create_profile,
)


class AchievementsTest(BackendTestCase):
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
        client.post("/api/profiles/login", json={"email": "stanislaw.ach@bronet.test", "password": "haslo123ach"})
        notif_res = client.get("/api/achievements/notifications")
        self.assertEqual(notif_res.status_code, 200)
        notifs = notif_res.json()
        notif_ids = {n["id"] for n in notifs}
        self.assertIn("first_aid_1", notif_ids)

        # Drugie pobranie powiadomień: lista jest pusta (oznaczone jako przeczytane)
        notif_empty = client.get("/api/achievements/notifications")
        self.assertEqual(len(notif_empty.json()), 0)

        # Przeliczanie osiągnięć jest tylko dla admina
        self.assertEqual(client.post(f"/api/achievements/evaluate?profile_id={prof_a['id']}").status_code, 403)
        create_profile({"name": "Paweł Zygler", "email": "pawel.zygler@gmail.com", "password": "adminhaslo123"})
        admin_client = TestClient(app)
        admin_client.post("/api/profiles/login", json={"email": "pawel.zygler@gmail.com", "password": "adminhaslo123"})

        # 4. Test Server First: pierwszy do zdobycia 10 Coinów
        with get_db() as conn:
            conn.execute("UPDATE profiles SET chlopocoin_balance = 10 WHERE id = ?", (prof_a["id"],))

        admin_client.post(f"/api/achievements/evaluate?profile_id={prof_a['id']}")
        prof_a_ach = client.get(f"/api/achievements/profile/{prof_a['id']}").json()
        unlocked_a = {u["id"] for u in prof_a_ach["unlocked"]}
        self.assertIn("server_first_10", unlocked_a)
        self.assertIn("first_aid_2", unlocked_a) # Pomocna dłoń (5 CC)

        # Drugi chłop (Kazimierz) również osiąga 10 coinów, ale NIE dostaje 'server_first_10'
        with get_db() as conn:
            conn.execute("UPDATE profiles SET chlopocoin_balance = 10 WHERE id = ?", (prof_b["id"],))

        admin_client.post(f"/api/achievements/evaluate?profile_id={prof_b['id']}")
        prof_b_ach = client.get(f"/api/achievements/profile/{prof_b['id']}").json()
        unlocked_b = {u["id"] for u in prof_b_ach["unlocked"]}
        self.assertIn("first_aid_2", unlocked_b)
        self.assertNotIn("server_first_10", unlocked_b) # Już zajęte przez Stanisława!

        # 5. Test Billboard Hot 200 (Pozostań #1 przez 7 dni)
        admin_client.post(f"/api/achievements/evaluate?profile_id={prof_a['id']}&billboard_force_days=7")
        prof_a_billboard = client.get(f"/api/achievements/profile/{prof_a['id']}").json()
        unlocked_billboard = {u["id"] for u in prof_a_billboard["unlocked"]}
        self.assertIn("billboard_hot_200", unlocked_billboard)


if __name__ == "__main__":
    unittest.main()
