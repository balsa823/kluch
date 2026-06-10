import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Alert,
} from "react-native";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { Pill, TextField } from "../components/ui";
import { colors, space, radius } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import {
  listListings,
  createListing,
  updateListing,
  setListingStatus,
  deleteListing,
  importListing,
  formatMoney,
  mediaUrl,
  LISTING_STATUSES,
  type ListingStatus,
  type Property,
} from "../lib/api";

const TYPES = ["residential", "land", "commercial"] as const;
type ListingType = (typeof TYPES)[number];

const STATUS_LABELS: Record<ListingStatus, string> = {
  published: "Published",
  rented: "Rented",
  sold: "Sold",
  draft: "Draft",
};

function statusPillStyles(status: string): {
  pill: object;
  text: object;
} {
  switch (status.toLowerCase()) {
    case "published":
      return { pill: styles.pillPub, text: styles.pillPubText };
    case "rented":
      return { pill: styles.pillRented, text: styles.pillRentedText };
    case "sold":
      return { pill: styles.pillSold, text: styles.pillSoldText };
    default:
      return { pill: styles.pillDraft, text: styles.pillDraftText };
  }
}

function StatusControl({
  status,
  busy,
  onChoose,
}: {
  status: string;
  busy: boolean;
  onChoose: (s: ListingStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = statusPillStyles(status);
  const label = STATUS_LABELS[status as ListingStatus] ?? status;

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => setOpen(true)}
        style={busy && styles.btnDisabled}
      >
        <Pill label={label} style={cur.pill} textStyle={cur.text} />
      </Pressable>
    );
  }

  return (
    <View style={styles.statusChooser}>
      {LISTING_STATUSES.map((s) => {
        const st = statusPillStyles(s);
        const active = s === status.toLowerCase();
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              if (!active) onChoose(s);
            }}
          >
            <Pill
              label={STATUS_LABELS[s]}
              style={[st.pill, active && styles.statusActive]}
              textStyle={st.text}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function ListingRow({
  p,
  busy,
  onStatus,
  onEdit,
  onDelete,
}: {
  p: Property;
  busy: boolean;
  onStatus: (s: ListingStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const photo = p.photos && p.photos.length > 0 ? mediaUrl(p.photos[0]) : null;
  return (
    <View style={styles.row}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {p.name}
        </Text>
        <Text style={styles.rowCity} numberOfLines={1}>
          {p.city}
        </Text>
      </View>
      <View style={styles.rowPriceCol}>
        <Text style={styles.rowPrice}>
          {formatMoney(p.priceMinor, p.currency)}
          {p.dealType === "rent" ? (
            <Text style={styles.rowPriceUnit}>/mo</Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.rowStatusCol}>
        <StatusControl status={p.status} busy={busy} onChoose={onStatus} />
      </View>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.rowActionBtn,
            pressed && styles.addBtnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          <Text style={styles.rowActionText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.rowActionBtn,
            styles.rowDeleteBtn,
            pressed && styles.addBtnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          <Text style={styles.rowDeleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function EditModal({
  listing,
  token,
  onClose,
  onSaved,
}: {
  listing: Property;
  token: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(listing.name);
  const [address, setAddress] = useState(listing.address);
  const [city, setCity] = useState(listing.city);
  const [price, setPrice] = useState(String(listing.priceMinor / 100));
  const [bedrooms, setBedrooms] = useState(
    listing.bedrooms == null ? "" : String(listing.bedrooms),
  );
  const [bathrooms, setBathrooms] = useState(
    listing.bathrooms == null ? "" : String(listing.bathrooms),
  );
  const [areaM2, setAreaM2] = useState(
    listing.areaM2 == null ? "" : String(listing.areaM2),
  );
  const [type, setType] = useState<ListingType>(
    (TYPES as readonly string[]).includes(listing.type ?? "")
      ? (listing.type as ListingType)
      : "residential",
  );
  const [dealType, setDealType] = useState<"rent" | "sale">(listing.dealType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (saving) return;
    setError(null);
    const euros = Number(price);
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Name, address, and city are required.");
      return;
    }
    if (!Number.isFinite(euros) || euros <= 0) {
      setError("Enter a valid price in euros.");
      return;
    }
    setSaving(true);
    try {
      await updateListing(token, listing.id, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        priceMinor: Math.round(euros * 100),
        bedrooms: numOrUndef(bedrooms),
        bathrooms: numOrUndef(bathrooms),
        areaM2: numOrUndef(areaM2),
        type,
        dealType,
      });
      onClose();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.modalOverlay}>
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalScrollContent}
      >
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Edit listing</Text>
          <TextField label="Name" value={name} onChangeText={setName} />
          <TextField
            label="Address"
            value={address}
            onChangeText={setAddress}
          />
          <TextField label="City" value={city} onChangeText={setCity} />
          <TextField
            label="Price (EUR)"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
          <TextField
            label="Bedrooms"
            value={bedrooms}
            onChangeText={setBedrooms}
            keyboardType="number-pad"
          />
          <TextField
            label="Bathrooms"
            value={bathrooms}
            onChangeText={setBathrooms}
            keyboardType="number-pad"
          />
          <TextField
            label="Area (m²)"
            value={areaM2}
            onChangeText={setAreaM2}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Deal</Text>
          <View style={styles.typeRow}>
            {(["rent", "sale"] as const).map((d) => {
              const active = dealType === d;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  onPress={() => setDealType(d)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      active && styles.typeChipTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => {
              const active = type === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  onPress={() => setType(t)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      active && styles.typeChipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && styles.addBtnPressed,
              ]}
            >
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onSave}
              style={({ pressed }) => [
                styles.addBtn,
                styles.formSubmit,
                pressed && styles.addBtnPressed,
                saving && styles.btnDisabled,
              ]}
            >
              <Text style={styles.addBtnText}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function Agency() {
  const { token } = useAuth();

  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [type, setType] = useState<ListingType>("residential");
  const [dealType, setDealType] = useState<"rent" | "sale">("rent");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Property | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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

  function resetForm() {
    setName("");
    setAddress("");
    setCity("");
    setPrice("");
    setBedrooms("");
    setType("residential");
    setDealType("rent");
    setFormError(null);
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
        dealType,
      });
      resetForm();
      setShowForm(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add listing");
    } finally {
      setSubmitting(false);
    }
  }

  async function onImport() {
    if (!token || importing) return;
    const url = importUrl.trim();
    setImportError(null);
    if (!url) {
      setImportError("Paste a listing URL to import.");
      return;
    }
    setImporting(true);
    try {
      await importListing(token, url);
      setImportUrl("");
      await refetch();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to import listing");
    } finally {
      setImporting(false);
    }
  }

  async function onStatus(p: Property, status: ListingStatus) {
    if (!token || busyId) return;
    setRowError(null);
    setBusyId(p.id);
    try {
      await setListingStatus(token, p.id, status);
      await refetch();
    } catch (e) {
      setRowError(
        e instanceof Error ? e.message : "Failed to update status",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete(p: Property) {
    if (!token) return;
    setRowError(null);
    setBusyId(p.id);
    try {
      await deleteListing(token, p.id);
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete listing";
      setRowError(msg);
      if (Platform.OS !== "web") Alert.alert("Cannot delete", msg);
    } finally {
      setBusyId(null);
    }
  }

  function onDelete(p: Property) {
    if (busyId) return;
    const message = `Delete “${p.name}”? This cannot be undone.`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) {
        void doDelete(p);
      }
    } else {
      Alert.alert("Delete listing", message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void doDelete(p),
        },
      ]);
    }
  }

  const subtitle = loading
    ? "Loading…"
    : `${listings.length} ${listings.length === 1 ? "listing" : "listings"}`;

  return (
    <ConsoleLayout>
      <View style={styles.topbar}>
        <View style={styles.topbarText}>
          <Text style={styles.title}>Listings</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowForm((s) => !s)}
          style={({ pressed }) => [
            styles.addBtn,
            styles.addBtnHeader,
            pressed && styles.addBtnPressed,
          ]}
        >
          <Text style={styles.addBtnText}>
            {showForm ? "Close" : "+ Add listing"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.importCard}>
          <Text style={styles.formTitle}>Import from a listing URL</Text>
          <Text style={styles.importHint}>
            Paste a listing link (e.g. bestate4.me) to import it into your agency.
          </Text>
          <View style={styles.importRow}>
            <View style={styles.importField}>
              <TextField
                label="Listing URL"
                value={importUrl}
                onChangeText={setImportUrl}
                placeholder="https://www.bestate4.me/listing/…"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={importing}
              onPress={onImport}
              style={({ pressed }) => [
                styles.addBtn,
                styles.importBtn,
                pressed && styles.addBtnPressed,
                importing && styles.btnDisabled,
              ]}
            >
              <Text style={styles.addBtnText}>
                {importing ? "Importing…" : "Import"}
              </Text>
            </Pressable>
          </View>
          {importError ? <Text style={styles.error}>{importError}</Text> : null}
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add listing</Text>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Modern flat, Podgorica"
            />
            <TextField
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Bulevar bb"
            />
            <TextField
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Podgorica"
            />
            <TextField
              label="Price (EUR / mo)"
              value={price}
              onChangeText={setPrice}
              placeholder="550"
              keyboardType="numeric"
            />
            <TextField
              label="Bedrooms"
              value={bedrooms}
              onChangeText={setBedrooms}
              placeholder="2"
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Deal</Text>
            <View style={styles.typeRow}>
              {(["rent", "sale"] as const).map((d) => {
                const active = dealType === d;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    onPress={() => setDealType(d)}
                    style={[
                      styles.typeChip,
                      active && styles.typeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        active && styles.typeChipTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => {
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    onPress={() => setType(t)}
                    style={[
                      styles.typeChip,
                      active && styles.typeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        active && styles.typeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {formError ? (
              <Text style={styles.error}>{formError}</Text>
            ) : null}

            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && styles.addBtnPressed,
                ]}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onAdd}
                style={({ pressed }) => [
                  styles.addBtn,
                  styles.formSubmit,
                  pressed && styles.addBtnPressed,
                  submitting && styles.btnDisabled,
                ]}
              >
                <Text style={styles.addBtnText}>
                  {submitting ? "Adding…" : "Add listing"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sechead}>
          <Text style={styles.sectionTitle}>Your listings</Text>
        </View>

        {rowError ? <Text style={styles.error}>{rowError}</Text> : null}

        {loading ? (
          <ActivityIndicator color={colors.navy} style={styles.spinner} />
        ) : loadError ? (
          <View style={styles.card}>
            <Text style={styles.error}>{loadError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refetch()}
              style={({ pressed }) => [
                styles.ghostBtn,
                styles.retryBtn,
                pressed && styles.addBtnPressed,
              ]}
            >
              <Text style={styles.ghostBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              No listings yet. Add your first with “+ Add listing”.
            </Text>
          </View>
        ) : (
          <View style={styles.table}>
            {listings.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.rowWrap,
                  i < listings.length - 1 && styles.rowDivider,
                ]}
              >
                <ListingRow
                  p={p}
                  busy={busyId === p.id}
                  onStatus={(s) => void onStatus(p, s)}
                  onEdit={() => setEditing(p)}
                  onDelete={() => onDelete(p)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {editing && token ? (
        <EditModal
          listing={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={refetch}
        />
      ) : null}
    </ConsoleLayout>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 30,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
    backgroundColor: colors.page,
  },
  topbarText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  addBtn: {
    marginLeft: "auto",
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnPressed: {
    opacity: 0.85,
  },
  websiteBtn: {
    flex: 0,
    marginLeft: "auto",
    paddingVertical: 11,
  },
  addBtnHeader: {
    marginLeft: 0,
  },
  addBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 30,
    paddingTop: 26,
    paddingBottom: 50,
    gap: space.lg,
  },
  formCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    maxWidth: 480,
    width: "100%",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  importCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
    maxWidth: 560,
    width: "100%",
  },
  importHint: {
    color: colors.muted,
    fontSize: 13,
  },
  importRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
  },
  importField: {
    flex: 1,
  },
  importBtn: {
    marginLeft: 0,
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
  typeChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    backgroundColor: colors.white,
    paddingVertical: 10,
    alignItems: "center",
  },
  typeChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  typeChipText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  typeChipTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
  },
  formSubmit: {
    flex: 1,
    marginLeft: 0,
  },
  ghostBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  ghostBtnText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  retryBtn: {
    flex: 0,
    alignSelf: "flex-start",
    marginTop: space.sm,
  },
  sechead: {
    marginTop: space.xs,
    marginBottom: space.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  spinner: {
    marginTop: space.lg,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
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
  table: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  rowWrap: {
    paddingHorizontal: 18,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
  },
  thumb: {
    width: 56,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.cream,
  },
  thumbPlaceholder: {
    backgroundColor: colors.sand,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 15,
  },
  rowCity: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  rowPriceCol: {
    minWidth: 80,
  },
  rowPrice: {
    fontWeight: "800",
    color: colors.navy,
    fontSize: 15,
  },
  rowPriceUnit: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 11,
  },
  rowStatusCol: {
    minWidth: 96,
    alignItems: "flex-end",
  },
  pillPub: {
    backgroundColor: colors.teal100,
  },
  pillPubText: {
    color: colors.teal700,
  },
  pillDraft: {
    backgroundColor: "#EEE8DA",
  },
  pillDraftText: {
    color: colors.muted,
  },
  pillRented: {
    backgroundColor: "#F6E8CF",
  },
  pillRentedText: {
    color: colors.amber,
  },
  pillSold: {
    backgroundColor: colors.navy200,
  },
  pillSoldText: {
    color: colors.navy800,
  },
  statusChooser: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    maxWidth: 200,
  },
  statusActive: {
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  rowActions: {
    flexDirection: "row",
    gap: space.sm,
    marginLeft: space.sm,
  },
  rowActionBtn: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    backgroundColor: colors.white,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  rowActionText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 13,
  },
  rowDeleteBtn: {
    borderColor: "#E6C9C9",
  },
  rowDeleteText: {
    color: "#B4513F",
    fontWeight: "700",
    fontSize: 13,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(22, 36, 58, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  modalScroll: {
    width: "100%",
    maxHeight: "100%",
  },
  modalScrollContent: {
    alignItems: "center",
    paddingVertical: space.lg,
  },
});
