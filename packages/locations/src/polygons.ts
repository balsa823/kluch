// Hand-drawn region polygons for the white-label map. Unlike CITY_COORDS /
// AREA_COORDS (single points used for pins), these are real outlines we trace
// ourselves (in geojson.io, from Google's neighbourhood boundaries) so the map
// shades the actual area instead of an abstract circle.
//
// Coordinates are GeoJSON order: [lng, lat]. Rings are closed (first == last).
// Keys: "City" for a whole-city outline, "City|Area" for a sub-city area.
// A city/area with no entry here falls back to the circle drawn from *_COORDS.
//
// These are APPROXIMATE, illustrative outlines — refined collaboratively, not
// surveyed boundaries. We never claim a polygon is an exact legal border.

export type PolyGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export const MNE_POLYGONS: Record<string, PolyGeometry> = {
  "Podgorica|Stari Aerodrom": {
    type: "Polygon",
    coordinates: [
      [
        [19.2725449, 42.4364067],
        [19.2873931, 42.431647],
        [19.2879917, 42.4303809],
        [19.2803079, 42.4200353],
        [19.2776475, 42.4163026],
        [19.2751571, 42.4182849],
        [19.2684576, 42.4238576],
        [19.2659543, 42.4258763],
        [19.2725449, 42.4364067],
      ],
    ],
  },
};

/**
 * Whole-city outline. A city isn't drawn separately — its shape is the union of
 * all its area polygons (assembled into one MultiPolygon, neighbourhoods shown
 * together). An explicit "City" entry, if present, takes precedence. Null when
 * the city has no area polygons yet.
 */
export function cityPolygon(city: string): PolyGeometry | null {
  if (MNE_POLYGONS[city]) return MNE_POLYGONS[city];
  const prefix = `${city}|`;
  const polys: number[][][][] = [];
  for (const key of Object.keys(MNE_POLYGONS)) {
    if (!key.startsWith(prefix)) continue;
    const g = MNE_POLYGONS[key];
    if (g.type === "Polygon") polys.push(g.coordinates as number[][][]);
    else for (const p of g.coordinates as number[][][][]) polys.push(p);
  }
  if (!polys.length) return null;
  return { type: "MultiPolygon", coordinates: polys };
}

/** Hand-drawn sub-city area outline, or null if none is stored yet. */
export function areaPolygon(city: string, area: string): PolyGeometry | null {
  return MNE_POLYGONS[`${city}|${area}`] ?? null;
}
