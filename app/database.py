import hashlib
import hmac
import json
import os
import random
import re
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent

PL_CHAR_MAP = str.maketrans(
    {
        "ą": "a",
        "ć": "c",
        "ę": "e",
        "ł": "l",
        "ń": "n",
        "ó": "o",
        "ś": "s",
        "ź": "z",
        "ż": "z",
    }
)


class ProfileAuthError(Exception):
    """Raised when a profile requires a password or the provided password is invalid."""


class ProfileValidationError(Exception):
    """Raised when profile data violates platform rules (e.g. non-male name in men-only platform)."""


# Globalny zamek wątkowy chroniący operacje wybijania bloków Chłopchaina
BLOCKCHAIN_LOCK = threading.Lock()

# Rola administratora ekonomii Chłopchain (dostęp tylko dla tego adresu e-mail)
ADMIN_EMAIL = "pawel.zygler@gmail.com"


def is_admin_email(email: Optional[str]) -> bool:
    if not email:
        return False
    return email.strip().lower() == ADMIN_EMAIL


# Męskie wyjątki imion kończących się na literę 'a'
MALE_EXCEPTIONS_ENDING_IN_A = {
    "kuba", "barnaba", "kosma", "bonawentura", "jarema", "zawisza",
    "akira", "mustafa", "luca", "andrea", "sasha", "eliah"
}

# Popularne polskie imiona i zdrobnienia żeńskie
FEMALE_NAME_TOKENS = {
    "kasia", "basia", "ania", "asia", "gosia", "zosia", "ula", "ola", "magda",
    "madzia", "aga", "agatka", "ewa", "krysia", "kaska", "baska", "anka", "olka",
    "monika", "anna", "maria", "katarzyna", "barbara", "elzbieta", "aleksandra",
    "zofia", "patrycja", "natalia", "karolina", "paulina", "weronika", "klaudia",
    "dominika", "kamila", "kinga", "sandra", "dagmara", "sylwia", "renata",
    "beata", "dorota", "iwona", "marzena", "grazyna", "danuta", "halina",
    "krystyna", "teresa", "jadwiga", "irena", "stanislawa", "janina", "czeslawa",
    "helena", "kazimiera", "genowefa", "marianna", "stefania", "wladyslawa",
    "alina", "bogumila", "wieslawa", "julia", "maja", "zuzanna", "hanna", "lena",
    "alicja", "oliwia", "laura", "pola", "antonina", "wiktoria", "emilia", "nikola",
    "gabriela", "martyna", "izabela", "iza", "lucyna", "bozena", "malgorzata",
    "marcelina", "adriana", "adrianne", "kornelia", "daria", "sonia", "aneta",
    "edyta", "sabina", "marta", "jagoda", "kalina", "roksana", "lilianna",
    "miriam", "carmen", "noemi", "ruth", "beatrice", "ines", "inez"
}


def is_female_name(full_name: str) -> bool:
    """Sprawdza, czy imię jest imieniem żeńskim (platforma jest wyłącznie dla mężczyzn)."""
    if not full_name:
        return False
    cleaned = normalize_text(full_name)
    parts = cleaned.split()
    if not parts:
        return False
    first_token = re.sub(r"[^a-z]", "", parts[0])
    if not first_token:
        return False
    if first_token in FEMALE_NAME_TOKENS:
        return True
    if first_token.endswith("a") and first_token not in MALE_EXCEPTIONS_ENDING_IN_A:
        return True
    return False


def is_female_email(email: str) -> bool:
    """Sprawdza, czy adres e-mail wskazuje na profil żeński (np. kasia@, basia.nowak@)."""
    if not email or "@" not in email:
        return False
    local_part = email.split("@")[0].lower()
    local_tokens = re.sub(r"[^a-z]", " ", normalize_text(local_part)).split()
    if not local_tokens:
        return False
    first = local_tokens[0]
    if first in FEMALE_NAME_TOKENS:
        return True
    if first.endswith("a") and first not in MALE_EXCEPTIONS_ENDING_IN_A:
        return True
    return False


def validate_men_only(name: str, email: str = "") -> None:
    """Weryfikuje regułę men-only — odrzuca żeńskie imiona i adresy e-mail."""
    if is_female_name(name) or is_female_email(email):
        raise ProfileValidationError(
            "Platforma Bronet jest wyłącznie dla facetów (men only). Dozwolone są tylko męskie profile."
        )


def get_db_path() -> Path:
    env_path = os.environ.get("BRONET_DB_PATH")
    if env_path:
        return Path(env_path)
    volume_dir = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if volume_dir:
        return Path(volume_dir) / "bronet.db"
    return BASE_DIR / "bronet.db"


def normalize_text(value: str) -> str:
    """Lowercase, collapse whitespace, and strip Polish diacritics for resilient matching."""
    collapsed = " ".join(str(value or "").strip().lower().split())
    return collapsed.translate(PL_CHAR_MAP)


def normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def hash_password(raw_password: str) -> str:
    """Hash any non-empty password with PBKDF2-HMAC-SHA256 (no complexity restrictions)."""
    if not raw_password:
        return ""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("ascii"),
        120_000,
    ).hex()
    return f"{salt}${dk}"


def verify_password(raw_password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return True
    if not raw_password or "$" not in stored_hash:
        return False
    salt, expected_dk = stored_hash.split("$", 1)
    actual_dk = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("ascii"),
        120_000,
    ).hex()
    return hmac.compare_digest(actual_dk, expected_dk)


def clean_skills(raw_skills: List[str]) -> List[str]:
    """Split comma-separated entries, trim, and deduplicate while preserving display form."""
    result: List[str] = []
    seen = set()
    for entry in raw_skills or []:
        if not entry:
            continue
        parts = [p.strip().rstrip(".") for p in str(entry).split(",")]
        for part in parts:
            cleaned = " ".join(part.split())
            if not cleaned:
                continue
            norm = normalize_text(cleaned)
            if norm and norm not in seen:
                seen.add(norm)
                result.append(cleaned)
    return result


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


PL_CITIES = [
    ("Warszawa", 52.2297, 21.0122),
    ("Kraków", 50.0647, 19.9450),
    ("Wrocław", 51.1079, 17.0385),
    ("Poznań", 52.4064, 16.9252),
    ("Gdańsk", 54.3520, 18.6466),
    ("Łódź", 51.7592, 19.4560),
    ("Szczecin", 53.4285, 14.5528),
    ("Lublin", 51.2465, 22.5684),
    ("Białystok", 53.1325, 23.1688),
    ("Katowice", 50.2649, 19.0238),
    ("Gdynia", 54.5189, 18.5305),
    ("Częstochowa", 50.8118, 19.1203),
    ("Radom", 51.4027, 21.1471),
    ("Toruń", 53.0138, 18.5984),
    ("Rzeszów", 50.0412, 21.9991),
    ("Kielce", 50.8661, 20.6286),
    ("Gliwice", 50.2945, 18.6714),
    ("Olsztyn", 53.7784, 20.4801),
    ("Bielsko-Biała", 49.8224, 19.0469),
    ("Zielona Góra", 51.9356, 15.5062),
    ("Opole", 50.6751, 17.9213),
    ("Gorzów Wielkopolski", 52.7368, 15.2288),
    ("Płock", 52.5463, 19.7065),
    ("Koszalin", 54.1944, 16.1722),
    ("Kalisz", 51.7611, 18.0910),
    ("Legnica", 51.2070, 16.1553),
]

SEED_PROFILES = [
    {
        "name": "Marek",
        "email": "marek@bronet.pl",
        "password": "bronet",
        "can_help": ["qa", "it", "związki", "relacje męsko-damskie"],
        "need_help": ["finanse", "sdlc", "realizacja pomysłów"],
        "contact": "marek@bronet.pl",
        "bio": "Tester oprogramowania od 6 lat. Chętnie pomogę wejść w IT lub pogadać o relacjach.",
        "location_name": "Warszawa",
        "lat": 52.2297,
        "lng": 21.0122,
        "share_location": 1,
    },
    {
        "name": "Kamil",
        "email": "kamil@bronet.pl",
        "password": "bronet",
        "can_help": ["finanse", "budżet osobisty", "excel", "realizacja pomysłów"],
        "need_help": ["it", "strona www", "angielski"],
        "contact": "kamil@bronet.pl",
        "bio": "Ogarniam finanse osobiste i pomagam przekuwać luźne pomysły w konkretny plan.",
        "location_name": "Kraków",
        "lat": 50.0647,
        "lng": 19.9450,
        "share_location": 1,
    },
    {
        "name": "Tomek",
        "email": "tomek@bronet.pl",
        "password": "bronet",
        "can_help": ["sdlc", "zarządzanie projektami", "it", "architektura systemów"],
        "need_help": ["qa", "relacje męsko-damskie", "trening siłowy"],
        "contact": "tomek@bronet.pl",
        "bio": "Prowadzę zespoły produktowe. Pomogę uporządkować proces wytwarzania oprogramowania.",
        "location_name": "Wrocław",
        "lat": 51.1079,
        "lng": 17.0385,
        "share_location": 1,
    },
    {
        "name": "Michał",
        "email": "michal@bronet.pl",
        "password": "bronet",
        "can_help": ["ux/ui", "figma", "angielski", "komunikacja"],
        "need_help": ["finanse", "podatki b2b", "realizacja pomysłów"],
        "contact": "michal@bronet.pl",
        "bio": "Projektuję minimalistyczne interfejsy mobilne i webowe.",
        "location_name": "Poznań",
        "lat": 52.4064,
        "lng": 16.9252,
        "share_location": 1,
    },
    {
        "name": "Piotr",
        "email": "piotr@bronet.pl",
        "password": "bronet",
        "can_help": ["podatki b2b", "umowy", "trening siłowy", "bieganie"],
        "need_help": ["ux/ui", "it", "qa"],
        "contact": "piotr@bronet.pl",
        "bio": "Pomogę z formalnościami na działalności i rozpisaniem prostego planu treningowego.",
        "location_name": "Gdańsk",
        "lat": 54.3520,
        "lng": 18.6466,
        "share_location": 1,
    },
]


