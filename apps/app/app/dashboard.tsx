import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Card, Button, Pill, TextField } from "../components/ui";
import { colors, space } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import {
  listListings,
  createListing,
  formatMoney,
  type Property,
} from "../lib/api";

const TYPES = ["apartment", "studio", "house"] as const;
type ListingType = (typeof TYPES)[number];

export default function Dashboard() {
  const { token, agency, logout } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [type, setType] = useState<ListingType>("apartment");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listListings(token);
      setListings(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  async function onAdd() {
    if (!token || submitting) return;
    setFormError(null);

    const euros = Number(price);
    if (!name.trim() || !address.trim() || !city.trim()) {
      setFormError("Name, address, and city are required.");
      return;
    }
    if (!Number.isFinite(euros) || euros <= 0) {
      setFormError("Enter a valid price in euros.");
      return;
    }
    const beds = bedrooms.trim() === "" ? undefined : Number(bedrooms);
    if (beds !== undefined && (!Number.isInteger(beds) || beds < 0)) {
      setFormError("Bedrooms must be a whole number.");
      return;
    }

    setSubmitting(true);
    try {
      await createListing(token, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        priceMinor: Math.round(euros * 100),
        bedrooms: beds,
        type,
      });
      setName("");
      setAddress("");
      setCity("");
      setPrice("");
      setBedrooms("");
      setType("apartment");
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Pill label="AGENCY CONSOLE" />
            <Text style={styles.agencyName}>
              {agency?.name ?? "Your agency"}
            </Text>
          </View>
          <Button label="Log out" variant="ghost" onPress={onLogout} />
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Add listing</Text>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Seaside apartment" />
          <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Obala bb" />
          <TextField label="City" value={city} onChangeText={setCity} placeholder="Kotor" />
          <TextField
            label="Price (EUR)"
            value={price}
            onChangeText={setPrice}
            placeholder="120000"
            keyboardType="numeric"
          />
          <TextField
            label="Bedrooms"
            value={bedrooms}
            onChangeText={setBedrooms}
            placeholder="2"
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Button
                key={t}
                label={t}
                variant={type === t ? "primary" : "ghost"}
                onPress={() => setType(t)}
                style={styles.typeButton}
              />
            ))}
          </View>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Button
            label={submitting ? "Adding…" : "Add listing"}
            onPress={onAdd}
            disabled={submitting}
          />
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Listings</Text>
          <Text style={styles.count}>
            {loading ? "…" : `${listings.length}`}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.navy} style={styles.spinner} />
        ) : loadError ? (
          <Card>
            <Text style={styles.error}>{loadError}</Text>
            <Button label="Retry" variant="ghost" onPress={() => void refetch()} />
          </Card>
        ) : listings.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No listings yet. Add your first above.</Text>
          </Card>
        ) : (
          listings.map((p) => (
            <Card key={p.id}>
              <View style={styles.listingTop}>
                <Text style={styles.listingName}>{p.name}</Text>
                <Pill label={p.status} />
              </View>
              <Text style={styles.listingCity}>{p.city}</Text>
              <Text style={styles.listingPrice}>
                {formatMoney(p.priceMinor, p.currency)}
              </Text>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  inner: {
    width: "100%",
    maxWidth: 480,
    gap: space.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: {
    gap: space.xs,
    flexShrink: 1,
  },
  agencyName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  fieldLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: "600",
  },
  typeRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  typeButton: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.sm,
  },
  count: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.teal,
  },
  spinner: {
    marginTop: space.lg,
  },
  empty: {
    color: colors.body,
    fontSize: 15,
  },
  error: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "600",
  },
  listingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  listingName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    flexShrink: 1,
  },
  listingCity: {
    fontSize: 14,
    color: colors.body,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
});
