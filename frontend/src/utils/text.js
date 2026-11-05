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