ACHIEVEMENTS_SEED = [
    {
        "id": "first_aid_1",
        "title": "Pierwsza pomoc!",
        "description": "Zdobądź swój 1. Chłopocoin (+1 CC) za bezinteresowną pomoc innemu chłopowi.",
        "category": "first_aid",
        "rarity": "common",
        "points": 10,
        "icon": "🩹",
        "is_server_first": 0,
        "criteria_type": "coins_ge",
        "criteria_value": 1,
    },
    {
        "id": "first_aid_2",
        "title": "Pomocna dłoń",
        "description": "Zgromadź 5 Chłopocoinów pomagając sąsiadom w potrzebie.",
        "category": "first_aid",
        "rarity": "rare",
        "points": 25,
        "icon": "🤝",
        "is_server_first": 0,
        "criteria_type": "coins_ge",
        "criteria_value": 5,
    },
    {
        "id": "first_aid_3",
        "title": "Mistrz pierwszej pomocy",
        "description": "Zgromadź 25 Chłopocoinów w swoim portfelu na Chłopchainie.",
        "category": "first_aid",
        "rarity": "epic",
        "points": 50,
        "icon": "⭐",
        "is_server_first": 0,
        "criteria_type": "coins_ge",
        "criteria_value": 25,
    },
    {
        "id": "first_aid_4",
        "title": "Chłopski filantrop",
        "description": "Osiągnij imponujące 50 Chłopocoinów wypracowanych w sieci.",
        "category": "first_aid",
        "rarity": "legendary",
        "points": 100,
        "icon": "💎",
        "is_server_first": 0,
        "criteria_type": "coins_ge",
        "criteria_value": 50,
    },
    {
        "id": "first_aid_5",
        "title": "Arcychłop dobrodziej",
        "description": "Zgromadź 100 Chłopocoinów — legendarna ranga dobroczynności na Chłopchainie.",
        "category": "first_aid",
        "rarity": "realm_first",
        "points": 200,
        "icon": "👑",
        "is_server_first": 0,
        "criteria_type": "coins_ge",
        "criteria_value": 100,
    },
    {
        "id": "server_first_10",
        "title": "Server first: 10 Coinów!",
        "description": "Pierwszy chłop na całym serwerze, który zdobył 10 Chłopocoinów.",
        "category": "server_first",
        "rarity": "realm_first",
        "points": 100,
        "icon": "⚡",
        "is_server_first": 1,
        "criteria_type": "server_first_coins",
        "criteria_value": 10,
    },
    {
        "id": "server_first_50",
        "title": "Server first: 50 Coinów!",
        "description": "Pierwszy chłop na całym serwerze, który zdobył 50 Chłopocoinów.",
        "category": "server_first",
        "rarity": "realm_first",
        "points": 200,
        "icon": "🌟",
        "is_server_first": 1,
        "criteria_type": "server_first_coins",
        "criteria_value": 50,
    },
    {
        "id": "server_first_block",
        "title": "Server first: Pierwszy Blok!",
        "description": "Historyczne wybicie pierwszego bloku po Genesis na sieci Chłopchain.",
        "category": "server_first",
        "rarity": "realm_first",
        "points": 100,
        "icon": "🧱",
        "is_server_first": 1,
        "criteria_type": "server_first_block",
        "criteria_value": 1,
    },
    {
        "id": "billboard_hot_200",
        "title": "Billboard hot 200",
        "description": "Pozostań na pozycji #1 w Rankingu Pomocnych Chłopów przez 7 dni (lub cykli sieci).",
        "category": "ranking",
        "rarity": "legendary",
        "points": 150,
        "icon": "📻",
        "is_server_first": 0,
        "criteria_type": "billboard_hot_200",
        "criteria_value": 7,
    },
    {
        "id": "rank_top_3",
        "title": "Na podium chwały",
        "description": "Zajmij miejsce w pierwszej trójce Rankingu Pomocnych Chłopów.",
        "category": "ranking",
        "rarity": "rare",
        "points": 30,
        "icon": "🥉",
        "is_server_first": 0,
        "criteria_type": "rank_top_3",
        "criteria_value": 3,
    },
    {
        "id": "first_block",
        "title": "Mój pierwszy blok",
        "description": "Potwierdź wzajemną pomoc z innym chłopem i weź udział w wybiciu bloku transakcji.",
        "category": "economy",
        "rarity": "common",
        "points": 15,
        "icon": "⛏️",
        "is_server_first": 0,
        "criteria_type": "blocks_ge",
        "criteria_value": 1,
    },
    {
        "id": "multi_skilled",
        "title": "Złota rączka",
        "description": "Zadeklaruj co najmniej 3 umiejętności, w których potrafisz pomóc innym.",
        "category": "social",
        "rarity": "rare",
        "points": 20,
        "icon": "🛠️",
        "is_server_first": 0,
        "criteria_type": "skills_ge",
        "criteria_value": 3,
    },
    {
        "id": "profile_complete",
        "title": "Chłop z krwi i kości",
        "description": "Wypełnij kompletny profil: imię, miasto, bio oraz umiejętności.",
        "category": "social",
        "rarity": "common",
        "points": 10,
        "icon": "👤",
        "is_server_first": 0,
        "criteria_type": "profile_complete",
        "criteria_value": 1,
    },
    {
        "id": "chat_talker",
        "title": "Gaduła na radiu",
        "description": "Napisz co najmniej 5 wiadomości na Chłopczacie.",
        "category": "social",
        "rarity": "common",
        "points": 10,
        "icon": "💬",
        "is_server_first": 0,
        "criteria_type": "chat_messages_ge",
        "criteria_value": 5,
    },
    {
        "id": "direct_messenger",
        "title": "Szybki priv",
        "description": "Napisz pierwszą prywatną wiadomość (DM) do innego chłopa.",
        "category": "social",
        "rarity": "common",
        "points": 10,
        "icon": "✉️",
        "is_server_first": 0,
        "criteria_type": "dm_messages_ge",
        "criteria_value": 1,
    },
]


