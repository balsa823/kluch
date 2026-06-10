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
