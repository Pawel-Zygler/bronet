"""Profile: wyszukiwanie, CRUD, dopasowania, e-mail, profile z seeda."""
import unittest

from support import BackendTestCase

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
    list_profiles,
    update_profile,
)


class ProfilesTest(BackendTestCase):
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

        # Create profile with a simple password (only minimum length is required)
        created = create_profile(
            {
                "name": "Paweł",
                "email": "pawel@test.pl",
                "password": "12-haslo",
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
            authenticate_profile_by_email("pawel@test.pl", "zle-haslo")

        # Login with correct password succeeds
        authed = authenticate_profile_by_email("pawel@test.pl", "12-haslo")
        self.assertEqual(authed["id"], created["id"])

        # Update without password fails, with password + new_password succeeds
        with self.assertRaises(ProfileAuthError):
            update_profile(created["id"], {"name": "Intruz", "email": "pawel@test.pl"})

        changed_pw = update_profile(
            created["id"],
            {
                "name": "Paweł Z.",
                "email": "pawel@test.pl",
                "password": "12-haslo",
                "new_password": "kawa-haslo",
                "can_help": ["architektura"],
                "need_help": ["figma"],
                "contact": "nowy@test.pl",
                "bio": "Zaktualizowano",
            },
        )
        self.assertEqual(changed_pw["name"], "Paweł Z.")
        self.assertTrue(changed_pw["has_password"])
        self.assertEqual(authenticate_profile_by_email("pawel@test.pl", "kawa-haslo")["id"], created["id"])

        # Delete requires the updated password
        with self.assertRaises(ProfileAuthError):
            delete_profile(created["id"], password="")
        with self.assertRaises(ProfileAuthError):
            delete_profile(created["id"], password="12-haslo")
        self.assertTrue(delete_profile(created["id"], password="kawa-haslo"))
        self.assertIsNone(get_profile(created["id"]))

        catalog = get_skills_catalog()
        self.assertTrue(len(catalog["all"]) > 0)

    def test_email_cannot_be_taken_over(self) -> None:
        victim = create_profile({"name": "Paweł", "email": "wlasciciel@test.pl", "password": "ofiara1-haslo"})
        attacker = create_profile({"name": "Marek", "email": "atak@test.pl", "password": "atak1-haslo"})

        # Zmiana e-maila na adres innego profilu jest odrzucana
        with self.assertRaises(ProfileValidationError):
            update_profile(
                attacker["id"],
                {"name": "Marek", "email": "wlasciciel@test.pl", "password": "atak1-haslo"},
            )
        # Rejestracja na zajęty adres nie nadpisuje cudzego profilu
        with self.assertRaises(ProfileValidationError):
            create_profile({"name": "Marek", "email": "wlasciciel@test.pl", "password": "cokolwiek"})

        self.assertEqual(authenticate_profile_by_email("wlasciciel@test.pl", "ofiara1-haslo")["id"], victim["id"])
        self.assertEqual(get_profile(victim["id"])["name"], "Paweł")

    def test_seed_profiles_are_marked_and_cannot_log_in(self) -> None:
        marek = list_profiles(query="marek@bronet.pl")[0]
        self.assertTrue(marek["is_test"])
        for pw in ("bronet", "bronet123", ""):
            with self.assertRaises(ProfileAuthError):
                authenticate_profile_by_email("marek@bronet.pl", pw)

        real = create_profile({"name": "Adam", "email": "adam@test.pl", "password": "haslo1-haslo"})
        self.assertFalse(real["is_test"])

    def test_existing_db_seed_profiles_get_locked_on_startup(self) -> None:
        from app.database import KNOWN_PUBLIC_SEED_HASHES, TEST_PROFILE_LOCKED_HASH, get_db

        legacy_hash = next(iter(KNOWN_PUBLIC_SEED_HASHES))
        with get_db() as conn:
            conn.execute(
                "UPDATE profiles SET is_test = 0, password_hash = ? WHERE email = 'kamil@bronet.pl'",
                (legacy_hash,),
            )
        init_db(seed=True)
        with get_db() as conn:
            row = conn.execute(
                "SELECT is_test, password_hash FROM profiles WHERE email = 'kamil@bronet.pl'"
            ).fetchone()
        self.assertEqual(row["is_test"], 1)
        self.assertEqual(row["password_hash"], TEST_PROFILE_LOCKED_HASH)


if __name__ == "__main__":
    unittest.main()