def init_db(seed: bool = True) -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                name_normalized TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL DEFAULT '',
                contact TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profile_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('can_help', 'need_help')),
                skill TEXT NOT NULL,
                skill_normalized TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id
                ON profile_skills(profile_id);
            CREATE INDEX IF NOT EXISTS idx_profile_skills_norm
                ON profile_skills(kind, skill_normalized);
            """
        )
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(profiles)").fetchall()}
        if "email" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN email TEXT NOT NULL DEFAULT '';")
        if "password_hash" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';")
        if "location_name" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN location_name TEXT NOT NULL DEFAULT '';")
        if "lat" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN lat REAL;")
        if "lng" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN lng REAL;")
        if "share_location" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN share_location INTEGER NOT NULL DEFAULT 0;")
        if "chlopocoin_balance" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN chlopocoin_balance INTEGER NOT NULL DEFAULT 0;")
        if "role" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';")
        if "achievement_points" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN achievement_points INTEGER NOT NULL DEFAULT 0;")
        conn.execute("UPDATE profiles SET role = 'admin' WHERE LOWER(TRIM(email)) = ?;", (ADMIN_EMAIL,))
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_share_location ON profiles(share_location);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_achievement_points ON profiles(achievement_points);")

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chlopocoin_confirmations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                to_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                UNIQUE(from_profile_id, to_profile_id)
            );

            CREATE TABLE IF NOT EXISTS chlopocoin_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                block_index INTEGER NOT NULL,
                profile_a_id INTEGER NOT NULL,
                profile_b_id INTEGER NOT NULL,
                profile_a_name TEXT NOT NULL DEFAULT '',
                profile_b_name TEXT NOT NULL DEFAULT '',
                block_hash TEXT NOT NULL UNIQUE,
                prev_hash TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(profile_a_id, profile_b_id)
            );

            CREATE INDEX IF NOT EXISTS idx_chlopocoin_conf_pair
                ON chlopocoin_confirmations(from_profile_id, to_profile_id);
            CREATE INDEX IF NOT EXISTS idx_chlopocoin_blocks_profiles
                ON chlopocoin_blocks(profile_a_id, profile_b_id);
            CREATE INDEX IF NOT EXISTS idx_chlopocoin_blocks_index
                ON chlopocoin_blocks(block_index);
            CREATE INDEX IF NOT EXISTS idx_profiles_chlopocoin
                ON profiles(chlopocoin_balance);

            CREATE TABLE IF NOT EXISTS economy_simulator_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS global_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
                author_name TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_id ON global_chat_messages(id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON global_chat_messages(created_at);

            CREATE TABLE IF NOT EXISTS direct_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                deleted_by_sender INTEGER NOT NULL DEFAULT 0,
                deleted_by_receiver INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_direct_chat_pair ON direct_chat_messages(sender_id, receiver_id);
            CREATE INDEX IF NOT EXISTS idx_direct_chat_receiver_unread ON direct_chat_messages(receiver_id, is_read);
            CREATE INDEX IF NOT EXISTS idx_direct_chat_created ON direct_chat_messages(created_at);

            CREATE TABLE IF NOT EXISTS achievements_definitions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                rarity TEXT NOT NULL,
                points INTEGER NOT NULL DEFAULT 10,
                icon TEXT NOT NULL DEFAULT '🏆',
                is_server_first INTEGER NOT NULL DEFAULT 0,
                first_achieved_by_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
                first_achieved_by_name TEXT NOT NULL DEFAULT '',
                first_achieved_at TEXT NOT NULL DEFAULT '',
                criteria_type TEXT NOT NULL,
                criteria_value INTEGER NOT NULL DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_achievements_def_cat ON achievements_definitions(category);
            CREATE INDEX IF NOT EXISTS idx_achievements_def_sf ON achievements_definitions(is_server_first);

            CREATE TABLE IF NOT EXISTS profile_achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                achievement_id TEXT NOT NULL REFERENCES achievements_definitions(id) ON DELETE CASCADE,
                achieved_at TEXT NOT NULL,
                notified INTEGER NOT NULL DEFAULT 0,
                UNIQUE(profile_id, achievement_id)
            );

            CREATE INDEX IF NOT EXISTS idx_profile_achievements_pid ON profile_achievements(profile_id);
            CREATE INDEX IF NOT EXISTS idx_profile_achievements_aid ON profile_achievements(achievement_id);
            CREATE INDEX IF NOT EXISTS idx_profile_achievements_notified ON profile_achievements(profile_id, notified);
            """
        )

        # Migracja tabeli chlopocoin_blocks (usunięcie ON DELETE CASCADE dla niezmienności księgi bloków oraz dodanie kolumn nazw)
        col_names = [r["name"] for r in conn.execute("PRAGMA table_info(chlopocoin_blocks)").fetchall()]
        fk_list = conn.execute("PRAGMA foreign_key_list(chlopocoin_blocks)").fetchall()
        has_cascade = any(r[2] == "profiles" and r[6] == "CASCADE" for r in fk_list)
        if has_cascade or "profile_a_name" not in col_names:
            conn.execute("PRAGMA foreign_keys = OFF;")
            conn.execute("ALTER TABLE chlopocoin_blocks RENAME TO chlopocoin_blocks_old;")
            conn.execute("""
                CREATE TABLE chlopocoin_blocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    block_index INTEGER NOT NULL,
                    profile_a_id INTEGER NOT NULL,
                    profile_b_id INTEGER NOT NULL,
                    profile_a_name TEXT NOT NULL DEFAULT '',
                    profile_b_name TEXT NOT NULL DEFAULT '',
                    block_hash TEXT NOT NULL UNIQUE,
                    prev_hash TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    UNIQUE(profile_a_id, profile_b_id)
                );
            """)
            conn.execute("""
                INSERT INTO chlopocoin_blocks (id, block_index, profile_a_id, profile_b_id, block_hash, prev_hash, created_at)
                SELECT id, block_index, profile_a_id, profile_b_id, block_hash, prev_hash, created_at
                FROM chlopocoin_blocks_old;
            """)
            conn.execute("DROP TABLE chlopocoin_blocks_old;")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chlopocoin_blocks_profiles ON chlopocoin_blocks(profile_a_id, profile_b_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chlopocoin_blocks_index ON chlopocoin_blocks(block_index);")
            conn.execute("PRAGMA foreign_keys = ON;")

        # Uzupełnij nazwy uczestników w blokach, jeśli nie są ustawione
        conn.execute("""
            UPDATE chlopocoin_blocks
            SET profile_a_name = COALESCE((SELECT name FROM profiles WHERE profiles.id = chlopocoin_blocks.profile_a_id), profile_a_name, 'Chłop'),
                profile_b_name = COALESCE((SELECT name FROM profiles WHERE profiles.id = chlopocoin_blocks.profile_b_id), profile_b_name, 'Chłop')
            WHERE profile_a_name = '' OR profile_b_name = ''
        """)

        # Weryfikacja i zapewnienie 100% kryptograficznej ciągłości łańcucha bloków
        all_blocks = conn.execute("SELECT id, profile_a_id, profile_b_id, created_at FROM chlopocoin_blocks ORDER BY id ASC").fetchall()
        if all_blocks:
            prev_hash = "0" * 64
            for idx, b in enumerate(all_blocks, start=1):
                p1 = min(b["profile_a_id"], b["profile_b_id"])
                p2 = max(b["profile_a_id"], b["profile_b_id"])
                ts = b["created_at"]
                payload = f"{idx}:{prev_hash}:{p1}:{p2}:{ts}:proof_of_chlop_help"
                b_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
                row = conn.execute("SELECT block_index, block_hash, prev_hash FROM chlopocoin_blocks WHERE id = ?", (b["id"],)).fetchone()
                if row["block_index"] != idx or row["block_hash"] != b_hash or row["prev_hash"] != prev_hash:
                    conn.execute(
                        "UPDATE chlopocoin_blocks SET block_index = ?, block_hash = ?, prev_hash = ? WHERE id = ?",
                        (idx, b_hash, prev_hash, b["id"])
                    )
                prev_hash = b_hash

        # Usunięcie starych profili żeńskich, jeśli istnieją w trwałej bazie (men only)
        rows = conn.execute("SELECT id, name, email FROM profiles").fetchall()
        female_ids = [
            r["id"]
            for r in rows
            if is_female_name(r["name"]) or is_female_email(r["email"])
        ]
        if female_ids:
            ph = ",".join("?" for _ in female_ids)
            conn.execute(f"DELETE FROM profiles WHERE id IN ({ph})", female_ids)

        if seed:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
            current_count = row["cnt"] if row else 0
            if current_count == 0:
                with conn:
                    for item in SEED_PROFILES:
                        _insert_profile_in_tx(conn, item)

            seed_json_path = BASE_DIR / "app" / "seed_profiles.json"
            if seed_json_path.exists():
                cnt_row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
                if cnt_row and cnt_row["cnt"] < 1500:
                    existing_emails = {
                        r["email"]
                        for r in conn.execute(
                            "SELECT email FROM profiles WHERE email != ''"
                        ).fetchall()
                    }
                    try:
                        with open(seed_json_path, "r", encoding="utf-8") as f:
                            extra_profiles = json.load(f)
                        with conn:
                            for item in extra_profiles:
                                em = normalize_email(item.get("email"))
                                if em and em in existing_emails:
                                    continue
                                _insert_profile_in_tx(conn, item)
                                if em:
                                    existing_emails.add(em)
                    except Exception as err:
                        print(f"Warning: Failed to load seed_profiles.json: {err}")

            seed_it_json_path = BASE_DIR / "app" / "seed_it_profiles.json"
            if seed_it_json_path.exists():
                cnt_row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
                if cnt_row and cnt_row["cnt"] < 3000:
                    existing_emails = {
                        r["email"]
                        for r in conn.execute(
                            "SELECT email FROM profiles WHERE email != ''"
                        ).fetchall()
                    }
                    try:
                        with open(seed_it_json_path, "r", encoding="utf-8") as f:
                            it_profiles = json.load(f)
                        with conn:
                            for item in it_profiles:
                                em = normalize_email(item.get("email"))
                                if em and em in existing_emails:
                                    continue
                                _insert_profile_in_tx(conn, item)
                                if em:
                                    existing_emails.add(em)
                    except Exception as err:
                        print(f"Warning: Failed to load seed_it_profiles.json: {err}")

        # Jeśli żaden profil nie ma jeszcze oznaczonej lokalizacji, przypisz przykładowe polskie miasta
        loc_row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles WHERE share_location = 1").fetchone()
        if loc_row and loc_row["cnt"] == 0:
            profiles_to_loc = conn.execute("SELECT id FROM profiles ORDER BY id ASC LIMIT 250").fetchall()
            for r in profiles_to_loc:
                city, lat, lng = PL_CITIES[r["id"] % len(PL_CITIES)]
                conn.execute(
                    "UPDATE profiles SET location_name = ?, lat = ?, lng = ?, share_location = 1 WHERE id = ?",
                    (city, lat, lng, r["id"]),
                )

        # Jeśli seed=True i czat jest pusty, dodaj pierwsze wiadomości powitalne
        if seed:
            chat_count = conn.execute("SELECT COUNT(*) AS c FROM global_chat_messages").fetchone()["c"]
            if chat_count == 0:
                now_iso = datetime.now(timezone.utc).isoformat()
                seed_messages = [
                    (None, "Marek (Warszawa)", "Siemanko chłopy! Działa Chłopczat na żywo z telefonu i komputera. 🤝", now_iso),
                    (None, "Tomek (Wrocław)", "Potwierdzam, widać wiadomości natychmiastowo. Piszcie śmiało jak ktoś potrzebuje pomocy!", now_iso),
                ]
                conn.executemany(
                    "INSERT INTO global_chat_messages (profile_id, author_name, message, created_at) VALUES (?, ?, ?, ?)",
                    seed_messages,
                )

        # Jeśli seed=True i łańcuch bloków jest pusty, zainicjalizuj historyczną księgę Chłopchaina
        if seed:
            count_blocks_row = conn.execute("SELECT COUNT(*) AS cnt FROM chlopocoin_blocks").fetchone()
            if count_blocks_row and count_blocks_row["cnt"] == 0:
                seed_profs = conn.execute("SELECT id, name FROM profiles ORDER BY id ASC LIMIT 16").fetchall()
                if len(seed_profs) >= 8:
                    history_pairs = [
                        (seed_profs[0]["id"], seed_profs[1]["id"], "2026-11-01T10:15:00+00:00"),
                        (seed_profs[2]["id"], seed_profs[3]["id"], "2026-11-02T12:30:00+00:00"),
                        (seed_profs[4]["id"], seed_profs[5]["id"], "2026-11-03T14:45:00+00:00"),
                        (seed_profs[6]["id"], seed_profs[7]["id"], "2026-11-04T09:20:00+00:00"),
                        (seed_profs[0]["id"], seed_profs[2]["id"], "2026-11-04T16:10:00+00:00"),
                        (seed_profs[1]["id"], seed_profs[3]["id"], "2026-11-05T11:05:00+00:00"),
                    ]
                    prev_hash = "0" * 64
                    for idx, (p_from, p_to, timestamp) in enumerate(history_pairs, start=1):
                        p1, p2 = min(p_from, p_to), max(p_from, p_to)
                        conn.execute(
                            "INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at) VALUES (?, ?, ?)",
                            (p1, p2, timestamp),
                        )
                        conn.execute(
                            "INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at) VALUES (?, ?, ?)",
                            (p2, p1, timestamp),
                        )
                        payload = f"{idx}:{prev_hash}:{p1}:{p2}:{timestamp}:proof_of_chlop_help"
                        b_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
                        conn.execute(
                            "INSERT INTO chlopocoin_blocks (block_index, profile_a_id, profile_b_id, block_hash, prev_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                            (idx, p1, p2, b_hash, prev_hash, timestamp),
                        )
                        conn.execute(
                            "UPDATE profiles SET chlopocoin_balance = chlopocoin_balance + 1 WHERE id IN (?, ?)",
                            (p1, p2),
                        )
                        prev_hash = b_hash

                    if len(seed_profs) >= 6:
                        conn.execute(
                            "INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at) VALUES (?, ?, ?)",
                            (seed_profs[5]["id"], seed_profs[0]["id"], "2026-11-05T18:00:00+00:00"),
                        )

        init_achievements(conn)
        if seed:
            evaluate_all_achievements(conn)

        invalidate_profiles_cache()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_profile_in_tx(conn: sqlite3.Connection, data: Dict[str, Any]) -> int:
    now = _now_iso()
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    validate_men_only(name, email)
    pwd_hash = data.get("password_hash")
    if not pwd_hash:
        raw_password = str(data.get("password") or "")
        pwd_hash = hash_password(raw_password) if raw_password else ""
    contact = str(data.get("contact") or "").strip()
    if not contact and email:
        contact = email

    location_name = str(data.get("location_name") or "").strip()
    raw_lat = data.get("lat")
    raw_lng = data.get("lng")
    try:
        lat = float(raw_lat) if raw_lat is not None else None
    except (ValueError, TypeError):
        lat = None
    try:
        lng = float(raw_lng) if raw_lng is not None else None
    except (ValueError, TypeError):
        lng = None
    share_location = 1 if (data.get("share_location") or (lat is not None and lng is not None)) else 0
    role = "admin" if is_admin_email(email) else "user"

    cur = conn.execute(
        """
        INSERT INTO profiles (
            name, name_normalized, email, password_hash, contact, bio,
            location_name, lat, lng, share_location, role, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            normalize_text(name),
            email,
            pwd_hash,
            contact,
            str(data.get("bio") or "").strip(),
            location_name,
            lat,
            lng,
            share_location,
            role,
            now,
            now,
        ),
    )
    profile_id = int(cur.lastrowid)
    _save_skills_in_tx(
        conn,
        profile_id,
        clean_skills(data.get("can_help", [])),
        clean_skills(data.get("need_help", [])),
    )
    return profile_id


def _save_skills_in_tx(
    conn: sqlite3.Connection,
    profile_id: int,
    can_help: List[str],
    need_help: List[str],
) -> None:
    conn.execute("DELETE FROM profile_skills WHERE profile_id = ?", (profile_id,))
    rows = []
    for skill in can_help:
        rows.append((profile_id, "can_help", skill, normalize_text(skill)))
    for skill in need_help:
        rows.append((profile_id, "need_help", skill, normalize_text(skill)))
    if rows:
        conn.executemany(
            """
            INSERT INTO profile_skills (profile_id, kind, skill, skill_normalized)
            VALUES (?, ?, ?, ?)
            """,
            rows,
        )


def _hydrate_profiles(conn: sqlite3.Connection, profile_rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    if not profile_rows:
        return []
    ids = [r["id"] for r in profile_rows]
    by_profile: Dict[int, Dict[str, List[str]]] = {
        pid: {"can_help": [], "need_help": []} for pid in ids
    }
    chunk_size = 500
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        placeholders = ",".join("?" for _ in chunk)
        skill_rows = conn.execute(
            f"""
            SELECT profile_id, kind, skill
            FROM profile_skills
            WHERE profile_id IN ({placeholders})
            ORDER BY id ASC
            """,
            chunk,
        ).fetchall()
        for sr in skill_rows:
            by_profile[sr["profile_id"]][sr["kind"]].append(sr["skill"])

    hydrated = []
    for r in profile_rows:
        pid = r["id"]
        row_keys = r.keys()
        pwd_hash = r["password_hash"] if "password_hash" in row_keys else ""
        raw_lat = r["lat"] if "lat" in row_keys else None
        raw_lng = r["lng"] if "lng" in row_keys else None
        try:
            lat = float(raw_lat) if raw_lat is not None else None
        except (ValueError, TypeError):
            lat = None
        try:
            lng = float(raw_lng) if raw_lng is not None else None
        except (ValueError, TypeError):
            lng = None

        email_val = (r["email"] if "email" in row_keys else "") or ""
        role_val = r["role"] if "role" in row_keys and r["role"] else None
        if not role_val or is_admin_email(email_val):
            role_val = "admin" if is_admin_email(email_val) else "user"

        hydrated.append(
            {
                "id": pid,
                "name": r["name"],
                "email": email_val,
                "role": role_val,
                "has_password": bool(pwd_hash),
                "can_help": by_profile[pid]["can_help"],
                "need_help": by_profile[pid]["need_help"],
                "contact": r["contact"],
                "bio": r["bio"],
                "location_name": r["location_name"] if "location_name" in row_keys and r["location_name"] else "",
                "lat": lat,
                "lng": lng,
                "share_location": bool(r["share_location"]) if "share_location" in row_keys and r["share_location"] else False,
                "chlopocoin_balance": int(r["chlopocoin_balance"]) if "chlopocoin_balance" in row_keys and r["chlopocoin_balance"] is not None else 0,
                "achievement_points": int(r["achievement_points"]) if "achievement_points" in row_keys and r["achievement_points"] is not None else 0,
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
        )
    return hydrated


_CACHE_LOCK = threading.RLock()
_PROFILES_CACHE: Optional[List[Dict[str, Any]]] = None


def invalidate_profiles_cache() -> None:
    global _PROFILES_CACHE
    with _CACHE_LOCK:
        _PROFILES_CACHE = None


def update_cached_balances(p_ids: List[int]) -> None:
    """Aktualizuje saldo w pamięci podręcznej dla podanych ID profili bez kosztownego re-hydrowania 3000 profili."""
    global _PROFILES_CACHE
    with _CACHE_LOCK:
        if _PROFILES_CACHE is not None:
            id_set = set(p_ids)
            for p in _PROFILES_CACHE:
                if p["id"] in id_set:
                    p["chlopocoin_balance"] = p.get("chlopocoin_balance", 0) + 1


def _get_cached_profiles() -> List[Dict[str, Any]]:
    global _PROFILES_CACHE
    with _CACHE_LOCK:
        if _PROFILES_CACHE is None:
            with get_db() as conn:
                all_rows = conn.execute(
                    "SELECT * FROM profiles ORDER BY updated_at DESC, id DESC"
                ).fetchall()
                _PROFILES_CACHE = _hydrate_profiles(conn, all_rows)
        return _PROFILES_CACHE


def list_profiles(query: str = "", mode: str = "all") -> List[Dict[str, Any]]:
    q_norm = normalize_text(query)
    profiles = _get_cached_profiles()

    if not q_norm:
        return profiles

    terms = [normalize_text(t) for t in query.split(",") if normalize_text(t)]
    if not terms:
        return profiles

    filtered = []
    for p in profiles:
        can_norms = [normalize_text(s) for s in p["can_help"]]
        need_norms = [normalize_text(s) for s in p["need_help"]]
        name_norm = normalize_text(p["name"])
        email_norm = normalize_text(p.get("email") or "")
        contact_norm = normalize_text(p.get("contact") or "")
        bio_norm = normalize_text(p["bio"])

        matched = False
        for term in terms:
            if "@" in term:
                contact_tokens = (
                    contact_norm.replace("|", " ").replace(",", " ").replace(";", " ").split()
                )
                is_email_match = (
                    email_norm == term
                    or email_norm.startswith(term)
                    or any(t == term or t.startswith(term) for t in contact_tokens if "@" in t)
                )
            else:
                is_email_match = term in email_norm or term in contact_norm
            if mode == "can_help":
                if any(term in s for s in can_norms) or ("@" in term and is_email_match):
                    matched = True
                    break
            elif mode == "need_help":
                if any(term in s for s in need_norms) or ("@" in term and is_email_match):
                    matched = True
                    break
            else:
                if (
                    any(term in s for s in can_norms)
                    or any(term in s for s in need_norms)
                    or term in name_norm
                    or is_email_match
                    or term in bio_norm
                ):
                    matched = True
                    break
        if matched:
            filtered.append(p)

    return filtered


def get_profile(profile_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            return None
        return _hydrate_profiles(conn, [row])[0]


def authenticate_profile_by_email(email: str, password: str = "") -> Optional[Dict[str, Any]]:
    """
    Load a profile by email, requiring a password.
    If a legacy profile has no password hash yet, sets the provided password on login.
    """
    cleaned = normalize_email(email)
    if not cleaned:
        return None
    if not password:
        raise ProfileAuthError("Podaj hasło.")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
            (cleaned,),
        ).fetchone()
        if not row:
            return None
        stored_hash = row["password_hash"] or ""
        if stored_hash:
            if not verify_password(password, stored_hash):
                raise ProfileAuthError("Nieprawidłowe hasło dla tego profilu.")
        else:
            upgraded_hash = hash_password(password)
            conn.execute(
                "UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?",
                (upgraded_hash, _now_iso(), row["id"]),
            )
            row = conn.execute("SELECT * FROM profiles WHERE id = ?", (row["id"],)).fetchone()
        return _hydrate_profiles(conn, [row])[0]


def get_profile_by_email(email: str) -> Optional[Dict[str, Any]]:
    return authenticate_profile_by_email(email, password="")


def create_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    validate_men_only(name, email)
    if email:
        with get_db() as conn:
            existing_row = conn.execute(
                "SELECT id FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
                (email,),
            ).fetchone()
        if existing_row:
            updated = update_profile(existing_row["id"], data)
            if updated:
                return updated
    raw_password = str(data.get("password") or "")
    if not raw_password:
        raise ProfileAuthError("Hasło jest wymagane.")
    with get_db() as conn:
        profile_id = _insert_profile_in_tx(conn, data)
        try:
            evaluate_achievements_for_profile(conn, profile_id)
        except Exception:
            pass
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        hydrated = _hydrate_profiles(conn, [row])[0]
    invalidate_profiles_cache()
    return hydrated


def update_profile(profile_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, password_hash FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not existing:
            return None

        existing_hash = existing["password_hash"] or ""
        provided_password = str(data.get("password") or "")
        new_password = str(data.get("new_password") or "")

        if existing_hash:
            if not verify_password(provided_password, existing_hash):
                if not provided_password:
                    raise ProfileAuthError("Podaj hasło profilu, aby zapisać zmiany.")
                raise ProfileAuthError("Nieprawidłowe hasło — nie można zapisać zmian.")
            effective_hash = hash_password(new_password) if new_password else existing_hash
        else:
            chosen_pw = new_password or provided_password
            if not chosen_pw:
                raise ProfileAuthError("Hasło jest wymagane — ustaw hasło, aby zapisać profil.")
            effective_hash = hash_password(chosen_pw)

        now = _now_iso()
        name = str(data.get("name") or "").strip()
        email = normalize_email(data.get("email"))
        validate_men_only(name, email)
        contact = str(data.get("contact") or "").strip()
        if not contact and email:
            contact = email

        location_name = str(data.get("location_name") or "").strip()
        raw_lat = data.get("lat")
        raw_lng = data.get("lng")
        try:
            lat = float(raw_lat) if raw_lat is not None else None
        except (ValueError, TypeError):
            lat = None
        try:
            lng = float(raw_lng) if raw_lng is not None else None
        except (ValueError, TypeError):
            lng = None
        share_location = 1 if (data.get("share_location") or (lat is not None and lng is not None)) else 0
        role = "admin" if is_admin_email(email) else "user"

        conn.execute(
            """
            UPDATE profiles
            SET name = ?, name_normalized = ?, email = ?, password_hash = ?, contact = ?, bio = ?,
                location_name = ?, lat = ?, lng = ?, share_location = ?, role = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                name,
                normalize_text(name),
                email,
                effective_hash,
                contact,
                str(data.get("bio") or "").strip(),
                location_name,
                lat,
                lng,
                share_location,
                role,
                now,
                profile_id,
            ),
        )
        _save_skills_in_tx(
            conn,
            profile_id,
            clean_skills(data.get("can_help", [])),
            clean_skills(data.get("need_help", [])),
        )
        try:
            evaluate_achievements_for_profile(conn, profile_id)
        except Exception:
            pass
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        hydrated = _hydrate_profiles(conn, [row])[0]
    invalidate_profiles_cache()
    return hydrated


