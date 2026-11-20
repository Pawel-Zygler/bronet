"""Role, sesje, limity prób, nagłówki bezpieczeństwa."""
import unittest

from support import BackendTestCase

from app.database import (
    create_profile,
    get_profile,
)


class SecurityTest(BackendTestCase):
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

        # Sam nagłówek z adresem admina nie daje już uprawnień
        res_header_only = client.post(
            "/api/chlopocoin/simulator/tick",
            headers={"X-Admin-Email": "pawel.zygler@gmail.com"},
        )
        self.assertEqual(res_header_only.status_code, 403)

        user_client = TestClient(app)
        self.assertEqual(
            user_client.post(
                "/api/profiles/login",
                json={"email": "boguslaw.user@bronet.test", "password": "haslo123user"},
            ).status_code,
            200,
        )
        res_user_auth = user_client.post(
            "/api/chlopocoin/simulator/tick",
            headers={"X-Admin-Email": "pawel.zygler@gmail.com"},
        )
        self.assertEqual(res_user_auth.status_code, 403)

        # 4. Kontrolki ekonomii z sesją admina -> 200 OK
        admin_client = TestClient(app)
        self.assertEqual(
            admin_client.post(
                "/api/profiles/login",
                json={"email": "pawel.zygler@gmail.com", "password": "adminhaslo123"},
            ).status_code,
            200,
        )
        res_admin_auth = admin_client.post("/api/chlopocoin/simulator/tick")
        self.assertEqual(res_admin_auth.status_code, 200)
        self.assertIn("cycle_number", res_admin_auth.json())

        # 5. Generowanie profilu bez uprawnień vs z uprawnieniem admina
        res_gen_no_auth = client.post("/api/chlopocoin/simulator/generate-profile")
        self.assertEqual(res_gen_no_auth.status_code, 403)

        res_gen_admin = admin_client.post("/api/chlopocoin/simulator/generate-profile")
        self.assertEqual(res_gen_admin.status_code, 200)
        created_gen = res_gen_admin.json()
        self.assertIn("name", created_gen)
        self.assertIn("location_name", created_gen)

    def test_session_authorization(self) -> None:
        from fastapi.testclient import TestClient
        from app.database import get_db
        from app.main import app

        owner = TestClient(app)
        other = TestClient(app)
        anon = TestClient(app)
        a = owner.post("/api/profiles", json={"name": "Adam", "email": "adam@test.pl", "password": "haslo-a-haslo", "lat": 52.229676, "lng": 21.012229}).json()
        b = other.post("/api/profiles", json={"name": "Bartek", "email": "bartek@test.pl", "password": "haslo-b-haslo"}).json()

        # Własny profil widać w całości, cudzy bez e-maila i z przybliżoną lokalizacją
        self.assertEqual(owner.get("/api/profiles/me").json()["email"], "adam@test.pl")
        self.assertEqual(anon.get("/api/profiles/me").status_code, 401)
        seen_by_other = other.get(f"/api/profiles/{a['id']}").json()
        self.assertEqual(seen_by_other["email"], "")
        self.assertEqual(seen_by_other["lat"], 52.23)
        self.assertTrue(all(p["email"] == "" for p in anon.get("/api/profiles").json()))

        # Edycja, usunięcie i potwierdzenie pomocy tylko z własnej sesji
        payload = {"name": "Adam", "email": "adam@test.pl", "password": "haslo-a-haslo", "bio": "przejęty"}
        self.assertEqual(other.put(f"/api/profiles/{a['id']}", json=payload).status_code, 403)
        self.assertEqual(anon.put(f"/api/profiles/{a['id']}", json=payload).status_code, 401)
        self.assertEqual(other.request("DELETE", f"/api/profiles/{a['id']}", json={"password": "haslo-a-haslo"}).status_code, 403)
        self.assertEqual(
            other.post(f"/api/profiles/{a['id']}/confirm-help", json={"other_profile_id": b["id"]}).status_code,
            403,
        )
        self.assertEqual(
            owner.post(f"/api/profiles/{a['id']}/confirm-help", json={"other_profile_id": b["id"]}).status_code,
            200,
        )

        # Czat: gość nie podszyje się pod zarejestrowanego użytkownika
        msg = anon.post("/api/chat/messages", json={"message": "hej", "author_name": "Adam", "profile_id": a["id"]}).json()
        self.assertIsNone(msg["profile_id"])
        self.assertEqual(msg["author_name"], "Adam (gość)")

        # Wylogowanie unieważnia sesję
        owner.post("/api/profiles/logout")
        self.assertEqual(owner.get("/api/profiles/me").status_code, 401)

        # Konto bez hasła nie jest już przejmowane przy pierwszym logowaniu
        with get_db() as conn:
            conn.execute("UPDATE profiles SET password_hash = '' WHERE id = ?", (b["id"],))
        res = anon.post("/api/profiles/login", json={"email": "bartek@test.pl", "password": "nowe-haslo"})
        self.assertEqual(res.status_code, 401)
        with get_db() as conn:
            row = conn.execute("SELECT password_hash FROM profiles WHERE id = ?", (b["id"],)).fetchone()
        self.assertEqual(row["password_hash"], "")

    def test_hardening_rate_limits_passwords_headers_docs(self) -> None:
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)

        # Zasady haseł i walidacja danych profilu
        short = client.post("/api/profiles", json={"name": "Adam", "email": "adam@test.pl", "password": "krotkie"})
        self.assertEqual(short.status_code, 422)
        too_many = client.post(
            "/api/profiles",
            json={"name": "Adam", "email": "adam@test.pl", "password": "dlugie-haslo", "can_help": [f"s{i}" for i in range(31)]},
        )
        self.assertEqual(too_many.status_code, 422)
        bad_email = client.post("/api/profiles", json={"name": "Adam", "email": "nie-email", "password": "dlugie-haslo"})
        self.assertEqual(bad_email.status_code, 422)
        ok = client.post("/api/profiles", json={"name": "Adam", "email": "adam@test.pl", "password": "dlugie-haslo"})
        self.assertEqual(ok.status_code, 201)

        # Limit nieudanych logowań na konto
        for _ in range(10):
            res = client.post("/api/profiles/login", json={"email": "adam@test.pl", "password": "zle-haslo"})
            self.assertEqual(res.status_code, 401)
        blocked = client.post("/api/profiles/login", json={"email": "adam@test.pl", "password": "dlugie-haslo"})
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked.headers)

        # Nagłówki bezpieczeństwa i wyłączona dokumentacja API
        health = client.get("/api/health")
        self.assertEqual(health.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(health.headers["X-Frame-Options"], "DENY")
        self.assertIn("frame-ancestors 'none'", health.headers["Content-Security-Policy"])
        self.assertNotIn("Strict-Transport-Security", health.headers)
        https_health = client.get("/api/health", headers={"X-Forwarded-Proto": "https"})
        self.assertIn("max-age", https_health.headers["Strict-Transport-Security"])
        self.assertEqual(client.get("/docs").status_code, 404)
        self.assertEqual(client.get("/openapi.json").status_code, 404)

        # Limit wiadomości na czacie
        statuses = [client.post("/api/chat/messages", json={"message": f"m{i}"}).status_code for i in range(21)]
        self.assertEqual(statuses[:20], [201] * 20)
        self.assertEqual(statuses[20], 429)


if __name__ == "__main__":
    unittest.main()
