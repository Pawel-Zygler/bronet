import { describe, expect, it } from "vitest";
import { POLAND_BOUNDS, calculateDistanceKm, findCityCoords, projectCoords } from "./cities";

describe("findCityCoords", () => {
  it("znajduje miasto bez względu na wielkość liter i spacje", () => {
    expect(findCityCoords("  zakopane ")).toEqual({ name: "Zakopane", lat: 49.2992, lng: 19.9496 });
  });

  it("dopasowuje miasto zawarte w dłuższym opisie", () => {
    expect(findCityCoords("okolice Legnica, dolny śląsk")?.name).toBe("Legnica");
  });

  it.each([null, undefined, "", "Atlantyda"])("zwraca null dla %j", (value) => {
    expect(findCityCoords(value)).toBeNull();
  });
});

describe("projectCoords", () => {
  it("rzutuje róg granic Polski na róg obszaru z marginesem", () => {
    expect(projectCoords(POLAND_BOUNDS.maxLat, POLAND_BOUNDS.minLng)).toEqual({ x: 50, y: 45 });
    expect(projectCoords(POLAND_BOUNDS.minLat, POLAND_BOUNDS.maxLng)).toEqual({ x: 850, y: 655 });
  });

  it("przycina punkty spoza Polski do krawędzi", () => {
    expect(projectCoords(90, 180)).toEqual(projectCoords(POLAND_BOUNDS.maxLat, POLAND_BOUNDS.maxLng));
  });

  it("zwraca null dla współrzędnych, które nie są liczbami", () => {
    expect(projectCoords("52", 21)).toBeNull();
    expect(projectCoords(52, undefined)).toBeNull();
  });
});

describe("calculateDistanceKm", () => {
  it("liczy odległość Warszawa–Kraków (ok. 252 km)", () => {
    const km = calculateDistanceKm(52.2297, 21.0122, 50.0647, 19.945);
    expect(km).toBeGreaterThanOrEqual(250);
    expect(km).toBeLessThanOrEqual(255);
  });

  it("zwraca 0 dla tego samego punktu", () => {
    expect(calculateDistanceKm(50, 20, 50, 20)).toBe(0);
  });

  it("zwraca null, gdy brakuje współrzędnej", () => {
    expect(calculateDistanceKm(50, 20, null, 20)).toBeNull();
  });
});