def delete_profile(profile_id: int, password: str = "") -> bool:
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, password_hash FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not existing:
            return False
        if not password:
            raise ProfileAuthError("Podaj hasło profilu, aby go usunąć.")
        stored_hash = existing["password_hash"] or ""
        if stored_hash and not verify_password(password, stored_hash):
            raise ProfileAuthError("Nieprawidłowe hasło — nie można usunąć profilu.")
        cur = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        success = cur.rowcount > 0
    if success:
        invalidate_profiles_cache()
    return success


def get_skills_catalog() -> Dict[str, Any]:
    with get_db() as conn:
        can_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            WHERE kind = 'can_help'
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 25
            """
        ).fetchall()
        need_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            WHERE kind = 'need_help'
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 25
            """
        ).fetchall()
        all_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 30
            """
        ).fetchall()

    return {
        "all": [{"skill": r["label"], "count": r["cnt"]} for r in all_rows],
        "can_help": [{"skill": r["label"], "count": r["cnt"]} for r in can_rows],
        "need_help": [{"skill": r["label"], "count": r["cnt"]} for r in need_rows],
    }


def _skills_overlap(source_skills: List[str], target_skills: List[str]) -> List[str]:
    target_norms = {normalize_text(t) for t in target_skills if normalize_text(t)}
    matched: List[str] = []
    seen = set()
    for src in source_skills:
        s_norm = normalize_text(src)
        if not s_norm or s_norm in seen:
            continue
        if s_norm in target_norms:
            seen.add(s_norm)
            matched.append(src)
            continue
        for t_norm in target_norms:
            if len(s_norm) >= 4 and len(t_norm) >= 4 and (s_norm in t_norm or t_norm in s_norm):
                seen.add(s_norm)
                matched.append(src)
                break
    return matched


def get_matches_for_profile(profile_id: int) -> Optional[Dict[str, Any]]:
    me = get_profile(profile_id)
    if not me:
        return None

    others = [p for p in list_profiles() if p["id"] != profile_id]
    mutual = []
    they_help_me = []
    i_help_them = []

    for other in others:
        helped_by_them = _skills_overlap(me["need_help"], other["can_help"])
        helped_by_me = _skills_overlap(me["can_help"], other["need_help"])

        entry = {
            "profile": other,
            "they_can_help_with": helped_by_them,
            "i_can_help_with": helped_by_me,
        }
        if helped_by_them and helped_by_me:
            mutual.append(entry)
        if helped_by_them:
            they_help_me.append(entry)
        if helped_by_me:
            i_help_them.append(entry)

    return {
        "profile": me,
        "mutual": mutual,
        "they_help_me": they_help_me,
        "i_help_them": i_help_them,
    }


def confirm_chlop_help(
    from_profile_id: int, to_profile_id: int, password: Optional[str] = ""
) -> Dict[str, Any]:
    """
    Zasada konsensusu 2/2 w sieci Chłopchain:
    Obaj chłopi muszą potwierdzić pomoc na stronie profilu.
    Gdy obaj to zrobią, zostaje wybity nowy blok w blockchainie i obaj otrzymują po 1 Chłopocoinie (CC).
    """
    if from_profile_id == to_profile_id:
        raise ProfileValidationError("Nie możesz przyznać Chłopocoina samemu sobie.")

    with get_db() as conn:
        from_row = conn.execute(
            "SELECT id, name, password_hash, chlopocoin_balance FROM profiles WHERE id = ?",
            (from_profile_id,),
        ).fetchone()
        if not from_row:
            raise ProfileAuthError("Profil potwierdzający nie istnieje.")

        to_row = conn.execute(
            "SELECT id, name, chlopocoin_balance FROM profiles WHERE id = ?",
            (to_profile_id,),
        ).fetchone()
        if not to_row:
            raise ProfileValidationError("Profil docelowy nie istnieje.")

        stored_hash = from_row["password_hash"] or ""
        if stored_hash and password:
            if not verify_password(password, stored_hash):
                raise ProfileAuthError("Nieprawidłowe hasło profilu.")

        p1, p2 = min(from_profile_id, to_profile_id), max(from_profile_id, to_profile_id)
        now = _now_iso()

        # Sprawdź, czy blok pomocy między tą parą został już wybity
        existing_block = conn.execute(
            "SELECT * FROM chlopocoin_blocks WHERE profile_a_id = ? AND profile_b_id = ?",
            (p1, p2),
        ).fetchone()

        if existing_block:
            balance_row = conn.execute(
                "SELECT chlopocoin_balance FROM profiles WHERE id = ?", (from_profile_id,)
            ).fetchone()
            return {
                "status": "already_settled",
                "mutual_settled": True,
                "block_index": existing_block["block_index"],
                "block_hash": existing_block["block_hash"],
                "chlopocoin_balance": balance_row["chlopocoin_balance"] if balance_row else 0,
                "message": "Pomoc została już rozliczona w sieci Chłopchain. Chłopocoin został przyznany wcześniej.",
            }

        # Zapisz potwierdzenie od chłopa A dla chłopa B
        conn.execute(
            """
            INSERT OR IGNORE INTO chlopocoin_confirmations (from_profile_id, to_profile_id, created_at)
            VALUES (?, ?, ?)
            """,
            (from_profile_id, to_profile_id, now),
        )

        # Sprawdź, czy chłop B również potwierdził chłopa A
        other_confirmed = conn.execute(
            "SELECT id FROM chlopocoin_confirmations WHERE from_profile_id = ? AND to_profile_id = ?",
            (to_profile_id, from_profile_id),
        ).fetchone()

        if other_confirmed:
            with BLOCKCHAIN_LOCK:
                # KONSENSUS 2/2 OSIĄGNIĘTY -> Mint nowego bloku w Chłopchainie!
                last_block = conn.execute(
                    "SELECT block_index, block_hash FROM chlopocoin_blocks ORDER BY block_index DESC LIMIT 1"
                ).fetchone()
                prev_hash = last_block["block_hash"] if last_block else "0" * 64
                block_index = (last_block["block_index"] + 1) if last_block else 1
                payload = f"{block_index}:{prev_hash}:{p1}:{p2}:{now}:proof_of_chlop_help"
                block_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

                # Pobierz nazwy obu chłopów
                r1 = conn.execute("SELECT name FROM profiles WHERE id = ?", (p1,)).fetchone()
                r2 = conn.execute("SELECT name FROM profiles WHERE id = ?", (p2,)).fetchone()
                p1_name = r1["name"] if r1 else f"Chłop #{p1}"
                p2_name = r2["name"] if r2 else f"Chłop #{p2}"

                conn.execute(
                    """
                    INSERT INTO chlopocoin_blocks (block_index, profile_a_id, profile_b_id, profile_a_name, profile_b_name, block_hash, prev_hash, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (block_index, p1, p2, p1_name, p2_name, block_hash, prev_hash, now),
                )

                # Dodaj po 1 Chłopocoinie dla obu profili
                conn.execute(
                    "UPDATE profiles SET chlopocoin_balance = chlopocoin_balance + 1 WHERE id IN (?, ?)",
                    (p1, p2),
                )
                evaluate_achievements_for_profile(conn, p1)
                evaluate_achievements_for_profile(conn, p2)
                update_billboard_leader_state(conn)

            invalidate_profiles_cache()
            balance_row = conn.execute(
                "SELECT chlopocoin_balance FROM profiles WHERE id = ?", (from_profile_id,)
            ).fetchone()
            return {
                "status": "minted",
                "mutual_settled": True,
                "block_index": block_index,
                "block_hash": block_hash,
                "chlopocoin_balance": balance_row["chlopocoin_balance"] if balance_row else 1,
                "message": "Konsensus 2/2 osiągnięty! Blok zatwierdzony w sieci Chłopchain — obaj otrzymujecie po 1 Chłopocoinie! 🪙",
            }
        else:
            balance_row = conn.execute(
                "SELECT chlopocoin_balance FROM profiles WHERE id = ?", (from_profile_id,)
            ).fetchone()
            return {
                "status": "pending",
                "mutual_settled": False,
                "chlopocoin_balance": balance_row["chlopocoin_balance"] if balance_row else 0,
                "message": f"Twoje potwierdzenie zostało zapisane (1/2). Czekamy na potwierdzenie od chłopa {to_row['name']}.",
            }


