"""Wspólna konfiguracja testów backendu.

Importuj ten moduł przed `app.*` w każdym pliku testów: ustawia osobną bazę testową
w BRONET_DB_PATH. Baza z seedem jest budowana raz na przebieg i kopiowana przed
każdym testem, zamiast seedować ją od nowa.
"""
import atexit
import os
import shutil
import tempfile
import unittest

_TMP_DIR = tempfile.mkdtemp(prefix="bronet-tests-")
DB_PATH = os.path.join(_TMP_DIR, "test.db")
_TEMPLATE_PATH = os.path.join(_TMP_DIR, "template.db")
os.environ["BRONET_DB_PATH"] = DB_PATH
atexit.register(shutil.rmtree, _TMP_DIR, ignore_errors=True)

from app.database import init_db, invalidate_profiles_cache  # noqa: E402


def _remove_db_files(path: str) -> None:
    for suffix in ("", "-wal", "-shm"):
        if os.path.exists(path + suffix):
            os.remove(path + suffix)


def reset_database() -> None:
    """Przywraca bazę do stanu zaraz po seedzie."""
    if not os.path.exists(_TEMPLATE_PATH):
        _remove_db_files(DB_PATH)
        init_db(seed=True)
        shutil.copy(DB_PATH, _TEMPLATE_PATH)
    _remove_db_files(DB_PATH)
    shutil.copy(_TEMPLATE_PATH, DB_PATH)
    # init_db na skopiowanej bazie jest szybki (seed już jest), a odtwarza stan,
    # który aplikacja ustawia przy starcie.
    init_db(seed=True)
    invalidate_profiles_cache()


class BackendTestCase(unittest.TestCase):
    """Każdy test dostaje świeżą bazę z seedem i wyczyszczone limitery."""

    def setUp(self) -> None:
        reset_database()
        from app.security import ALL_LIMITERS

        for limiter in ALL_LIMITERS:
            limiter.clear()
