// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../test-utils/mockApi";
import { ProfileDetailView } from "./ProfileDetailView";

const me = { id: 1, name: "Wojtek", can_help: [], need_help: [] };
const mirek = { id: 2, name: "Mirek", can_help: ["tokarka"], need_help: ["spawanie"], chlopocoin_balance: 0 };

function statusRoute(status) {
  return ["GET", "/api/profiles/1/chlopocoin-status", status];
}

const baseRoutes = [
  ["GET", "/api/profiles/2/chlopocoin-stats", { balance: 0, completed_helps: 0, pending: 0, blocks: [] }],
  ["GET", "/api/achievements/profile/2", { unlocked: [], locked: [], total_points: 0 }],
  ["GET", /^\/api\/profiles\/\d+$/, (url) => (url.endsWith("/2") ? mirek : me)],
];

function renderDetail(props = {}) {
  return render(
    <ProfileDetailView
      profileId={2}
      cachedProfile={mirek}
      myProfile={me}
      onCacheProfile={() => {}}
      onBackToSearch={() => {}}
      onJumpToSkillSearch={() => {}}
      onOpenProfile={() => {}}
      onNavigate={() => {}}
      {...props}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProfileDetailView: Chłopocoin 2/2", () => {
  it("gość nie widzi panelu coina", async () => {
    mockApi(baseRoutes);
    renderDetail({ myProfile: null });
    await screen.findByText("Mirek", { selector: "#detail-heading" });
    expect(document.getElementById("chlopocoin-action-box")).toBeNull();
  });

  it("na własnym profilu nie ma panelu coina", async () => {
    mockApi(baseRoutes);
    renderDetail({ myProfile: { ...me, id: 2 } });
    await screen.findByText("Mirek", { selector: "#detail-heading" });
    expect(document.getElementById("chlopocoin-action-box")).toBeNull();
  });

  it("pierwsze potwierdzenie wysyła confirm-help i pokazuje oczekiwanie 1/2", async () => {
    const onRefreshMyProfile = vi.fn();
    const fetchMock = mockApi([
      statusRoute({ confirmed_by_me: false, confirmed_by_them: false, mutual_settled: false }),
      ["POST", "/api/profiles/1/confirm-help", { status: "pending", mutual_settled: false, message: "Zapisano (1/2)" }],
      ...baseRoutes,
    ]);
    renderDetail({ onRefreshMyProfile });

    await waitFor(() => expect(document.getElementById("chlopocoin-initial-box")).not.toBeNull());
    fireEvent.click(document.getElementById("btn-grant-chlopocoin"));

    await waitFor(() => expect(document.getElementById("chlopocoin-pending-box")).not.toBeNull());
    expect(document.getElementById("chlopocoin-pending-box").textContent).toContain("Twoje potwierdzenie zapisane (1/2)");
    expect(document.getElementById("btn-grant-chlopocoin").disabled).toBe(true);
    expect(screen.getByText("Zapisano (1/2)")).toBeTruthy();

    const confirmCall = fetchMock.mock.calls.find(([url, opts]) => url.endsWith("/confirm-help") && opts.method === "POST");
    expect(JSON.parse(confirmCall[1].body)).toMatchObject({ other_profile_id: 2 });
    expect(onRefreshMyProfile).toHaveBeenCalled();
  });

  it("gdy druga strona już potwierdziła, kliknięcie wybija blok i pokazuje 2/2", async () => {
    mockApi([
      statusRoute({ confirmed_by_me: false, confirmed_by_them: true, mutual_settled: false }),
      [
        "POST",
        "/api/profiles/1/confirm-help",
        { status: "minted", mutual_settled: true, block_index: 7, block_hash: "a".repeat(64) },
      ],
      ...baseRoutes,
    ]);
    renderDetail();

    const ready = await waitFor(() => {
      const el = document.getElementById("chlopocoin-ready-box");
      expect(el).not.toBeNull();
      return el;
    });
    expect(ready.textContent).toContain("Mirek już potwierdził pomoc z Tobą!");
    fireEvent.click(document.getElementById("btn-grant-chlopocoin"));

    await waitFor(() => expect(document.getElementById("chlopocoin-settled-box")).not.toBeNull());
    const settled = document.getElementById("chlopocoin-settled-box");
    expect(settled.textContent).toContain("Chłopocoin przyznany obu profilom (2/2)");
    expect(settled.textContent).toContain("Blok Chłopchain #7");
  });

  it("rozliczona wymiana pokazuje stan 2/2 bez przycisku", async () => {
    mockApi([
      statusRoute({ confirmed_by_me: true, confirmed_by_them: true, mutual_settled: true, block_index: 3, block_hash: "b".repeat(64) }),
      ...baseRoutes,
    ]);
    renderDetail();

    await waitFor(() => expect(document.getElementById("chlopocoin-settled-box")).not.toBeNull());
    expect(document.getElementById("btn-grant-chlopocoin")).toBeNull();
  });

  it("błąd API pokazuje komunikat i nie zmienia stanu", async () => {
    mockApi([
      statusRoute({ confirmed_by_me: false, confirmed_by_them: false, mutual_settled: false }),
      ["POST", "/api/profiles/1/confirm-help", { status: 403, body: { detail: "Brak uprawnień do tego profilu." } }],
      ...baseRoutes,
    ]);
    renderDetail();

    await waitFor(() => expect(document.getElementById("chlopocoin-initial-box")).not.toBeNull());
    fireEvent.click(document.getElementById("btn-grant-chlopocoin"));

    await screen.findByText("Brak uprawnień do tego profilu.");
    expect(document.getElementById("chlopocoin-initial-box")).not.toBeNull();
    expect(document.getElementById("chlopocoin-pending-box")).toBeNull();
  });
});
