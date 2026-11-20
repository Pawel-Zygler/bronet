// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeView } from "./HomeView";

const makeProfiles = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Chłop ${i + 1}`,
    email: `chlop${i + 1}@bronet.test`,
    can_help: ["hydraulika"],
    need_help: ["it"],
  }));

const catalog = {
  all: [{ skill: "hydraulika" }, { skill: "it" }],
  can_help: [{ skill: "hydraulika" }],
  need_help: [{ skill: "it" }],
};

// Stan wyszukiwania trzyma App, więc test owija HomeView minimalnym kontenerem.
function Harness({ profiles, initialQuery = "", initialMode = "all", compact = false, onOpenProfile = () => {} }) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState(initialMode);
  return (
    <HomeView
      searchQuery={query}
      searchMode={mode}
      skillsCatalog={catalog}
      profiles={profiles}
      isSearching={false}
      searchError=""
      myProfile={null}
      isCompactView={compact}
      onSearchChange={(q, m) => {
        setQuery(q);
        setMode(m);
      }}
      onSearchSubmit={() => {}}
      onOpenProfile={onOpenProfile}
    />
  );
}

const cards = () => document.querySelectorAll(".profile-card");
const pageLabel = () => document.querySelector(".pagination-current-page").textContent;

beforeEach(() => {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("HomeView: stronicowanie", () => {
  it("pokazuje 15 kart na stronę i przełącza strony", () => {
    render(<Harness profiles={makeProfiles(40)} />);

    expect(cards()).toHaveLength(15);
    expect(pageLabel()).toContain("Strona 1 z 3");
    expect(document.getElementById("pagination-prev").disabled).toBe(true);

    fireEvent.click(document.getElementById("pagination-next"));
    expect(pageLabel()).toContain("Strona 2 z 3");
    expect(document.getElementById("pagination-prev").disabled).toBe(false);

    fireEvent.click(document.getElementById("pagination-next"));
    expect(cards()).toHaveLength(10);
    expect(document.getElementById("pagination-next").disabled).toBe(true);
  });

  it("nie pokazuje paska stron przy jednej stronie", () => {
    render(<Harness profiles={makeProfiles(15)} />);
    expect(document.querySelector(".pagination-bar")).toBeNull();
  });

  it("zmiana frazy wraca na pierwszą stronę", () => {
    render(<Harness profiles={makeProfiles(40)} />);
    fireEvent.click(document.getElementById("pagination-next"));
    fireEvent.change(document.getElementById("search-input"), { target: { value: "hydraulika" } });
    expect(pageLabel()).toContain("Strona 1 z 3");
  });

  it("w widoku kompaktowym też obowiązuje limit 15", () => {
    render(<Harness profiles={makeProfiles(40)} compact />);
    expect(document.querySelectorAll(".compact-profile-item")).toHaveLength(15);
    expect(cards()).toHaveLength(0);
  });
});

describe("HomeView: wyszukiwarka i filtry", () => {
  it("filtry zakresu ustawiają aria-pressed i opis wyników", () => {
    render(<Harness profiles={makeProfiles(3)} initialQuery="hydraulik" />);
    const filters = within(screen.getByRole("group", { name: "Filtruj zakres wyszukiwania" }));

    fireEvent.click(filters.getByRole("button", { name: "Umiem (kto pomoże)" }));
    expect(filters.getByRole("button", { name: "Umiem (kto pomoże)" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".active-filter-hint").textContent).toBe("Szukasz „hydraulik” w sekcji „Umiem”");

    fireEvent.click(filters.getByRole("button", { name: "Potrzebuję (kto szuka)" }));
    expect(document.querySelector(".active-filter-hint").textContent).toBe("Szukasz „hydraulik” w sekcji „Potrzebuję”");

    fireEvent.click(filters.getByRole("button", { name: "Wszystkie" }));
    expect(document.querySelector(".active-filter-hint").textContent).toBe("Filtr: „hydraulik”");
  });

  it("chip popularnej umiejętności wpisuje frazę, a drugie kliknięcie ją czyści", () => {
    render(<Harness profiles={makeProfiles(3)} />);
    const chip = within(screen.getByRole("group", { name: "Popularne umiejętności" })).getByRole("button", {
      name: "hydraulika",
    });

    fireEvent.click(chip);
    expect(document.getElementById("search-input").value).toBe("hydraulika");
    expect(chip.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip);
    expect(document.getElementById("search-input").value).toBe("");
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  it("przycisk × i klawisz Escape czyszczą wyszukiwanie", () => {
    render(<Harness profiles={makeProfiles(3)} initialQuery="qa" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść wyszukiwanie" }));
    expect(document.getElementById("search-input").value).toBe("");
    expect(document.querySelector(".search-clear")).toBeNull();

    fireEvent.change(document.getElementById("search-input"), { target: { value: "it" } });
    fireEvent.keyDown(document.getElementById("search-input"), { key: "Escape" });
    expect(document.getElementById("search-input").value).toBe("");
  });

  it("brak wyników pokazuje komunikat z frazą", () => {
    render(<Harness profiles={[]} initialQuery="kasia" />);
    expect(document.querySelector(".empty-state").textContent).toContain("Brak profili pasujących do wyszukiwania „kasia”");
  });
});

describe("HomeView: widok kompaktowy", () => {
  it("pokazuje etykiety, mailto i link do profilu", () => {
    const onOpenProfile = vi.fn();
    render(<Harness profiles={makeProfiles(1)} compact onOpenProfile={onOpenProfile} />);
    const item = document.querySelector(".compact-profile-item");

    expect(item.querySelector(".compact-label").textContent).toBe("pomaga z:");
    expect(item.querySelector(".compact-email-btn").getAttribute("href")).toBe("mailto:chlop1@bronet.test");

    fireEvent.click(item.querySelector(".compact-profile-link"));
    expect(onOpenProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
