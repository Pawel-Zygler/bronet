// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WowAchievementNotification } from "./WowAchievementNotification";

const firstAid = {
  id: "first_aid_1",
  title: "Pierwsza pomoc!",
  description: "Zdobądź swój 1. Chłopocoin.",
  points: 10,
  icon: "🩹",
  rarity: "common",
  is_server_first: false,
};
const serverFirst = {
  id: "server_first_10",
  title: "Server first: 10 Coinów!",
  description: "Pierwszy na serwerze.",
  points: 50,
  rarity: "legendary",
  is_server_first: true,
};

function unlock(detail) {
  act(() => {
    window.dispatchEvent(new CustomEvent("bronet_achievement_unlocked", { detail }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WowAchievementNotification", () => {
  it("nic nie pokazuje bez zdarzenia", () => {
    const { container } = render(<WowAchievementNotification myProfile={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("pokazuje toast po zdarzeniu bronet_achievement_unlocked", () => {
    render(<WowAchievementNotification myProfile={null} />);
    unlock(firstAid);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("OSIĄGNIĘCIE ZDOBYTE!")).toBeTruthy();
    expect(document.getElementById("wow-toast-title").textContent).toBe("Pierwsza pomoc!");
    expect(document.getElementById("wow-toast-points").textContent).toContain("+10");
  });

  it("dla osiągnięcia serwera pokazuje nagłówek Realm First i domyślną ikonę", () => {
    render(<WowAchievementNotification myProfile={null} />);
    unlock(serverFirst);

    expect(screen.getByText("REALM FIRST! OSIĄGNIĘCIE SERWERA")).toBeTruthy();
    expect(document.getElementById("wow-achievement-toast").className).toContain("is-server-first");
    expect(document.querySelector(".wow-toast-icon").textContent).toBe("🏆");
  });

  it("kolejkuje kilka osiągnięć i pokazuje je po kolei", () => {
    render(<WowAchievementNotification myProfile={null} />);
    unlock([firstAid, serverFirst]);
    expect(document.getElementById("wow-toast-title").textContent).toBe("Pierwsza pomoc!");

    act(() => {
      vi.advanceTimersByTime(6200);
    });
    expect(document.getElementById("wow-toast-title").textContent).toBe("Server first: 10 Coinów!");

    act(() => {
      vi.advanceTimersByTime(6200);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("przycisk X zamyka toast i nie nawiguje", () => {
    const onNavigate = vi.fn();
    render(<WowAchievementNotification myProfile={null} onNavigate={onNavigate} />);
    unlock(firstAid);

    fireEvent.click(screen.getByRole("button", { name: "Zamknij powiadomienie" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("kliknięcie w toast prowadzi do Hali Chwały", () => {
    const onNavigate = vi.fn();
    render(<WowAchievementNotification myProfile={null} onNavigate={onNavigate} />);
    unlock(firstAid);

    fireEvent.click(document.getElementById("wow-achievement-toast"));
    expect(onNavigate).toHaveBeenCalledWith("/osiagniecia");
  });

  it("dla zalogowanego profilu pobiera powiadomienia z API i odpytuje co 6 s", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([firstAid]) })
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);

    render(<WowAchievementNotification myProfile={{ id: 7 }} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/achievements/notifications", expect.anything());
    expect(document.getElementById("wow-toast-title").textContent).toBe("Pierwsza pomoc!");

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
