"""Szybkie testy czystych funkcji, bez bazy i bez HTTP."""
import unittest
from unittest import mock

from app.database import (
    clean_skills,
    hash_password,
    is_admin_email,
    is_female_email,
    normalize_email,
    normalize_text,
    verify_password,
)
from app.security import RateLimiter


class NormalizeTest(unittest.TestCase):
    def test_normalize_text_lowercases_collapses_and_strips_diacritics(self) -> None:
        self.assertEqual(normalize_text("  ŻÓŁĆ   Gęślą\tJaźń "), "zolc gesla jazn")

    def test_normalize_text_handles_empty_values(self) -> None:
        for value in (None, "", "   "):
            with self.subTest(value=value):
                self.assertEqual(normalize_text(value), "")

    def test_normalize_email(self) -> None:
        self.assertEqual(normalize_email("  Marek@Bronet.PL "), "marek@bronet.pl")
        self.assertEqual(normalize_email(None), "")


class CleanSkillsTest(unittest.TestCase):
    def test_splits_on_commas_and_trims(self) -> None:
        self.assertEqual(clean_skills(["finanse, sdlc", "python"]), ["finanse", "sdlc", "python"])

    def test_deduplicates_ignoring_case_and_diacritics_keeping_first_form(self) -> None:
        self.assertEqual(clean_skills(["Związki", "zwiazki", "ZWIĄZKI"]), ["Związki"])

    def test_drops_trailing_dots_extra_spaces_and_empty_parts(self) -> None:
        self.assertEqual(clean_skills(["spawanie.", "  stolarka   meblowa ", ", ,", ""]), ["spawanie", "stolarka meblowa"])

    def test_accepts_missing_list(self) -> None:
        self.assertEqual(clean_skills(None), [])


class PasswordHashingTest(unittest.TestCase):
    def test_hash_roundtrip(self) -> None:
        stored = hash_password("dlugie-haslo")
        self.assertTrue(verify_password("dlugie-haslo", stored))
        self.assertFalse(verify_password("zle-haslo", stored))
        self.assertFalse(verify_password("", stored))

    def test_hash_is_salted(self) -> None:
        self.assertNotEqual(hash_password("dlugie-haslo"), hash_password("dlugie-haslo"))

    def test_empty_password_gives_empty_hash(self) -> None:
        self.assertEqual(hash_password(""), "")

    def test_locked_and_malformed_hashes_never_verify(self) -> None:
        self.assertFalse(verify_password("cokolwiek", "!zablokowany"))
        self.assertFalse(verify_password("cokolwiek", "bez-separatora"))


class EmailRulesTest(unittest.TestCase):
    def test_is_admin_email_is_exact_and_case_insensitive(self) -> None:
        self.assertTrue(is_admin_email("  Pawel.Zygler@gmail.com "))
        self.assertFalse(is_admin_email("pawel.zygler@gmail.com.evil.pl"))
        self.assertFalse(is_admin_email(None))
        self.assertFalse(is_admin_email(""))

    def test_is_female_email_checks_first_token_of_local_part(self) -> None:
        self.assertTrue(is_female_email("kasia@test.pl"))
        self.assertTrue(is_female_email("basia.kowalska@test.pl"))
        self.assertFalse(is_female_email("kuba.nowak@test.pl"))
        self.assertFalse(is_female_email("marek@test.pl"))
        self.assertFalse(is_female_email("bez-malpy"))
        self.assertFalse(is_female_email(""))


class RateLimiterTest(unittest.TestCase):
    def setUp(self) -> None:
        patcher = mock.patch.dict("os.environ", {"BRONET_RATE_LIMITS": "on"})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.now = 1000.0
        clock = mock.patch("app.security.time.monotonic", side_effect=lambda: self.now)
        clock.start()
        self.addCleanup(clock.stop)

    def test_limits_after_max_events_and_reports_retry_after(self) -> None:
        limiter = RateLimiter(max_events=3, window_seconds=60)
        for _ in range(3):
            self.assertEqual(limiter.is_limited("k"), (False, 0))
            limiter.hit("k")
        self.now += 10
        self.assertEqual(limiter.is_limited("k"), (True, 51))

    def test_window_expiry_releases_the_limit(self) -> None:
        limiter = RateLimiter(max_events=1, window_seconds=60)
        limiter.hit("k")
        self.assertTrue(limiter.is_limited("k")[0])
        self.now += 60
        self.assertFalse(limiter.is_limited("k")[0])

    def test_keys_are_independent_and_reset_clears_one_key(self) -> None:
        limiter = RateLimiter(max_events=1, window_seconds=60)
        limiter.hit("a")
        limiter.hit("b")
        self.assertTrue(limiter.is_limited("a")[0])
        limiter.reset("a")
        self.assertFalse(limiter.is_limited("a")[0])
        self.assertTrue(limiter.is_limited("b")[0])

    def test_check_and_hit_raises_429_with_retry_after(self) -> None:
        from fastapi import HTTPException

        limiter = RateLimiter(max_events=1, window_seconds=60)
        limiter.check_and_hit("k", "stop")
        with self.assertRaises(HTTPException) as ctx:
            limiter.check_and_hit("k", "stop")
        self.assertEqual(ctx.exception.status_code, 429)
        # Zaokrąglenie w górę o sekundę, tak jak w is_limited.
        self.assertEqual(ctx.exception.headers["Retry-After"], "61")

    def test_can_be_disabled_by_env(self) -> None:
        limiter = RateLimiter(max_events=1, window_seconds=60)
        with mock.patch.dict("os.environ", {"BRONET_RATE_LIMITS": "off"}):
            limiter.hit("k")
            limiter.hit("k")
            self.assertEqual(limiter.is_limited("k"), (False, 0))


if __name__ == "__main__":
    unittest.main()
