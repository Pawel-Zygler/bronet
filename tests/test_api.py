import os
import tempfile
import unittest

# Configure isolated test DB before importing app
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["BRONET_DB_PATH"] = _tmp.name

from app.database import (
    ProfileAuthError,
    authenticate_profile_by_email,
    create_profile,
    delete_profile,
    get_matches_for_profile,
    get_profile,
    get_skills_catalog,
    init_db,
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

    def test_crud_and_matching(self) -> None:
        created = create_profile(
            {
                "name": "Paweł",
                "email": "pawel@test.pl",
                "can_help": ["finanse, sdlc", "python"],
                "need_help": ["qa", "związki"],
                "contact": "pawel@test.pl",
                "bio": "Testowy profil",
            }
        )
        self.assertEqual(created["name"], "Paweł")
        self.assertFalse(created["has_password"])
        self.assertEqual(created["can_help"], ["finanse", "sdlc", "python"])
        self.assertEqual(created["need_help"], ["qa", "związki"])

        fetched = get_profile(created["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["contact"], "pawel@test.pl")

        matches = get_matches_for_profile(created["id"])
        self.assertIsNotNone(matches)
        mutual_names = [m["profile"]["name"] for m in matches["mutual"]]
        self.assertIn("Marek", mutual_names)

        # Add a simple password with zero complexity rules ("12") to an unprotected profile
        updated = update_profile(
            created["id"],
            {
                "name": "Paweł Z.",
                "email": "pawel@test.pl",
                "password": "12",
                "can_help": ["architektura"],
                "need_help": ["figma"],
                "contact": "nowy@test.pl",
                "bio": "Zaktualizowano",
            },
        )
        self.assertEqual(updated["name"], "Paweł Z.")
        self.assertTrue(updated["has_password"])

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
            },
        )
        self.assertTrue(changed_pw["has_password"])
        self.assertEqual(authenticate_profile_by_email("pawel@test.pl", "kawa")["id"], created["id"])

        # Delete requires the updated password
        with self.assertRaises(ProfileAuthError):
            delete_profile(created["id"], password="12")
        self.assertTrue(delete_profile(created["id"], password="kawa"))
        self.assertIsNone(get_profile(created["id"]))

        catalog = get_skills_catalog()
        self.assertTrue(len(catalog["all"]) > 0)


if __name__ == "__main__":
    unittest.main()
