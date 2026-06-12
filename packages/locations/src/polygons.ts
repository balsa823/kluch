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
  "Podgorica|Stara Varoš": {
    type: "Polygon",
    coordinates: [
      [
        [19.2583967, 42.4400074],
        [19.2621748, 42.4389057],
        [19.2618618, 42.4382713],
        [19.261238, 42.4371235],
        [19.2601283, 42.4351111],
        [19.2595102, 42.4345327],
        [19.2582411, 42.4320792],
        [19.2579002, 42.4321491],
        [19.2567731, 42.4325126],
        [19.2554093, 42.4330089],
        [19.2549073, 42.4332396],
        [19.2544811, 42.4335471],
        [19.2542254, 42.4337848],
        [19.2540171, 42.4340225],
        [19.2536741, 42.4345791],
        [19.2535931, 42.4347399],
        [19.2533667, 42.4357164],
        [19.2542978, 42.4360388],
        [19.2561855, 42.4365324],
        [19.2566595, 42.4367635],
        [19.2574213, 42.4373445],
        [19.2577768, 42.4380004],
        [19.2581567, 42.4390674],
        [19.2582084, 42.4393023],
        [19.2582216, 42.439413],
        [19.2581975, 42.4400659],
        [19.2583967, 42.4400074],
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