def get_chlopocoin_status(profile_a_id: int, profile_b_id: int) -> Dict[str, Any]:
    with get_db() as conn:
        p1, p2 = min(profile_a_id, profile_b_id), max(profile_a_id, profile_b_id)
        block = conn.execute(
            "SELECT * FROM chlopocoin_blocks WHERE profile_a_id = ? AND profile_b_id = ?",
            (p1, p2),
        ).fetchone()
        a_confirmed = bool(
            conn.execute(
                "SELECT id FROM chlopocoin_confirmations WHERE from_profile_id = ? AND to_profile_id = ?",
                (profile_a_id, profile_b_id),
            ).fetchone()
        )
        b_confirmed = bool(
            conn.execute(
                "SELECT id FROM chlopocoin_confirmations WHERE from_profile_id = ? AND to_profile_id = ?",
                (profile_b_id, profile_a_id),
            ).fetchone()
        )

        return {
            "confirmed_by_me": a_confirmed,
            "confirmed_by_them": b_confirmed,
            "mutual_settled": bool(block),
            "block_index": block["block_index"] if block else None,
            "block_hash": block["block_hash"] if block else None,
            "created_at": block["created_at"] if block else None,
        }


def get_chlopocoin_stats(profile_id: int) -> Dict[str, Any]:
    with get_db() as conn:
        prof = conn.execute(
            "SELECT chlopocoin_balance, name FROM profiles WHERE id = ?", (profile_id,)
        ).fetchone()
        balance = prof["chlopocoin_balance"] if prof and prof["chlopocoin_balance"] else 0

        blocks_rows = conn.execute(
            """
            SELECT b.id, b.block_index, b.block_hash, b.prev_hash, b.created_at,
                   b.profile_a_id, b.profile_b_id,
                   COALESCE(pa.name, NULLIF(b.profile_a_name, ''), 'Chłop #' || b.profile_a_id) as profile_a_name,
                   COALESCE(pb.name, NULLIF(b.profile_b_name, ''), 'Chłop #' || b.profile_b_id) as profile_b_name
            FROM chlopocoin_blocks b
            LEFT JOIN profiles pa ON pa.id = b.profile_a_id
            LEFT JOIN profiles pb ON pb.id = b.profile_b_id
            WHERE b.profile_a_id = ? OR b.profile_b_id = ?
            ORDER BY b.block_index DESC
            """,
            (profile_id, profile_id),
        ).fetchall()

        blocks = []
        for br in blocks_rows:
            partner_id = (
                br["profile_b_id"] if br["profile_a_id"] == profile_id else br["profile_a_id"]
            )
            partner_name = (
                br["profile_b_name"] if br["profile_a_id"] == profile_id else br["profile_a_name"]
            )
            blocks.append(
                {
                    "block_index": br["block_index"],
                    "partner_id": partner_id,
                    "partner_name": partner_name,
                    "block_hash": br["block_hash"],
                    "prev_hash": br["prev_hash"],
                    "created_at": br["created_at"],
                    "reward": 1,
                }
            )

        waiting_for_them = conn.execute(
            """
            SELECT c.to_profile_id as partner_id, p.name as partner_name, c.created_at
            FROM chlopocoin_confirmations c
            JOIN profiles p ON p.id = c.to_profile_id
            WHERE c.from_profile_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM chlopocoin_confirmations c2
                  WHERE c2.from_profile_id = c.to_profile_id AND c2.to_profile_id = c.from_profile_id
              )
            ORDER BY c.id DESC
            """,
            (profile_id,),
        ).fetchall()

        waiting_for_me = conn.execute(
            """
            SELECT c.from_profile_id as partner_id, p.name as partner_name, c.created_at
            FROM chlopocoin_confirmations c
            JOIN profiles p ON p.id = c.from_profile_id
            WHERE c.to_profile_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM chlopocoin_confirmations c2
                  WHERE c2.from_profile_id = c.to_profile_id AND c2.to_profile_id = c.from_profile_id
              )
            ORDER BY c.id DESC
            """,
            (profile_id,),
        ).fetchall()

        return {
            "balance": balance,
            "completed_helps": len(blocks),
            "waiting_for_them_count": len(waiting_for_them),
            "waiting_for_them": [dict(r) for r in waiting_for_them],
            "waiting_for_me_count": len(waiting_for_me),
            "waiting_for_me": [dict(r) for r in waiting_for_me],
            "blocks": blocks,
        }


def verify_chlopchain_integrity() -> Dict[str, Any]:
    with get_db() as conn:
        blocks = conn.execute(
            """
            SELECT block_index, profile_a_id, profile_b_id, block_hash, prev_hash, created_at
            FROM chlopocoin_blocks
            ORDER BY block_index ASC
            """
        ).fetchall()

        if not blocks:
            return {
                "is_valid": True,
                "verified_blocks": 0,
                "message": "Łańcuch bloków jest gotowy do zapisu pierwszego bloku.",
            }

        expected_prev = "0" * 64
        for b in blocks:
            idx = b["block_index"]
            p1 = min(b["profile_a_id"], b["profile_b_id"])
            p2 = max(b["profile_a_id"], b["profile_b_id"])
            ts = b["created_at"]
            prev = b["prev_hash"]

            if prev != expected_prev:
                return {
                    "is_valid": False,
                    "verified_blocks": idx - 1,
                    "error": f"Naruszenie prev_hash w bloku #{idx}: oczekiwano {expected_prev[:12]}..., znaleziono {prev[:12]}...",
                }

            payload = f"{idx}:{prev}:{p1}:{p2}:{ts}:proof_of_chlop_help"
            calc_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
            if calc_hash != b["block_hash"]:
                return {
                    "is_valid": False,
                    "verified_blocks": idx - 1,
                    "error": f"Naruszenie hasza w bloku #{idx}: obliczono {calc_hash[:12]}..., w bazie {b['block_hash'][:12]}...",
                }

            expected_prev = b["block_hash"]

        return {
            "is_valid": True,
            "verified_blocks": len(blocks),
            "message": f"Kryptograficzna integralność sieci Chłopchain potwierdzona: {len(blocks)} bloków zweryfikowanych poprawnie ✓",
        }


def get_global_chlopocoin_stats() -> Dict[str, Any]:
    with get_db() as conn:
        supply_row = conn.execute(
            "SELECT COALESCE(SUM(chlopocoin_balance), 0) AS total_supply FROM profiles"
        ).fetchone()
        total_supply = int(supply_row["total_supply"]) if supply_row else 0

        blocks_count_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM chlopocoin_blocks"
        ).fetchone()
        total_blocks = int(blocks_count_row["cnt"]) if blocks_count_row else 0

        holders_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM profiles WHERE chlopocoin_balance > 0"
        ).fetchone()
        holders_count = int(holders_row["cnt"]) if holders_row else 0

        profiles_count_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM profiles"
        ).fetchone()
        total_profiles = int(profiles_count_row["cnt"]) if profiles_count_row else 0

        mempool_rows = conn.execute(
            """
            SELECT c.id, c.from_profile_id, pa.name as from_name, pa.location_name as from_location,
                   c.to_profile_id, pb.name as to_name, pb.location_name as to_location,
                   c.created_at
            FROM chlopocoin_confirmations c
            JOIN profiles pa ON pa.id = c.from_profile_id
            JOIN profiles pb ON pb.id = c.to_profile_id
            WHERE NOT EXISTS (
                SELECT 1 FROM chlopocoin_confirmations c2
                WHERE c2.from_profile_id = c.to_profile_id AND c2.to_profile_id = c.from_profile_id
            )
            ORDER BY c.id DESC
            LIMIT 50
            """
        ).fetchall()

        leaderboard_rows = conn.execute(
            """
            SELECT *
            FROM profiles
            WHERE chlopocoin_balance > 0
            ORDER BY chlopocoin_balance DESC, id ASC
            LIMIT 50
            """
        ).fetchall()

        leaderboard = []
        if leaderboard_rows:
            hydrated = _hydrate_profiles(conn, leaderboard_rows)
            for p in hydrated:
                leaderboard.append(
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "location_name": p.get("location_name") or "Polska",
                        "chlopocoin_balance": p.get("chlopocoin_balance", 0),
                        "can_help": p.get("can_help", []),
                        "need_help": p.get("need_help", []),
                        "created_at": p.get("created_at"),
                    }
                )

        blocks_rows = conn.execute(
            """
            SELECT b.id, b.block_index, b.block_hash, b.prev_hash, b.created_at,
                   b.profile_a_id, b.profile_b_id,
                   COALESCE(pa.name, NULLIF(b.profile_a_name, ''), 'Chłop #' || b.profile_a_id) as profile_a_name,
                   COALESCE(pa.location_name, 'Polska') as profile_a_location,
                   COALESCE(pb.name, NULLIF(b.profile_b_name, ''), 'Chłop #' || b.profile_b_id) as profile_b_name,
                   COALESCE(pb.location_name, 'Polska') as profile_b_location
            FROM chlopocoin_blocks b
            LEFT JOIN profiles pa ON pa.id = b.profile_a_id
            LEFT JOIN profiles pb ON pb.id = b.profile_b_id
            ORDER BY b.block_index DESC
            LIMIT 100
            """
        ).fetchall()

        blocks = []
        for br in blocks_rows:
            blocks.append(
                {
                    "block_index": br["block_index"],
                    "block_hash": br["block_hash"],
                    "prev_hash": br["prev_hash"],
                    "created_at": br["created_at"],
                    "profile_a_id": br["profile_a_id"],
                    "profile_a_name": br["profile_a_name"],
                    "profile_a_location": br["profile_a_location"] or "Polska",
                    "profile_b_id": br["profile_b_id"],
                    "profile_b_name": br["profile_b_name"],
                    "profile_b_location": br["profile_b_location"] or "Polska",
                    "reward_per_participant": 1,
                    "reward_total": 2,
                }
            )

        latest_hash = blocks[0]["block_hash"] if blocks else "0" * 64
        integrity = verify_chlopchain_integrity()

        return {
            "total_supply": total_supply,
            "total_blocks": total_blocks,
            "total_helps": total_blocks,
            "active_holders_count": holders_count,
            "total_profiles_count": total_profiles,
            "pending_confirmations_count": len(mempool_rows),
            "latest_block_hash": latest_hash,
            "chain_integrity": integrity,
            "leaderboard": leaderboard,
            "mempool": [dict(m) for m in mempool_rows],
            "blocks": blocks,
        }


