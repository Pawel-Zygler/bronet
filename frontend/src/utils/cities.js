export const POLAND_BOUNDS = {
  minLat: 49.0,
  maxLat: 54.85,
  minLng: 14.12,
  maxLng: 24.15,
};

export const POPULAR_CITIES = [
  { name: "Warszawa", lat: 52.2297, lng: 21.0122, voivodeship: "mazowieckie" },
  { name: "Kraków", lat: 50.0647, lng: 19.945, voivodeship: "małopolskie" },
  { name: "Wrocław", lat: 51.1079, lng: 17.0385, voivodeship: "dolnośląskie" },
  { name: "Łódź", lat: 51.7592, lng: 19.456, voivodeship: "łódzkie" },
  { name: "Poznań", lat: 52.4064, lng: 16.9252, voivodeship: "wielkopolskie" },
  { name: "Gdańsk", lat: 54.352, lng: 18.6466, voivodeship: "pomorskie" },
  { name: "Szczecin", lat: 53.4285, lng: 14.5528, voivodeship: "zachodniopomorskie" },
  { name: "Bydgoszcz", lat: 53.1235, lng: 18.0084, voivodeship: "kujawsko-pomorskie" },
  { name: "Lublin", lat: 51.2465, lng: 22.5684, voivodeship: "lubelskie" },
  { name: "Białystok", lat: 53.1325, lng: 23.1688, voivodeship: "podlaskie" },
  { name: "Katowice", lat: 50.2649, lng: 19.0238, voivodeship: "śląskie" },
  { name: "Gdynia", lat: 54.5189, lng: 18.5305, voivodeship: "pomorskie" },
  { name: "Częstochowa", lat: 50.8118, lng: 19.1203, voivodeship: "śląskie" },
  { name: "Radom", lat: 51.4027, lng: 21.1471, voivodeship: "mazowieckie" },
  { name: "Toruń", lat: 53.0138, lng: 18.5984, voivodeship: "kujawsko-pomorskie" },
  { name: "Rzeszów", lat: 50.0412, lng: 21.9991, voivodeship: "podkarpackie" },
  { name: "Kielce", lat: 50.8661, lng: 20.6286, voivodeship: "świętokrzyskie" },
  { name: "Gliwice", lat: 50.2945, lng: 18.6714, voivodeship: "śląskie" },
  { name: "Olsztyn", lat: 53.7784, lng: 20.4801, voivodeship: "warmińsko-mazurskie" },
  { name: "Bielsko-Biała", lat: 49.8224, lng: 19.0469, voivodeship: "śląskie" },
  { name: "Zielona Góra", lat: 51.9356, lng: 15.5062, voivodeship: "lubuskie" },
  { name: "Opole", lat: 50.6751, lng: 17.9213, voivodeship: "opolskie" },
  { name: "Gorzów Wlkp.", lat: 52.7368, lng: 15.2288, voivodeship: "lubuskie" },
  { name: "Płock", lat: 52.5463, lng: 19.7065, voivodeship: "mazowieckie" },
  { name: "Koszalin", lat: 54.1944, lng: 16.1722, voivodeship: "zachodniopomorskie" },
  { name: "Tarnów", lat: 50.0121, lng: 20.9858, voivodeship: "małopolskie" },
  { name: "Kalisz", lat: 51.7611, lng: 18.091, voivodeship: "wielkopolskie" },
  { name: "Legnica", lat: 51.207, lng: 16.1553, voivodeship: "dolnośląskie" },
  { name: "Zakopane", lat: 49.2992, lng: 19.9496, voivodeship: "małopolskie" },
];

export function findCityCoords(cityName) {
  if (!cityName) return null;
  const clean = cityName.trim().toLowerCase();
  const match = POPULAR_CITIES.find(
    (c) => c.name.toLowerCase() === clean || clean.includes(c.name.toLowerCase())
  );
  if (match) {
    return { name: match.name, lat: match.lat, lng: match.lng };
  }
  return null;
}

export function projectCoords(lat, lng, width = 900, height = 700) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const padX = 50;
  const padY = 45;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;

  const clampedLng = Math.min(Math.max(lng, POLAND_BOUNDS.minLng), POLAND_BOUNDS.maxLng);
  const clampedLat = Math.min(Math.max(lat, POLAND_BOUNDS.minLat), POLAND_BOUNDS.maxLat);

  const x =
    padX + ((clampedLng - POLAND_BOUNDS.minLng) / (POLAND_BOUNDS.maxLng - POLAND_BOUNDS.minLng)) * innerW;
  const y =
    padY + ((POLAND_BOUNDS.maxLat - clampedLat) / (POLAND_BOUNDS.maxLat - POLAND_BOUNDS.minLat)) * innerH;

  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
