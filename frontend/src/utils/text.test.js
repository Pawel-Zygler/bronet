import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeOverlapSet, isFemaleName, mergeUniqueSkills, normalizeText } from "./text";

const menOnlyCases = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../tests/fixtures/men_only_cases.json", import.meta.url)), "utf8")
);

describe("normalizeText", () => {
  it("zamienia na małe litery, przycina i zwija białe znaki", () => {
    expect(normalizeText("  Hydraulik   Wodny \t")).toBe("hydraulik wodny");
  });

  it("usuwa polskie znaki diakrytyczne, także z wielkich liter", () => {
    expect(normalizeText("ŻÓŁĆ Gęślą Jaźń")).toBe("zolc gesla jazn");
  });

  it.each([null, undefined, ""])("zwraca pusty napis dla %s", (value) => {
    expect(normalizeText(value)).toBe("");
  });

  it("zamienia liczby na tekst", () => {
    expect(normalizeText(42)).toBe("42");
  });
});

describe("computeOverlapSet", () => {
  it("zwraca znormalizowane, unikalne wartości bez pustych", () => {
    expect(computeOverlapSet(["Związki", "zwiazki", "  ", "SDLC"])).toEqual(new Set(["zwiazki", "sdlc"]));
  });

  it("toleruje brak listy", () => {
    expect(computeOverlapSet(undefined)).toEqual(new Set());
  });
});

describe("mergeUniqueSkills", () => {
  it("dzieli wpis po przecinkach i dokleja nowe umiejętności", () => {
    expect(mergeUniqueSkills(["python"], "qa, sdlc")).toEqual(["python", "qa", "sdlc"]);
  });

  it("pomija duplikaty niezależnie od wielkości liter i polskich znaków", () => {
    expect(mergeUniqueSkills(["Związki"], "zwiazki, ZWIĄZKI, finanse")).toEqual(["Związki", "finanse"]);
  });

  it("usuwa kropki na końcu i puste fragmenty", () => {
    expect(mergeUniqueSkills([], "spawanie.., , stolarka.")).toEqual(["spawanie", "stolarka"]);
  });

  it("zwraca tę samą tablicę, gdy nic nie dodano", () => {
    const current = ["qa"];
    expect(mergeUniqueSkills(current, "QA")).toBe(current);
    expect(mergeUniqueSkills(current, "")).toBe(current);
    expect(mergeUniqueSkills(current, " , ")).toBe(current);
  });
});

describe("isFemaleName (men only, wspólne przypadki z backendem)", () => {
  it.each(menOnlyCases.female_names)("odrzuca żeńskie imię %j", (name) => {
    expect(isFemaleName(name)).toBe(true);
  });

  it.each(menOnlyCases.male_names)("przepuszcza męskie imię %j", (name) => {
    expect(isFemaleName(name)).toBe(false);
  });

  it("sprawdza tylko pierwszy człon imienia", () => {
    expect(isFemaleName("Marek Anna")).toBe(false);
  });
});
