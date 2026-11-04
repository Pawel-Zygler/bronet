import os
import tempfile
import unittest

# Configure isolated test DB before importing app
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["BRONET_DB_PATH"] = _tmp.name

from app.database import (
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

        # Searching without Polish diacritics ("zwiazki" -> "związki")
        found = list_profiles(query="zwiazki", mode="can_help")
        self.assertTrue(any(p["name"] == "Marek" for p in found))

        # Mode filtering: 'need_help' for 'sdlc'
        need_sdlc = list_profiles(query="sdlc", mode="need_help")
        self.assertTrue(any(p["name"] == "Marek" for p in need_sdlc))
        self.assertFalse(any(p["name"] == "Tomek" for p in need_sdlc))

        # Mode filtering: 'can_help' for 'sdlc'
        can_sdlc = list_profiles(query="sdlc", mode="can_help")
        self.assertTrue(any(p["name"] == "Tomek" for p in can_sdlc))

    def test_crud_and_matching(self) -> None:
        created = create_profile(
            {
                "name": "Paweł",
                "can_help": ["finanse, sdlc", "python"],
                "need_help": ["qa", "związki"],
                "contact": "pawel@test.pl",
                "bio": "Testowy profil",
            }
        )
        self.assertEqual(created["name"], "Paweł")
        self.assertEqual(created["can_help"], ["finanse", "sdlc", "python"])
        self.assertEqual(created["need_help"], ["qa", "związki"])

        fetched = get_profile(created["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["contact"], "pawel@test.pl")

        matches = get_matches_for_profile(created["id"])
        self.assertIsNotNone(matches)
        # Marek has can_help=['qa', 'związki', ...] and need_help=['finanse', 'sdlc', ...] -> mutual 1:1!
        mutual_names = [m["profile"]["name"] for m in matches["mutual"]]
        self.assertIn("Marek", mutual_names)

        updated = update_profile(
            created["id"],
            {
                "name": "Paweł Z.",
                "can_help": ["architektura"],
                "need_help": ["figma"],
                "contact": "nowy@test.pl",
                "bio": "Zaktualizowano",
            },
        )
        self.assertEqual(updated["name"], "Paweł Z.")
        self.assertEqual(updated["can_help"], ["architektura"])

        catalog = get_skills_catalog()
        self.assertTrue(len(catalog["all"]) > 0)

        self.assertTrue(delete_profile(created["id"]))
        self.assertIsNone(get_profile(created["id"]))


if __name__ == "__main__":
    unittest.main()