def get_chlopocoin_rankings(query: str = "", limit: int = 100) -> Dict[str, Any]:
    """Zwraca dane do dedykowanej zakładki 'Rankingi': liderzy Chłopocoinów, podium i filtry."""
    with get_db() as conn:
        supply_row = conn.execute(
            "SELECT COALESCE(SUM(chlopocoin_balance), 0) AS total_supply FROM profiles"
        ).fetchone()
        total_supply = int(supply_row["total_supply"]) if supply_row else 0

        holders_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM profiles WHERE chlopocoin_balance > 0"
        ).fetchone()
        holders_count = int(holders_row["cnt"]) if holders_row else 0

        fetch_limit = max(limit * 3, 200)
        rows = conn.execute(
            """
            SELECT *
            FROM profiles
            WHERE chlopocoin_balance > 0
            ORDER BY chlopocoin_balance DESC, id ASC
            LIMIT ?
            """,
            (fetch_limit,),
        ).fetchall()

        leaderboard = []
        if rows:
            hydrated = _hydrate_profiles(conn, rows)
            q_norm = normalize_text(query).strip() if query else ""
            for p in hydrated:
                if q_norm:
                    name_match = q_norm in normalize_text(p["name"])
                    loc_match = q_norm in normalize_text(p.get("location_name") or "")
                    skills_match = any(q_norm in normalize_text(s) for s in p.get("can_help", []))
                    if not (name_match or loc_match or skills_match):
                        continue

                leaderboard.append(
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "location_name": p.get("location_name") or "Polska",
                        "chlopocoin_balance": p.get("chlopocoin_balance", 0),
                        "can_help": p.get("can_help", []),
                        "need_help": p.get("need_help", []),
                        "created_at": p.get("created_at"),
                    }
                )
                if len(leaderboard) >= limit:
                    break

        return {
            "total_holders_count": holders_count,
            "total_coins_minted": total_supply,
            "leaderboard": leaderboard,
            "top_three": leaderboard[:3],
        }


def create_chat_message(
    message: str,
    author_name: str = "",
    profile_id: Optional[int] = None,
) -> Dict[str, Any]:
    cleaned_msg = str(message or "").strip()
    if not cleaned_msg:
        raise ProfileValidationError("Treść wiadomości nie może być pusta.")
    if len(cleaned_msg) > 1000:
        cleaned_msg = cleaned_msg[:1000]

    effective_author = str(author_name or "").strip()
    with get_db() as conn:
        if profile_id:
            row = conn.execute("SELECT name FROM profiles WHERE id = ?", (profile_id,)).fetchone()
            if row and row["name"]:
                effective_author = row["name"]
        if not effective_author:
            effective_author = "Chłop"

        now_str = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            """
            INSERT INTO global_chat_messages (profile_id, author_name, message, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (profile_id, effective_author, cleaned_msg, now_str),
        )
        msg_id = cur.lastrowid
        if profile_id:
            try:
                evaluate_achievements_for_profile(conn, profile_id)
            except Exception:
                pass
        return {
            "id": msg_id,
            "profile_id": profile_id,
            "author_name": effective_author,
            "message": cleaned_msg,
            "created_at": now_str,
        }


def list_chat_messages(limit: int = 50, since_id: int = 0) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if since_id > 0:
            rows = conn.execute(
                """
                SELECT id, profile_id, author_name, message, created_at
                FROM global_chat_messages
                WHERE id > ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (since_id, max(1, min(200, limit))),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, profile_id, author_name, message, created_at
                FROM global_chat_messages
                ORDER BY id DESC
                LIMIT ?
                """,
                (max(1, min(200, limit)),),
            ).fetchall()
            rows = list(reversed(rows))

        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "profile_id": r["profile_id"],
                    "author_name": r["author_name"],
                    "message": r["message"],
                    "created_at": r["created_at"],
                }
            )
        return result


def create_direct_message(
    sender_id: int,
    receiver_id: int,
    message: str,
) -> Dict[str, Any]:
    if sender_id == receiver_id:
        raise ProfileValidationError("Nie możesz wysłać wiadomości prywatnej do samego siebie.")

    cleaned_msg = str(message or "").strip()
    if not cleaned_msg:
        raise ProfileValidationError("Treść wiadomości nie może być pusta.")
    if len(cleaned_msg) > 1000:
        cleaned_msg = cleaned_msg[:1000]

    with get_db() as conn:
        sender = conn.execute("SELECT id, name FROM profiles WHERE id = ?", (sender_id,)).fetchone()
        if not sender:
            raise ProfileValidationError("Nadawca wiadomości nie istnieje.")

        receiver = conn.execute("SELECT id, name FROM profiles WHERE id = ?", (receiver_id,)).fetchone()
        if not receiver:
            raise ProfileValidationError("Odbiorca wiadomości nie istnieje.")

        now_str = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            """
            INSERT INTO direct_chat_messages (
                sender_id, receiver_id, message, is_read, deleted_by_sender, deleted_by_receiver, created_at
            )
            VALUES (?, ?, ?, 0, 0, 0, ?)
            """,
            (sender_id, receiver_id, cleaned_msg, now_str),
        )
        msg_id = cur.lastrowid
        if sender_id:
            try:
                evaluate_achievements_for_profile(conn, sender_id)
            except Exception:
                pass
        return {
            "id": msg_id,
            "sender_id": sender_id,
            "sender_name": sender["name"],
            "receiver_id": receiver_id,
            "receiver_name": receiver["name"],
            "message": cleaned_msg,
            "is_read": False,
            "created_at": now_str,
        }


def list_direct_messages(
    user_id: int,
    partner_id: int,
    limit: int = 100,
    since_id: int = 0,
) -> List[Dict[str, Any]]:
    with get_db() as conn:
        fetch_limit = max(1, min(200, limit))
        if since_id > 0:
            query = """
                SELECT d.id, d.sender_id, s.name AS sender_name,
                       d.receiver_id, r.name AS receiver_name,
                       d.message, d.is_read, d.created_at
                FROM direct_chat_messages d
                JOIN profiles s ON d.sender_id = s.id
                JOIN profiles r ON d.receiver_id = r.id
                WHERE (
                    (d.sender_id = ? AND d.receiver_id = ? AND d.deleted_by_sender = 0)
                    OR
                    (d.sender_id = ? AND d.receiver_id = ? AND d.deleted_by_receiver = 0)
                )
                AND d.id > ?
                ORDER BY d.id ASC
                LIMIT ?
            """
            rows = conn.execute(query, (user_id, partner_id, partner_id, user_id, since_id, fetch_limit)).fetchall()
        else:
            query = """
                SELECT d.id, d.sender_id, s.name AS sender_name,
                       d.receiver_id, r.name AS receiver_name,
                       d.message, d.is_read, d.created_at
                FROM direct_chat_messages d
                JOIN profiles s ON d.sender_id = s.id
                JOIN profiles r ON d.receiver_id = r.id
                WHERE (
                    (d.sender_id = ? AND d.receiver_id = ? AND d.deleted_by_sender = 0)
                    OR
                    (d.sender_id = ? AND d.receiver_id = ? AND d.deleted_by_receiver = 0)
                )
                ORDER BY d.id DESC
                LIMIT ?
            """
            rows = conn.execute(query, (user_id, partner_id, partner_id, user_id, fetch_limit)).fetchall()
            rows = list(reversed(rows))

        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "sender_id": r["sender_id"],
                    "sender_name": r["sender_name"],
                    "receiver_id": r["receiver_id"],
                    "receiver_name": r["receiver_name"],
                    "message": r["message"],
                    "is_read": bool(r["is_read"]),
                    "created_at": r["created_at"],
                }
            )
        return result


def mark_direct_messages_as_read(user_id: int, partner_id: int) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """
            UPDATE direct_chat_messages
            SET is_read = 1
            WHERE receiver_id = ? AND sender_id = ? AND is_read = 0 AND deleted_by_receiver = 0
            """,
            (user_id, partner_id),
        )
        return cur.rowcount


def list_user_conversations(user_id: int) -> List[Dict[str, Any]]:
    with get_db() as conn:
        partner_rows = conn.execute(
            """
            SELECT DISTINCT
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
            FROM direct_chat_messages
            WHERE (sender_id = ? AND deleted_by_sender = 0)
               OR (receiver_id = ? AND deleted_by_receiver = 0)
            """,
            (user_id, user_id, user_id),
        ).fetchall()

        conversations = []
        for p in partner_rows:
            pid = p["partner_id"]
            prof = conn.execute("SELECT id, name, location_name FROM profiles WHERE id = ?", (pid,)).fetchone()
            if not prof:
                continue

            last_msg = conn.execute(
                """
                SELECT id, message, created_at, sender_id
                FROM direct_chat_messages
                WHERE (
                    (sender_id = ? AND receiver_id = ? AND deleted_by_sender = 0)
                    OR
                    (sender_id = ? AND receiver_id = ? AND deleted_by_receiver = 0)
                )
                ORDER BY id DESC
                LIMIT 1
                """,
                (user_id, pid, pid, user_id),
            ).fetchone()

            if not last_msg:
                continue

            unread_cnt = conn.execute(
                """
                SELECT COUNT(*) AS c
                FROM direct_chat_messages
                WHERE receiver_id = ? AND sender_id = ? AND is_read = 0 AND deleted_by_receiver = 0
                """,
                (user_id, pid),
            ).fetchone()["c"]

            total_cnt = conn.execute(
                """
                SELECT COUNT(*) AS c
                FROM direct_chat_messages
                WHERE (
                    (sender_id = ? AND receiver_id = ? AND deleted_by_sender = 0)
                    OR
                    (sender_id = ? AND receiver_id = ? AND deleted_by_receiver = 0)
                )
                """,
                (user_id, pid, pid, user_id),
            ).fetchone()["c"]

            conversations.append(
                {
                    "partner_id": prof["id"],
                    "partner_name": prof["name"],
                    "partner_location": prof["location_name"] or "",
                    "last_message": last_msg["message"],
                    "last_message_time": last_msg["created_at"],
                    "unread_count": unread_cnt,
                    "total_messages": total_cnt,
                }
            )

        conversations.sort(key=lambda c: c["last_message_time"], reverse=True)
        return conversations


def clear_conversation_history(user_id: int, partner_id: int) -> Dict[str, Any]:
    with get_db() as conn:
        conn.execute(
            """
            UPDATE direct_chat_messages
            SET deleted_by_sender = 1
            WHERE sender_id = ? AND receiver_id = ?
            """,
            (user_id, partner_id),
        )
        conn.execute(
            """
            UPDATE direct_chat_messages
            SET deleted_by_receiver = 1
            WHERE receiver_id = ? AND sender_id = ?
            """,
            (user_id, partner_id),
        )
        conn.execute(
            """
            DELETE FROM direct_chat_messages
            WHERE deleted_by_sender = 1 AND deleted_by_receiver = 1
            """
        )
        return {"cleared": True, "partner_id": partner_id}


def delete_single_direct_message(user_id: int, message_id: int) -> Dict[str, Any]:
    with get_db() as conn:
        msg = conn.execute("SELECT * FROM direct_chat_messages WHERE id = ?", (message_id,)).fetchone()
        if not msg:
            raise ProfileValidationError("Nie znaleziono wiadomości.")

        if msg["sender_id"] != user_id and msg["receiver_id"] != user_id:
            raise ProfileAuthError("Nie masz uprawnień do usunięcia tej wiadomości.")

        if msg["sender_id"] == user_id:
            conn.execute("UPDATE direct_chat_messages SET deleted_by_sender = 1 WHERE id = ?", (message_id,))
        if msg["receiver_id"] == user_id:
            conn.execute("UPDATE direct_chat_messages SET deleted_by_receiver = 1 WHERE id = ?", (message_id,))

        conn.execute(
            """
            DELETE FROM direct_chat_messages
            WHERE id = ? AND deleted_by_sender = 1 AND deleted_by_receiver = 1
            """,
            (message_id,),
        )
        return {"deleted": True, "message_id": message_id}


def get_unread_dm_count(user_id: int) -> int:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS c
            FROM direct_chat_messages
            WHERE receiver_id = ? AND is_read = 0 AND deleted_by_receiver = 0
            """,
            (user_id,),
        ).fetchone()
        return row["c"] if row else 0


SYNTHETIC_MALE_FIRST_NAMES = [
    "Andrzej", "Bartek", "Bogdan", "Cezary", "Damian", "Dariusz", "Dawid", "Filip",
    "Grzegorz", "Hubert", "Igor", "Jacek", "Jan", "Jarosław", "Kamil", "Karol",
    "Krzysztof", "Łukasz", "Maciej", "Marcin", "Marek", "Mariusz", "Mateusz", "Michał",
    "Norbert", "Paweł", "Piotr", "Przemysław", "Radosław", "Rafał", "Robert", "Sebastian",
    "Stanisław", "Szymon", "Tomasz", "Wiesław", "Wiktor", "Wojciech", "Zbigniew",
]

