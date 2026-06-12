import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Linking,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { MapPreview } from "../components/MapPreview";
import { TextField } from "../components/ui";
import { colors, space, radius } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import {
  updateAgencyConfig,
  uploadAgencyLogo,
  agencySiteUrl,
  mediaUrl,
} from "../lib/api";

const PRESETS = [
  { name: "Adriatic", primary: "#1F3A5C", accent: "#4E827A" },
  { name: "Gold & Black", primary: "#101010", accent: "#C9883C" },
  { name: "Sea", primary: "#0B5394", accent: "#76A5AF" },
  { name: "Olive", primary: "#3D4A2A", accent: "#8A9A5B" },
  { name: "Terracotta", primary: "#7A3B2E", accent: "#C9883C" },
  { name: "Mono", primary: "#222222", accent: "#666666" },
] as const;

export default function Website() {
  const { token, agency, setAgency } = useAuth();
  const { t } = useT();
  const router = useRouter();

  const [primary, setPrimary] = useState(agency?.colorPrimary ?? "#1F3A5C");
  const [accent, setAccent] = useState(agency?.colorAccent ?? "#4E827A");
  const [tagline, setTagline] = useState(agency?.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(agency?.logoUrl ?? null);
  const [mapEnabled, setMapEnabled] = useState(agency?.mapEnabled ?? false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  if (!token || !agency) {
    return (
      <ConsoleLayout>
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>{t("website.loading")}</Text>
        </View>
      </ConsoleLayout>
    );
  }

  const authToken: string = token;
  const agencyId = agency.id;
  const name = agency.name;
  const slug = agency.slug;

  function pickLogo() {
    if (Platform.OS !== "web") return;
    setLogoError(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      setLogoError(null);
      try {
        const { logoUrl: url } = await uploadAgencyLogo(authToken, agencyId, file);
        setLogoUrl(url);
        if (agency) setAgency({ ...agency, logoUrl: url });
      } catch (e) {
        setLogoError(e instanceof Error ? e.message : t("website.errorUploadLogo"));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const updated = await updateAgencyConfig(authToken, agencyId, {
        colorPrimary: primary,
        colorAccent: accent,
        tagline: tagline.trim() === "" ? null : tagline.trim(),
        mapEnabled,
      });
      setAgency(updated);
      setSaveMsg(t("website.saved"));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("website.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConsoleLayout>
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/agency")}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backBtnText}>{t("website.back")}</Text>
        </Pressable>
        <View style={styles.topbarText}>
          <Text style={styles.title}>{t("website.title")}</Text>
          <Text style={styles.subtitle}>{t("website.subtitle")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(agencySiteUrl(slug))}
          style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]}
        >
          <Text style={styles.viewBtnText}>{t("website.viewSite")}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("website.preview")}</Text>
          <View
            style={[
              styles.preview,
              { backgroundColor: primary, borderBottomColor: accent },
            ]}
          >
            {logoUrl ? (
              <Image
                source={{ uri: mediaUrl(logoUrl) }}
                style={styles.previewLogo}
                resizeMode="contain"
              />
            ) : null}
            <View style={styles.previewText}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name}
              </Text>
              {tagline.trim() !== "" ? (
                <Text style={styles.previewTagline} numberOfLines={2}>
                  {tagline}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("website.palette")}</Text>
          <View style={styles.swatchRow}>
            {PRESETS.map((p) => {
              const active = p.primary === primary && p.accent === accent;
              return (
                <Pressable
                  key={p.name}
                  accessibilityRole="button"
                  onPress={() => {
                    setPrimary(p.primary);
                    setAccent(p.accent);
                  }}
                  style={({ pressed }) => [
                    styles.swatch,
                    active && styles.swatchActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.swatchColors}>
                    <View
                      style={[styles.swatchHalf, { backgroundColor: p.primary }]}
                    />
                    <View
                      style={[styles.swatchHalf, { backgroundColor: p.accent }]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.swatchLabel,
                      active && styles.swatchLabelActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("website.tagline")}</Text>
          <TextField
            label={t("website.tagline")}
            value={tagline}
            onChangeText={setTagline}
            placeholder={t("website.taglinePlaceholder")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("website.mapView")}</Text>
          <View style={styles.switchRow}>
            <Switch value={mapEnabled} onValueChange={setMapEnabled} />
            <Text style={styles.switchLabel}>{t("website.mapView")}</Text>
          </View>
          <Text style={styles.caption}>{t("website.mapViewHelp")}</Text>
          <View style={!mapEnabled ? styles.mapDimmed : undefined}>
            <MapPreview token={authToken} agency={agency} />
          </View>
        </View>

        {Platform.OS === "web" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("website.logo")}</Text>
            <View style={styles.logoRow}>
              {logoUrl ? (
                <Image
                  source={{ uri: mediaUrl(logoUrl) }}
                  style={styles.logoThumb}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.logoThumb, styles.logoThumbEmpty]}>
                  <Text style={styles.logoThumbText}>{t("website.noLogo")}</Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                onPress={pickLogo}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && styles.pressed,
                  uploading && styles.disabled,
                ]}
              >
                <Text style={styles.ghostBtnText}>
                  {uploading ? t("website.uploading") : t("website.uploadLogo")}
                </Text>
              </Pressable>
            </View>
            {logoError ? <Text style={styles.error}>{logoError}</Text> : null}
          </View>
        ) : null}

        <View style={styles.saveRow}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <Text style={styles.saveBtnText}>{saving ? t("website.saving") : t("common.save")}</Text>
          </Pressable>
          {saveMsg ? <Text style={styles.savedMsg}>{saveMsg}</Text> : null}
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        </View>
      </ScrollView>
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
  backBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  backBtnText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  viewBtn: {
    marginLeft: "auto",
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  viewBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
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
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    maxWidth: 560,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  switchLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
  },
  caption: {
    color: colors.muted,
    fontSize: 14,
  },
  mapDimmed: {
    opacity: 0.5,
  },
  preview: {
    borderRadius: radius.md,
    borderBottomWidth: 3,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  previewLogo: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  previewText: {
    flexShrink: 1,
  },
  previewName: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 20,
  },
  previewTagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginTop: 4,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  swatch: {
    width: 96,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.sand,
    backgroundColor: colors.white,
    padding: 6,
    gap: 6,
    alignItems: "center",
  },
  swatchActive: {
    borderColor: colors.navy,
  },
  swatchColors: {
    flexDirection: "row",
    width: "100%",
    height: 34,
    borderRadius: 8,
    overflow: "hidden",
  },
  swatchHalf: {
    flex: 1,
  },
  swatchLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: "600",
  },
  swatchLabelActive: {
    color: colors.navy,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  logoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  logoThumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.sand,
  },
  logoThumbText: {
    color: colors.muted,
    fontSize: 12,
  },
  ghostBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  ghostBtnText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    maxWidth: 560,
    width: "100%",
  },
  saveBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  savedMsg: {
    color: colors.teal700,
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  empty: {
    color: colors.body,
    fontSize: 15,
  },
});
