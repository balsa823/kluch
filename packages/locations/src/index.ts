export { MNE_POLYGONS, cityPolygon, areaPolygon, type PolyGeometry } from "./polygons.js";

export type MneCity = { city: string; areas: string[] };

/** Fixed Montenegro cities + curated areas. Single source of truth for both the
 * white-label site (render + parse) and the agency console (editor dropdowns). */
export const MNE_LOCATIONS: MneCity[] = [
  { city: "Podgorica", areas: ["Blok 5", "Blok 6", "Blok 9", "Stari Aerodrom", "Zabjelo", "Konik", "City Kvart", "Preko Morače", "Tološi", "Momišići", "Dalmatinska", "Drač", "Masline", "Zagorič"] },
  { city: "Budva", areas: ["Stari grad", "Bečići", "Rafailovići", "Pržno", "Sveti Stefan", "Petrovac", "Babin Do", "Rozino"] },
  { city: "Bar", areas: ["Stari Bar", "Šušanj", "Topolica", "Bjeliši", "Sutomore", "Čanj", "Dobra Voda"] },
  { city: "Kotor", areas: ["Stari grad", "Dobrota", "Muo", "Prčanj", "Škaljari", "Risan", "Perast", "Stoliv"] },
  { city: "Tivat", areas: ["Porto Montenegro", "Seljanovo", "Donja Lastva", "Gornja Lastva", "Krašići", "Lepetane", "Đuraševići"] },
  { city: "Herceg Novi", areas: ["Igalo", "Meljine", "Topla", "Savina", "Baošići", "Bijela", "Kumbor", "Đenovići", "Zelenika"] },
  { city: "Ulcinj", areas: ["Pinješ", "Štoj", "Velika plaža", "Ada Bojana", "Valdanos"] },
  { city: "Nikšić", areas: [] },
  { city: "Cetinje", areas: [] },
  { city: "Danilovgrad", areas: [] },
  { city: "Bijelo Polje", areas: [] },
  { city: "Berane", areas: [] },
  { city: "Kolašin", areas: [] },
  { city: "Žabljak", areas: [] },
  { city: "Pljevlja", areas: [] },
  { city: "Rožaje", areas: [] },
];

/** City names, in display order. */
export function cityNames(): string[] {
  return MNE_LOCATIONS.map((c) => c.city);
}

/** Areas of a city, or [] if the city is unknown or has no curated areas. */
export function areasFor(city: string): string[] {
  return MNE_LOCATIONS.find((c) => c.city === city)?.areas ?? [];
}

/** Whether `area` is a known curated area of `city`. */
export function isKnownArea(city: string, area: string): boolean {
  return areasFor(city).includes(area);
}

// --- Approximate coordinates -------------------------------------------------
// NOTE: all coordinates below are APPROXIMATE / ILLUSTRATIVE city & area centres
// (hand-picked, not surveyed). They are only used to place map pins/circles and
// must not be treated as authoritative boundaries. Unknown city/area → null and
// callers fall back to the city centre (or drop the pin entirely).

export interface LatLng {
  lat: number;
  lng: number;
}

/** Approximate centre of each MNE city. Keys must match `MNE_LOCATIONS` city strings. */
const CITY_COORDS: Record<string, LatLng> = {
  Podgorica: { lat: 42.4411, lng: 19.2627 },
  Budva: { lat: 42.2911, lng: 18.84 },
  Bar: { lat: 42.0939, lng: 19.1003 },
  Kotor: { lat: 42.4247, lng: 18.7712 },
  Tivat: { lat: 42.437, lng: 18.696 },
  "Herceg Novi": { lat: 42.4531, lng: 18.5375 },
  Ulcinj: { lat: 41.9294, lng: 19.2244 },
  Nikšić: { lat: 42.7731, lng: 18.9446 },
  Cetinje: { lat: 42.3911, lng: 18.9116 },
  Danilovgrad: { lat: 42.554, lng: 19.108 },
  "Bijelo Polje": { lat: 43.0383, lng: 19.7458 },
  Berane: { lat: 42.8469, lng: 19.8744 },
  Kolašin: { lat: 42.8222, lng: 19.5183 },
  Žabljak: { lat: 43.1547, lng: 19.1228 },
  Pljevlja: { lat: 43.3567, lng: 19.3586 },
  Rožaje: { lat: 42.8408, lng: 20.1664 },
};

/** Approximate area centres, keyed by city → area. Area strings match `MNE_LOCATIONS`. */
const AREA_COORDS: Record<string, Record<string, LatLng>> = {
  Podgorica: {
    // "Centar / City Kvart" in the mockup maps to the curated "City Kvart" area.
    "City Kvart": { lat: 42.4411, lng: 19.2627 },
    "Preko Morače": { lat: 42.4455, lng: 19.2555 },
    "Blok 5": { lat: 42.4378, lng: 19.247 },
    "Blok 6": { lat: 42.4345, lng: 19.2438 },
    "Blok 9": { lat: 42.4308, lng: 19.2505 },
    "Stari Aerodrom": { lat: 42.4262, lng: 19.2625 },
    Zabjelo: { lat: 42.4185, lng: 19.2585 },
    Momišići: { lat: 42.4305, lng: 19.2705 },
    Konik: { lat: 42.4525, lng: 19.2895 },
    Tološi: { lat: 42.4705, lng: 19.2355 },
  },
  Budva: {
    Bečići: { lat: 42.287, lng: 18.873 },
  },
};

/** Approximate centre for a city, or null if unknown. */
export function cityCoords(city: string): LatLng | null {
  return CITY_COORDS[city] ?? null;
}

/** Approximate centre for an area of a city, or null if no coords are known. */
export function areaCoords(city: string, area: string): LatLng | null {
  return AREA_COORDS[city]?.[area] ?? null;
}
