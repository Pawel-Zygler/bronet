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
    create_profile,
    delete_profile,
    get_matches_for_profile,
    get_profile,
    get_skills_catalog,
    init_db,
    is_female_email,
    is_female_name,
    list_profiles,
    update_profile,
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


if __name__ == "__main__":
    unittest.main()
