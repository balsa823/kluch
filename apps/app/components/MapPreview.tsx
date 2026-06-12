import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { colors, radius } from "../theme/tokens";
import { listListings, type Agency } from "../lib/api";
import { cityCoords, areaCoords } from "@kluche/locations";

type Props = { token: string; agency: Agency };

const PODGORICA = { lat: 42.4411, lng: 19.2627 };

// Seeded RNG: FNV-1a hash of the seed string → LCG.
function makeRng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { L?: unknown };
    if (w.L) {
      resolve();
      return;
    }
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-leaflet]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("leaflet")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.setAttribute("data-leaflet", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("leaflet"));
    document.head.appendChild(script);
  });
}

export function MapPreview({ token, agency }: Props) {
  const initialized = useRef(false);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (initialized.current) return;
    initialized.current = true;

    let cancelled = false;

    (async () => {
      try {
        await loadLeaflet();
        if (cancelled) return;
        const L = (window as unknown as { L: any }).L;
        const el = document.getElementById("map-preview");
        if (!el || (el as any)._leaflet_id) return;

        // Grayscale the Carto tiles once.
        if (!document.querySelector("style[data-map-preview]")) {
          const style = document.createElement("style");
          style.setAttribute("data-map-preview", "1");
          style.textContent =
            "#map-preview .leaflet-tile{filter:grayscale(1);}";
          document.head.appendChild(style);
        }

        const map = L.map(el, { attributionControl: false });
        mapRef.current = map;

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          { subdomains: "abcd", maxZoom: 19 },
        ).addTo(map);

        let items: Awaited<ReturnType<typeof listListings>> = [];
        try {
          items = await listListings(token);
        } catch {
          items = [];
        }
        if (cancelled) return;

        const points: Array<[number, number]> = [];
        for (const listing of items) {
          const base =
            (listing.area
              ? areaCoords(listing.city, listing.area)
              : null) || cityCoords(listing.city);
          if (!base) continue;

          const rng = makeRng(listing.id);
          const rad = 460 * Math.sqrt(rng());
          const t = rng() * 2 * Math.PI;
          const dLat = (rad * Math.cos(t)) / 111320;
          const dLng =
            (rad * Math.sin(t)) /
            (111320 * Math.cos((base.lat * Math.PI) / 180));
          const lat = base.lat + dLat;
          const lng = base.lng + dLng;
          points.push([lat, lng]);

          L.marker([lat, lng]).addTo(map);
        }

        if (points.length > 0) {
          map.fitBounds(points, { padding: [24, 24], maxZoom: 14 });
        } else {
          map.setView([PODGORICA.lat, PODGORICA.lng], 12);
        }
      } catch {
        // leave placeholder visible; nothing rendered into the container
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, agency.id]);

  if (Platform.OS !== "web" || typeof document === "undefined") {
    return (
      <View style={[styles.container, styles.placeholder]}>
        <Text style={styles.placeholderText}>Map preview</Text>
      </View>
    );
  }

  return <View nativeID="map-preview" style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.sand,
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 13,
  },
});
