import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiSend } from "./api";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("brak JSON")) : Promise.resolve(body)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null });
});

describe("apiGet", () => {
  it("zwraca sparsowany JSON przy sukcesie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/api/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({ headers: { Accept: "application/json" } }));
  });

  it("rzuca błąd z polem detail i statusem z odpowiedzi API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { detail: "Nie znaleziono profilu" })));

    await expect(apiGet("/api/profiles/1")).rejects.toMatchObject({ message: "Nie znaleziono profilu", status: 404 });
  });

  it("rzuca ogólny błąd, gdy odpowiedź nie ma JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));

    await expect(apiGet("/api/x")).rejects.toMatchObject({ message: "Błąd HTTP 500", status: 500 });
  });
});

describe("apiSend", () => {
  it("wysyła body jako JSON z właściwą metodą", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: 7 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiSend("/api/profiles", "POST", { name: "Marek" })).resolves.toEqual({ id: 7 });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "Marek" }));
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("nie wysyła body, gdy go brak", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await apiSend("/api/x", "DELETE");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("rzuca błąd z detail i statusem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { detail: "men only" })));

    await expect(apiSend("/api/profiles", "POST", {})).rejects.toMatchObject({ message: "men only", status: 422 });
  });

  it("rzuca ogólny błąd zapisu, gdy odpowiedź nie ma JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503)));

    await expect(apiSend("/api/x", "PUT", {})).rejects.toMatchObject({ message: "Błąd zapisu (503)", status: 503 });
  });
});