SYNTHETIC_MALE_SURNAMES = [
    "Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski",
    "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur",
    "Kwiatkowski", "Krawczyk", "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski",
    "Michalski", "Nowicki", "Adamczyk", "Dudek", "Zając", "Wieczorek", "Jabłoński",
    "Majewski", "Olszewski", "Jaworski", "Malinowski", "Pawlak", "Górski", "Witkowski",
    "Walczak", "Sikora", "Baran", "Rutkowski", "Michalak", "Szewczyk",
]

SYNTHETIC_SKILLS_POOL = [
    "spawanie", "mechanika samochodowa", "programowanie", "it", "qa", "testowanie",
    "elektryka", "hydraulika", "finanse", "podatki b2b", "stolarka", "budownictwo",
    "remonty", "motoryzacja", "trening siłowy", "bieganie", "dietetyka", "ux/ui",
    "grafika", "zarządzanie projektami", "prawo", "umowy", "angielski", "niemiecki",
    "fotografia", "audio", "ogrodnictwo", "blacharstwo", "elektronika", "majsterkowanie",
    "logistyka", "marketing", "stolarstwo", "klimatyzacja", "fotowoltaika",
]


def generate_random_synthetic_profile() -> Dict[str, Any]:
    """Generuje losowy, w pełni poprawny męski profil chłopa do bazy danych."""
    first_name = random.choice(SYNTHETIC_MALE_FIRST_NAMES)
    surname = random.choice(SYNTHETIC_MALE_SURNAMES)
    full_name = f"{first_name} {surname}"

    city, lat, lng = random.choice(PL_CITIES)

    shuffled_skills = list(SYNTHETIC_SKILLS_POOL)
    random.shuffle(shuffled_skills)
    can_help_count = random.randint(2, 4)
    can_help = shuffled_skills[:can_help_count]

    remaining_skills = shuffled_skills[can_help_count:]
    need_help_count = random.randint(1, 3)
    need_help = remaining_skills[:need_help_count]

    suffix = random.randint(100, 99999)
    email_user = f"{normalize_text(first_name)}.{normalize_text(surname)}.{suffix}".replace(" ", "")
    email = f"{email_user}@bronet.pl"

    bio_templates = [
        f"Chłop z miasta {city}. Znam się na {can_help[0]} i chętnie pomogę braciom. Szukam pomocy z {need_help[0]}.",
        f"Działam w branży {can_help[0]}. Mogę pomóc z {', '.join(can_help)}. Potrzebuję kogoś ogarniętego do {need_help[0]}.",
        f"Cześć bracia! Mieszkam w {city}. Jeśli potrzebujesz wsparcia z {can_help[0]}, pisz śmiało. Sam chętnie skorzystam z pomocy w {need_help[0]}.",
        f"Praktyk z wieloletnim doświadczeniem w {can_help[0]}. Wymienię wiedzę i pomoc na wsparcie z {need_help[0]}.",
    ]
    bio = random.choice(bio_templates)

    payload = {
        "name": full_name,
        "email": email,
        "password": "haslo123chlop",
        "can_help": can_help,
        "need_help": need_help,
        "contact": email,
        "bio": bio,
        "location_name": city,
        "lat": lat,
        "lng": lng,
        "share_location": True,
        "role": "user",
    }
    return create_profile(payload)


# ============================================================================
# GAMIFIKACJA & SYSTEM OSIĄGNIĘĆ CHŁOPCHAINA (W STYLU WORLD OF WARCRAFT)
# ============================================================================

