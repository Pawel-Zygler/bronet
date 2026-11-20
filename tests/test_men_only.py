"""Reguła men only na profilach w bazie (przypadki imion: test_men_only_parity.py)."""
import unittest

from support import BackendTestCase

from app.database import (
    ProfileValidationError,
    create_profile,
    is_female_email,
    is_female_name,
    list_profiles,
    update_profile,
)


class MenOnlyTest(BackendTestCase):
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
                        "password": "123-haslo",
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
                        "password": "123-haslo",
                        "can_help": ["it"],
                        "need_help": ["mechanik"],
                    }
                )

        # Męskie imiona (w tym kończące się na 'a', np. Kuba) są dozwolone
        allowed = create_profile(
            {
                "name": "Kuba",
                "email": "kuba.test@bronet.test",
                "password": "123-haslo",
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
                    "password": "123-haslo",
                    "can_help": ["it"],
                    "need_help": ["mechanik"],
                },
            )


if __name__ == "__main__":
    unittest.main()
