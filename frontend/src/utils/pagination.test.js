import { describe, expect, it } from "vitest";
import { PAGE_SIZE, paginate } from "./pagination";

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("domyślnie pokazuje 15 elementów na stronę", () => {
    expect(PAGE_SIZE).toBe(15);
    const result = paginate(range(40), 1);
    expect(result.pageItems).toEqual(range(15));
    expect(result.totalPages).toBe(3);
  });

  it("zwraca właściwy wycinek i indeksy dla środkowej strony", () => {
    const result = paginate(range(40), 2);
    expect(result.page).toBe(2);
    expect(result.startIndex).toBe(15);
    expect(result.endIndex).toBe(30);
    expect(result.pageItems).toEqual(range(30).slice(15));
  });

  it("ostatnia strona może być niepełna", () => {
    const result = paginate(range(40), 3);
    expect(result.pageItems).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
    expect(result.endIndex).toBe(40);
  });

  it("przycina numer strony do dostępnego zakresu", () => {
    expect(paginate(range(40), 99).page).toBe(3);
    expect(paginate(range(40), 0).page).toBe(1);
    expect(paginate(range(40), -5).page).toBe(1);
    expect(paginate(range(40), "abc").page).toBe(1);
  });

  it("dla pustej lub brakującej listy zwraca jedną pustą stronę", () => {
    for (const items of [[], null, undefined]) {
      const result = paginate(items, 2);
      expect(result).toEqual({ page: 1, totalPages: 1, startIndex: 0, endIndex: 0, pageItems: [] });
    }
  });

  it("dokładnie pełne strony nie tworzą pustej strony na końcu", () => {
    expect(paginate(range(30), 1).totalPages).toBe(2);
  });

  it("obsługuje własny rozmiar strony", () => {
    expect(paginate(range(5), 2, 2).pageItems).toEqual([3, 4]);
  });
});