def init_achievements(conn: sqlite3.Connection) -> None:
    """Inicjalizuje definicje osiągnięć w bazie danych i aktualizuje opisy/punkty."""
    for item in ACHIEVEMENTS_SEED:
        existing = conn.execute(
            "SELECT id FROM achievements_definitions WHERE id = ?", (item["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """
                INSERT INTO achievements_definitions (
                    id, title, description, category, rarity, points, icon,
                    is_server_first, criteria_type, criteria_value
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["title"],
                    item["description"],
                    item["category"],
                    item["rarity"],
                    item["points"],
                    item["icon"],
                    item["is_server_first"],
                    item["criteria_type"],
                    item["criteria_value"],
                ),
            )
        else:
            conn.execute(
                """
                UPDATE achievements_definitions
                SET title = ?, description = ?, category = ?, rarity = ?,
                    points = ?, icon = ?, is_server_first = ?,
                    criteria_type = ?, criteria_value = ?
                WHERE id = ?
                """,
                (
                    item["title"],
                    item["description"],
                    item["category"],
                    item["rarity"],
                    item["points"],
                    item["icon"],
                    item["is_server_first"],
                    item["criteria_type"],
                    item["criteria_value"],
                    item["id"],
                ),
            )


def update_billboard_leader_state(
    conn: sqlite3.Connection,
    advance_day: bool = False,
    force_days: Optional[int] = None,
) -> None:
    """Aktualizuje stan lidera Billboard Hot 200 (kto jest #1 w rankingu i ile dni utrzymuje szczyt)."""
    top_row = conn.execute(
        """
        SELECT id, name, chlopocoin_balance
        FROM profiles
        WHERE chlopocoin_balance > 0
        ORDER BY chlopocoin_balance DESC, id ASC
        LIMIT 1
        """
    ).fetchone()
    if not top_row:
        return

    top_id = top_row["id"]
    current_lead_id_row = conn.execute(
        "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_id'"
    ).fetchone()
    current_days_row = conn.execute(
        "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_days'"
    ).fetchone()

    cur_id = int(current_lead_id_row["value"]) if current_lead_id_row else None
    cur_days = int(current_days_row["value"]) if current_days_row else 0

    if force_days is not None:
        cur_id = top_id
        cur_days = force_days
    elif cur_id == top_id:
        if advance_day:
            cur_days += 1
    else:
        cur_id = top_id
        cur_days = 1

    conn.execute(
        "INSERT OR REPLACE INTO economy_simulator_state (key, value) VALUES ('billboard_leader_id', ?)",
        (str(cur_id),),
    )
    conn.execute(
        "INSERT OR REPLACE INTO economy_simulator_state (key, value) VALUES ('billboard_leader_days', ?)",
        (str(cur_days),),
    )
    conn.execute(
        "INSERT OR REPLACE INTO economy_simulator_state (key, value) VALUES ('billboard_leader_name', ?)",
        (top_row["name"],),
    )

    evaluate_achievements_for_profile(conn, top_id)


def evaluate_achievements_for_profile(
    conn: sqlite3.Connection, profile_id: int
) -> List[Dict[str, Any]]:
    """
    Ocenia i przyznaje osiągnięcia dla danego chłopa.
    Zwraca listę nowo odblokowanych osiągnięć w tej transakcji.
    """
    row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    if not row:
        return []

    profile = dict(row)
    now_iso = datetime.now(timezone.utc).isoformat()

    unlocked_rows = conn.execute(
        "SELECT achievement_id FROM profile_achievements WHERE profile_id = ?",
        (profile_id,),
    ).fetchall()
    unlocked_ids = {r["achievement_id"] for r in unlocked_rows}

    defs = conn.execute("SELECT * FROM achievements_definitions").fetchall()
    newly_unlocked = []

    balance = profile.get("chlopocoin_balance", 0) or 0
    blocks_count = conn.execute(
        "SELECT COUNT(*) AS c FROM chlopocoin_blocks WHERE profile_a_id = ? OR profile_b_id = ?",
        (profile_id, profile_id),
    ).fetchone()["c"]
    can_help_count = conn.execute(
        "SELECT COUNT(*) AS c FROM profile_skills WHERE profile_id = ? AND kind = 'can_help'",
        (profile_id,),
    ).fetchone()["c"]
    need_help_count = conn.execute(
        "SELECT COUNT(*) AS c FROM profile_skills WHERE profile_id = ? AND kind = 'need_help'",
        (profile_id,),
    ).fetchone()["c"]
    chat_count = conn.execute(
        "SELECT COUNT(*) AS c FROM global_chat_messages WHERE profile_id = ?",
        (profile_id,),
    ).fetchone()["c"]
    dm_count = conn.execute(
        "SELECT COUNT(*) AS c FROM direct_chat_messages WHERE sender_id = ?",
        (profile_id,),
    ).fetchone()["c"]

    for d in defs:
        ach_id = d["id"]
        if ach_id in unlocked_ids:
            continue

        c_type = d["criteria_type"]
        c_val = d["criteria_value"]
        qualifies = False

        if c_type == "coins_ge":
            qualifies = balance >= c_val

        elif c_type == "server_first_coins":
            if balance >= c_val:
                if not d["first_achieved_by_id"]:
                    upd = conn.execute(
                        """
                        UPDATE achievements_definitions
                        SET first_achieved_by_id = ?, first_achieved_by_name = ?, first_achieved_at = ?
                        WHERE id = ? AND first_achieved_by_id IS NULL
                        """,
                        (profile_id, profile["name"], now_iso, ach_id),
                    ).rowcount
                    qualifies = upd > 0
                elif d["first_achieved_by_id"] == profile_id:
                    qualifies = True

        elif c_type == "server_first_block":
            if blocks_count >= 1:
                first_block = conn.execute(
                    "SELECT profile_a_id, profile_b_id, created_at FROM chlopocoin_blocks ORDER BY block_index ASC, id ASC LIMIT 1"
                ).fetchone()
                if first_block and (
                    profile_id
                    in (first_block["profile_a_id"], first_block["profile_b_id"])
                ):
                    if not d["first_achieved_by_id"]:
                        upd = conn.execute(
                            """
                            UPDATE achievements_definitions
                            SET first_achieved_by_id = ?, first_achieved_by_name = ?, first_achieved_at = ?
                            WHERE id = ? AND first_achieved_by_id IS NULL
                            """,
                            (
                                profile_id,
                                profile["name"],
                                first_block["created_at"] or now_iso,
                                ach_id,
                            ),
                        ).rowcount
                        qualifies = upd > 0
                    elif d["first_achieved_by_id"] == profile_id:
                        qualifies = True

        elif c_type == "billboard_hot_200":
            lead_row = conn.execute(
                "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_id'"
            ).fetchone()
            days_row = conn.execute(
                "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_days'"
            ).fetchone()
            if lead_row and days_row:
                try:
                    if int(lead_row["value"]) == profile_id and int(days_row["value"]) >= c_val:
                        qualifies = True
                except (ValueError, TypeError):
                    pass

        elif c_type == "rank_top_3":
            if balance > 0:
                top_3 = conn.execute(
                    "SELECT id FROM profiles WHERE chlopocoin_balance > 0 ORDER BY chlopocoin_balance DESC, id ASC LIMIT 3"
                ).fetchall()
                if any(r["id"] == profile_id for r in top_3):
                    qualifies = True

        elif c_type == "blocks_ge":
            qualifies = blocks_count >= c_val

        elif c_type == "skills_ge":
            qualifies = can_help_count >= c_val

        elif c_type == "profile_complete":
            name_ok = bool(profile.get("name", "").strip())
            email_ok = bool(profile.get("email", "").strip())
            loc_ok = bool(profile.get("location_name", "").strip())
            bio_ok = bool(profile.get("bio", "").strip())
            qualifies = (
                name_ok
                and email_ok
                and loc_ok
                and bio_ok
                and can_help_count >= 1
                and need_help_count >= 1
            )

        elif c_type == "chat_messages_ge":
            qualifies = chat_count >= c_val

        elif c_type == "dm_messages_ge":
            qualifies = dm_count >= c_val

        if qualifies:
            conn.execute(
                """
                INSERT OR IGNORE INTO profile_achievements (profile_id, achievement_id, achieved_at, notified)
                VALUES (?, ?, ?, 0)
                """,
                (profile_id, ach_id, now_iso),
            )
            unlocked_ids.add(ach_id)
            newly_unlocked.append(
                {
                    "id": d["id"],
                    "title": d["title"],
                    "description": d["description"],
                    "category": d["category"],
                    "rarity": d["rarity"],
                    "points": d["points"],
                    "icon": d["icon"],
                    "is_server_first": bool(d["is_server_first"]),
                    "achieved_at": now_iso,
                }
            )

    conn.execute(
        """
        UPDATE profiles
        SET achievement_points = (
            SELECT COALESCE(SUM(ad.points), 0)
            FROM profile_achievements pa
            JOIN achievements_definitions ad ON pa.achievement_id = ad.id
            WHERE pa.profile_id = ?
        )
        WHERE id = ?
        """,
        (profile_id, profile_id),
    )

    return newly_unlocked


def evaluate_all_achievements(conn: sqlite3.Connection) -> int:
    """Ocenia i przyznaje osiągnięcia dla wszystkich aktywnych profili na sieci."""
    rows = conn.execute(
        """
        SELECT DISTINCT id FROM profiles
        WHERE chlopocoin_balance > 0
           OR id IN (SELECT profile_a_id FROM chlopocoin_blocks UNION SELECT profile_b_id FROM chlopocoin_blocks)
           OR id IN (SELECT profile_id FROM global_chat_messages WHERE profile_id IS NOT NULL)
           OR id IN (SELECT sender_id FROM direct_chat_messages)
        """
    ).fetchall()
    cnt = 0
    for r in rows:
        evaluate_achievements_for_profile(conn, r["id"])
        cnt += 1
    update_billboard_leader_state(conn)
    return cnt


def get_profile_achievements(profile_id: int) -> Dict[str, Any]:
    """Zwraca listę osiągnięć dla profilu (odblokowane oraz zablokowane z postępem)."""
    with get_db() as conn:
        evaluate_achievements_for_profile(conn, profile_id)

        profile_row = conn.execute(
            "SELECT id, name, chlopocoin_balance, achievement_points FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not profile_row:
            raise ProfileNotFoundError(f"Profil #{profile_id} nie istnieje.")

        profile = dict(profile_row)
        defs = conn.execute(
            "SELECT * FROM achievements_definitions ORDER BY points ASC, id ASC"
        ).fetchall()
        pa_rows = conn.execute(
            """
            SELECT pa.achievement_id, pa.achieved_at
            FROM profile_achievements pa
            WHERE pa.profile_id = ?
            """,
            (profile_id,),
        ).fetchall()
        unlocked_map = {r["achievement_id"]: r["achieved_at"] for r in pa_rows}

        balance = profile.get("chlopocoin_balance", 0) or 0
        blocks_count = conn.execute(
            "SELECT COUNT(*) AS c FROM chlopocoin_blocks WHERE profile_a_id = ? OR profile_b_id = ?",
            (profile_id, profile_id),
        ).fetchone()["c"]
        can_help_count = conn.execute(
            "SELECT COUNT(*) AS c FROM profile_skills WHERE profile_id = ? AND kind = 'can_help'",
            (profile_id,),
        ).fetchone()["c"]
        need_help_count = conn.execute(
            "SELECT COUNT(*) AS c FROM profile_skills WHERE profile_id = ? AND kind = 'need_help'",
            (profile_id,),
        ).fetchone()["c"]
        chat_count = conn.execute(
            "SELECT COUNT(*) AS c FROM global_chat_messages WHERE profile_id = ?",
            (profile_id,),
        ).fetchone()["c"]
        dm_count = conn.execute(
            "SELECT COUNT(*) AS c FROM direct_chat_messages WHERE sender_id = ?",
            (profile_id,),
        ).fetchone()["c"]

        lead_days_row = conn.execute(
            "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_days'"
        ).fetchone()
        lead_id_row = conn.execute(
            "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_id'"
        ).fetchone()
        is_current_leader = bool(lead_id_row and lead_id_row["value"] == str(profile_id))
        leader_days = (
            int(lead_days_row["value"]) if (lead_days_row and is_current_leader) else 0
        )

        unlocked_list = []
        locked_list = []

        for d in defs:
            ach_id = d["id"]
            c_type = d["criteria_type"]
            c_val = d["criteria_value"]

            item = {
                "id": ach_id,
                "title": d["title"],
                "description": d["description"],
                "category": d["category"],
                "rarity": d["rarity"],
                "points": d["points"],
                "icon": d["icon"],
                "is_server_first": bool(d["is_server_first"]),
                "first_achieved_by_id": d["first_achieved_by_id"],
                "first_achieved_by_name": d["first_achieved_by_name"],
                "first_achieved_at": d["first_achieved_at"],
            }

            if ach_id in unlocked_map:
                item["unlocked"] = True
                item["achieved_at"] = unlocked_map[ach_id]
                unlocked_list.append(item)
            else:
                item["unlocked"] = False
                curr_val = 0
                if c_type in ("coins_ge", "server_first_coins"):
                    curr_val = min(balance, c_val)
                elif c_type in ("blocks_ge", "server_first_block"):
                    curr_val = min(blocks_count, c_val)
                elif c_type == "skills_ge":
                    curr_val = min(can_help_count, c_val)
                elif c_type == "chat_messages_ge":
                    curr_val = min(chat_count, c_val)
                elif c_type == "dm_messages_ge":
                    curr_val = min(dm_count, c_val)
                elif c_type == "billboard_hot_200":
                    curr_val = min(leader_days, c_val)
                elif c_type == "profile_complete":
                    curr_val = (1 if can_help_count else 0) + (1 if need_help_count else 0)

                item["current_val"] = curr_val
                item["target_val"] = c_val
                item["progress_pct"] = min(
                    100.0, round((curr_val / max(1, c_val)) * 100, 1)
                )
                item["is_already_claimed"] = bool(
                    d["is_server_first"]
                    and d["first_achieved_by_id"]
                    and d["first_achieved_by_id"] != profile_id
                )
                locked_list.append(item)

        total_pts = sum(u["points"] for u in unlocked_list)
        return {
            "profile_id": profile_id,
            "profile_name": profile["name"],
            "total_points": total_pts,
            "unlocked_count": len(unlocked_list),
            "locked_count": len(locked_list),
            "total_count": len(defs),
            "progress_pct": min(
                100.0, round((len(unlocked_list) / max(1, len(defs))) * 100, 1)
            ),
            "unlocked": unlocked_list,
            "locked": locked_list,
        }


def get_global_achievements_feed() -> Dict[str, Any]:
    """Zwraca globalne podsumowanie osiągnięć (Hala Chwały, Server Firsts, Ranking, Feed)."""
    with get_db() as conn:
        total_defs = conn.execute(
            "SELECT COUNT(*) AS c FROM achievements_definitions"
        ).fetchone()["c"]
        total_unlocked_instances = conn.execute(
            "SELECT COUNT(*) AS c FROM profile_achievements"
        ).fetchone()["c"]
        pts_row = conn.execute(
            """
            SELECT COALESCE(SUM(ad.points), 0) AS pts
            FROM profile_achievements pa
            JOIN achievements_definitions ad ON pa.achievement_id = ad.id
            """
        ).fetchone()
        total_pts = pts_row["pts"] if pts_row else 0
        total_peasants_with_ach = conn.execute(
            "SELECT COUNT(DISTINCT profile_id) AS c FROM profile_achievements"
        ).fetchone()["c"]
        total_profiles = max(
            1, conn.execute("SELECT COUNT(*) AS c FROM profiles").fetchone()["c"]
        )

        sf_rows = conn.execute(
            """
            SELECT *
            FROM achievements_definitions
            WHERE is_server_first = 1
            ORDER BY points ASC, id ASC
            """
        ).fetchall()
        server_firsts = [
            {
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "points": r["points"],
                "icon": r["icon"],
                "rarity": r["rarity"],
                "is_claimed": bool(r["first_achieved_by_id"]),
                "first_achieved_by_id": r["first_achieved_by_id"],
                "first_achieved_by_name": r["first_achieved_by_name"],
                "first_achieved_at": r["first_achieved_at"],
            }
            for r in sf_rows
        ]

        lead_id = conn.execute(
            "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_id'"
        ).fetchone()
        lead_days = conn.execute(
            "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_days'"
        ).fetchone()
        lead_name = conn.execute(
            "SELECT value FROM economy_simulator_state WHERE key = 'billboard_leader_name'"
        ).fetchone()

        billboard_info = {
            "leader_id": int(lead_id["value"]) if lead_id else None,
            "leader_name": lead_name["value"] if lead_name else "Brak lidera",
            "days_held": int(lead_days["value"]) if lead_days else 0,
            "target_days": 7,
        }

        all_defs = conn.execute(
            "SELECT * FROM achievements_definitions ORDER BY points ASC, id ASC"
        ).fetchall()
        counts_map = {
            r["achievement_id"]: r["c"]
            for r in conn.execute(
                "SELECT achievement_id, COUNT(*) AS c FROM profile_achievements GROUP BY achievement_id"
            ).fetchall()
        }

        achievements_list = []
        for d in all_defs:
            unlocked_cnt = counts_map.get(d["id"], 0)
            achievements_list.append(
                {
                    "id": d["id"],
                    "title": d["title"],
                    "description": d["description"],
                    "category": d["category"],
                    "rarity": d["rarity"],
                    "points": d["points"],
                    "icon": d["icon"],
                    "is_server_first": bool(d["is_server_first"]),
                    "first_achieved_by_id": d["first_achieved_by_id"],
                    "first_achieved_by_name": d["first_achieved_by_name"],
                    "first_achieved_at": d["first_achieved_at"],
                    "unlocked_count": unlocked_cnt,
                    "unlocked_pct": min(
                        100.0, round((unlocked_cnt / total_profiles) * 100, 1)
                    ),
                }
            )

        leaderboard_rows = conn.execute(
            """
            SELECT p.id, p.name, p.location_name, p.chlopocoin_balance, p.achievement_points,
                   (SELECT COUNT(*) FROM profile_achievements pa WHERE pa.profile_id = p.id) AS achievements_count
            FROM profiles p
            WHERE p.achievement_points > 0
            ORDER BY p.achievement_points DESC, p.chlopocoin_balance DESC, p.id ASC
            LIMIT 25
            """
        ).fetchall()
        leaderboard = [
            {
                "id": r["id"],
                "name": r["name"],
                "location_name": r["location_name"] or "Polska",
                "chlopocoin_balance": r["chlopocoin_balance"],
                "achievement_points": r["achievement_points"],
                "achievements_count": r["achievements_count"],
            }
            for r in leaderboard_rows
        ]

        recent_rows = conn.execute(
            """
            SELECT pa.achieved_at, p.id AS profile_id, p.name AS profile_name,
                   ad.id AS achievement_id, ad.title, ad.points, ad.icon, ad.rarity
            FROM profile_achievements pa
            JOIN profiles p ON pa.profile_id = p.id
            JOIN achievements_definitions ad ON pa.achievement_id = ad.id
            ORDER BY pa.id DESC
            LIMIT 15
            """
        ).fetchall()
        recent_feed = [
            {
                "profile_id": r["profile_id"],
                "profile_name": r["profile_name"],
                "achievement_id": r["achievement_id"],
                "title": r["title"],
                "points": r["points"],
                "icon": r["icon"],
                "rarity": r["rarity"],
                "achieved_at": r["achieved_at"],
            }
            for r in recent_rows
        ]

        return {
            "stats": {
                "total_definitions": total_defs,
                "total_unlocked_instances": total_unlocked_instances,
                "total_points_distributed": total_pts,
                "server_firsts_count": len(server_firsts),
                "server_firsts_claimed": sum(
                    1 for s in server_firsts if s["is_claimed"]
                ),
                "peasants_with_achievements": total_peasants_with_ach,
            },
            "server_firsts": server_firsts,
            "billboard": billboard_info,
            "achievements": achievements_list,
            "leaderboard": leaderboard,
            "recent_feed": recent_feed,
        }


def pop_achievement_notifications(profile_id: int) -> List[Dict[str, Any]]:
    """Pobiera nieprzeczytane powiadomienia o osiągnięciach i oznacza je jako przeczytane."""
    with get_db() as conn:
        evaluate_achievements_for_profile(conn, profile_id)

        rows = conn.execute(
            """
            SELECT pa.id AS link_id, pa.achieved_at, ad.*
            FROM profile_achievements pa
            JOIN achievements_definitions ad ON pa.achievement_id = ad.id
            WHERE pa.profile_id = ? AND pa.notified = 0
            ORDER BY pa.id ASC
            """,
            (profile_id,),
        ).fetchall()

        if not rows:
            return []

        unnotified_ids = [r["link_id"] for r in rows]
        ph = ",".join("?" for _ in unnotified_ids)
        conn.execute(
            f"UPDATE profile_achievements SET notified = 1 WHERE id IN ({ph})",
            unnotified_ids,
        )

        return [
            {
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "category": r["category"],
                "rarity": r["rarity"],
                "points": r["points"],
                "icon": r["icon"],
                "is_server_first": bool(r["is_server_first"]),
                "achieved_at": r["achieved_at"],
            }
            for r in rows
        ]
