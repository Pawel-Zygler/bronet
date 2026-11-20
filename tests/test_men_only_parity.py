"""Reguła men only na backendzie, na tych samych przypadkach co frontend.

Dane: tests/fixtures/men_only_cases.json (czyta je też frontend/src/utils/text.test.js).
Jeśli listy imion w app/database.py i frontend/src/utils/text.js się rozjadą,
padnie jedna ze stron.
"""
import json
import unittest
from pathlib import Path

from app.database import is_female_name

CASES = json.loads((Path(__file__).parent / "fixtures" / "men_only_cases.json").read_text(encoding="utf-8"))


class MenOnlyParityTest(unittest.TestCase):
    def test_female_names_are_rejected(self) -> None:
        for name in CASES["female_names"]:
            with self.subTest(name=name):
                self.assertTrue(is_female_name(name))

    def test_male_names_are_allowed(self) -> None:
        for name in CASES["male_names"]:
            with self.subTest(name=name):
                self.assertFalse(is_female_name(name))

    def test_only_first_token_is_checked(self) -> None:
        self.assertFalse(is_female_name("Marek Anna"))


if __name__ == "__main__":
    unittest.main()
