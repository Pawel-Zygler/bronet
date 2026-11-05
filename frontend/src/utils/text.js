const PL_MAP = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function normalizeText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_MAP[ch] || ch);
}

export function computeOverlapSet(listA) {
  const s = new Set();
  (listA || []).forEach((item) => {
    const n = normalizeText(item);
    if (n) s.add(n);
  });
  return s;
}

export function mergeUniqueSkills(currentList, rawValue) {
  if (!rawValue) return currentList;
  const parts = String(rawValue)
    .split(",")
    .map((s) => s.trim().replace(/\.+$/, "").trim())
    .filter(Boolean);

  if (parts.length === 0) return currentList;

  const existingNorms = new Set(currentList.map((item) => normalizeText(item)));
  const additions = [];
  parts.forEach((part) => {
    const n = normalizeText(part);
    if (n && !existingNorms.has(n)) {
      existingNorms.add(n);
      additions.push(part);
    }
  });

  return additions.length > 0 ? [...currentList, ...additions] : currentList;
}

const MALE_EXCEPTIONS_A = new Set([
  "kuba", "barnaba", "kosma", "bonawentura", "jarema", "zawisza",
  "akira", "mustafa", "luca", "andrea", "sasha", "eliah"
]);

const FEMALE_NAMES = new Set([
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
]);

export function isFemaleName(name) {
  if (!name) return false;
  const cleaned = normalizeText(name);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  const first = parts[0].replace(/[^a-z]/g, "");
  if (!first) return false;
  if (FEMALE_NAMES.has(first)) return true;
  if (first.endsWith("a") && !MALE_EXCEPTIONS_A.has(first)) return true;
  return false;
}

