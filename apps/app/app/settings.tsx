import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
} from "react-native";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { TextField } from "../components/ui";
import { colors, space, radius } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import {
  updateAgencyConfig,
  type SettingsPatch,
  type BusinessHours,
  type CustomClosure,
  type DayHours,
} from "../lib/api";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAYS)[number];

type DayState = { closed: boolean; open: string; close: string };

function dayStateFrom(h: DayHours): DayState {
  if (!h) return { closed: true, open: "09:00", close: "17:00" };
  return { closed: false, open: h.open, close: h.close };
}

export default function Settings() {
  const { token, agency, setAgency } = useAuth();
  const { t } = useT();

  const [heroHeadline, setHeroHeadline] = useState(agency?.heroHeadline ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(agency?.heroImageUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(agency?.faviconUrl ?? "");
  const [mapEnabled, setMapEnabled] = useState(agency?.mapEnabled ?? false);

  const [phone, setPhone] = useState(agency?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(agency?.whatsapp ?? "");
  const [viber, setViber] = useState(agency?.viber ?? "");
  const [email, setEmail] = useState(agency?.email ?? "");
  const [address, setAddress] = useState(agency?.address ?? "");
  const [mapUrl, setMapUrl] = useState(agency?.mapUrl ?? "");

  const [hours, setHours] = useState<Record<DayKey, DayState>>(() => {
    const bh = agency?.businessHours ?? null;
    return DAYS.reduce(
      (acc, d) => {
        acc[d] = dayStateFrom(bh ? bh[d] : null);
        return acc;
      },
      {} as Record<DayKey, DayState>,
    );
  });

  const [observeHolidays, setObserveHolidays] = useState(
    agency?.observeHolidays ?? false,
  );
  const [closures, setClosures] = useState<CustomClosure[]>(
    agency?.customClosures ?? [],
  );
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [facebook, setFacebook] = useState(agency?.socials?.facebook ?? "");
  const [instagram, setInstagram] = useState(agency?.socials?.instagram ?? "");
  const [linkedin, setLinkedin] = useState(agency?.socials?.linkedin ?? "");
  const [youtube, setYoutube] = useState(agency?.socials?.youtube ?? "");
  const [tiktok, setTiktok] = useState(agency?.socials?.tiktok ?? "");

  const [aboutBlurb, setAboutBlurb] = useState(agency?.aboutBlurb ?? "");
  const [footerName, setFooterName] = useState(agency?.footerName ?? "");
  const [notifyEmail, setNotifyEmail] = useState(agency?.notifyEmail ?? "");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!token || !agency) {
    return (
      <ConsoleLayout>
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>{t("settings.loading")}</Text>
        </View>
      </ConsoleLayout>
    );
  }

  const authToken: string = token;
  const agencyId = agency.id;

  function setDay(day: DayKey, patch: Partial<DayState>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function addClosure() {
    const from = newFrom.trim();
    if (from === "") return;
    const closure: CustomClosure = { from };
    if (newTo.trim() !== "") closure.to = newTo.trim();
    if (newLabel.trim() !== "") closure.label = newLabel.trim();
    setClosures((prev) => [...prev, closure]);
    setNewFrom("");
    setNewTo("");
    setNewLabel("");
  }

  function removeClosure(index: number) {
    setClosures((prev) => prev.filter((_, i) => i !== index));
  }

  function nullable(value: string): string | null {
    return value.trim() === "" ? null : value.trim();
  }

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);

    const businessHours = DAYS.reduce((acc, d) => {
      const s = hours[d];
      acc[d] = s.closed
        ? null
        : { open: s.open.trim(), close: s.close.trim() };
      return acc;
    }, {} as BusinessHours);

    const socials: Record<string, string> = {};
    if (facebook.trim()) socials.facebook = facebook.trim();
    if (instagram.trim()) socials.instagram = instagram.trim();
    if (linkedin.trim()) socials.linkedin = linkedin.trim();
    if (youtube.trim()) socials.youtube = youtube.trim();
    if (tiktok.trim()) socials.tiktok = tiktok.trim();

    const patch: SettingsPatch = {
      heroHeadline: nullable(heroHeadline),
      heroImageUrl: nullable(heroImageUrl),
      faviconUrl: nullable(faviconUrl),
      phone: nullable(phone),
      whatsapp: nullable(whatsapp),
      viber: nullable(viber),
      email: nullable(email),
      address: nullable(address),
      mapUrl: nullable(mapUrl),
      businessHours,
      observeHolidays,
      mapEnabled,
      customClosures: closures,
      socials,
      aboutBlurb: nullable(aboutBlurb),
      footerName: nullable(footerName),
      notifyEmail: nullable(notifyEmail),
    };

    try {
      const updated = await updateAgencyConfig(authToken, agencyId, patch);
      setAgency(updated);
      setSaveMsg(t("settings.saved"));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("settings.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConsoleLayout>
      <View style={styles.topbar}>
        <View style={styles.topbarText}>
          <Text style={styles.title}>{t("settings.title")}</Text>
          <Text style={styles.subtitle}>{t("settings.subtitle")}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Homepage */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.homepage")}</Text>
          <TextField
            label={t("settings.heroHeadline")}
            value={heroHeadline}
            onChangeText={setHeroHeadline}
            placeholder={t("settings.heroHeadlinePh")}
          />
          <TextField
            label={t("settings.heroImageUrl")}
            value={heroImageUrl}
            onChangeText={setHeroImageUrl}
            placeholder={t("settings.heroImageUrlPh")}
            autoCapitalize="none"
          />
          <TextField
            label={t("settings.faviconUrl")}
            value={faviconUrl}
            onChangeText={setFaviconUrl}
            placeholder={t("settings.faviconUrlPh")}
            autoCapitalize="none"
          />
          <View style={styles.switchRow}>
            <Switch value={mapEnabled} onValueChange={setMapEnabled} />
            <Text style={styles.switchLabel}>{t("settings.mapEnabled")}</Text>
          </View>
          <Text style={styles.hint}>{t("settings.mapEnabledHelp")}</Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.contact")}</Text>
          <TextField
            label={t("settings.phone")}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("settings.phonePh")}
          />
          <TextField
            label={t("settings.whatsapp")}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder={t("settings.whatsappPh")}
          />
          <TextField
            label={t("settings.viber")}
            value={viber}
            onChangeText={setViber}
            placeholder={t("settings.viberPh")}
          />
          <TextField
            label={t("settings.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("settings.emailPh")}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label={t("settings.address")}
            value={address}
            onChangeText={setAddress}
            placeholder={t("settings.addressPh")}
            multiline
            numberOfLines={2}
            style={styles.multiline}
          />
          <TextField
            label={t("settings.mapUrl")}
            value={mapUrl}
            onChangeText={setMapUrl}
            placeholder={t("settings.mapUrlPh")}
            autoCapitalize="none"
          />
        </View>

        {/* Business hours */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.hours")}</Text>
          {DAYS.map((day) => {
            const s = hours[day];
            return (
              <View key={day} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{t(`settings.day.${day}`)}</Text>
                <View style={styles.dayControls}>
                  <View style={styles.closedToggle}>
                    <Switch
                      value={s.closed}
                      onValueChange={(v) => setDay(day, { closed: v })}
                    />
                    <Text style={styles.closedLabel}>{t("settings.closed")}</Text>
                  </View>
                  {!s.closed ? (
                    <View style={styles.timeRow}>
                      <TextField
                        containerStyle={styles.timeField}
                        label={t("settings.openTime")}
                        value={s.open}
                        onChangeText={(v) => setDay(day, { open: v })}
                        placeholder={t("settings.timePh")}
                        autoCapitalize="none"
                      />
                      <TextField
                        containerStyle={styles.timeField}
                        label={t("settings.closeTime")}
                        value={s.close}
                        onChangeText={(v) => setDay(day, { close: v })}
                        placeholder={t("settings.timePh")}
                        autoCapitalize="none"
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Holidays */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.holidays")}</Text>
          <View style={styles.switchRow}>
            <Switch
              value={observeHolidays}
              onValueChange={setObserveHolidays}
            />
            <Text style={styles.switchLabel}>
              {t("settings.observeHolidays")}
            </Text>
          </View>

          <Text style={styles.subheading}>{t("settings.closures")}</Text>
          {closures.length === 0 ? (
            <Text style={styles.hint}>{t("settings.noClosures")}</Text>
          ) : (
            closures.map((c, i) => (
              <View key={`${c.from}-${i}`} style={styles.closureRow}>
                <Text style={styles.closureText}>
                  {c.from}
                  {c.to ? ` → ${c.to}` : ""}
                  {c.label ? `  ·  ${c.label}` : ""}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => removeClosure(i)}
                  style={({ pressed }) => [
                    styles.removeBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}

          <View style={styles.addClosureRow}>
            <TextField
              containerStyle={styles.closureField}
              label={t("settings.closureFrom")}
              value={newFrom}
              onChangeText={setNewFrom}
              placeholder={t("settings.datePh")}
              autoCapitalize="none"
            />
            <TextField
              containerStyle={styles.closureField}
              label={t("settings.closureTo")}
              value={newTo}
              onChangeText={setNewTo}
              placeholder={t("settings.datePh")}
              autoCapitalize="none"
            />
          </View>
          <TextField
            label={t("settings.closureLabel")}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder={t("settings.closureLabelPh")}
          />
          <Pressable
            accessibilityRole="button"
            onPress={addClosure}
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.ghostBtnText}>{t("settings.addClosure")}</Text>
          </Pressable>
        </View>

        {/* Social */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.social")}</Text>
          <TextField
            label={t("settings.facebook")}
            value={facebook}
            onChangeText={setFacebook}
            placeholder={t("settings.socialPh")}
            autoCapitalize="none"
          />
          <TextField
            label={t("settings.instagram")}
            value={instagram}
            onChangeText={setInstagram}
            placeholder={t("settings.socialPh")}
            autoCapitalize="none"
          />
          <TextField
            label={t("settings.linkedin")}
            value={linkedin}
            onChangeText={setLinkedin}
            placeholder={t("settings.socialPh")}
            autoCapitalize="none"
          />
          <TextField
            label={t("settings.youtube")}
            value={youtube}
            onChangeText={setYoutube}
            placeholder={t("settings.socialPh")}
            autoCapitalize="none"
          />
          <TextField
            label={t("settings.tiktok")}
            value={tiktok}
            onChangeText={setTiktok}
            placeholder={t("settings.socialPh")}
            autoCapitalize="none"
          />
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.about")}</Text>
          <TextField
            label={t("settings.aboutBlurb")}
            value={aboutBlurb}
            onChangeText={setAboutBlurb}
            placeholder={t("settings.aboutBlurbPh")}
            multiline
            numberOfLines={4}
            style={styles.multiline}
          />
          <TextField
            label={t("settings.footerName")}
            value={footerName}
            onChangeText={setFooterName}
            placeholder={t("settings.footerNamePh")}
          />
        </View>

        {/* Leads */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.sec.leads")}</Text>
          <TextField
            label={t("settings.notifyEmail")}
            value={notifyEmail}
            onChangeText={setNotifyEmail}
            placeholder={t("settings.notifyEmailPh")}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

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
            <Text style={styles.saveBtnText}>
              {saving ? t("settings.saving") : t("common.save")}
            </Text>
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
  subheading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.body,
    marginTop: space.xs,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
  },
  dayLabel: {
    width: 96,
    paddingTop: 8,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  dayControls: {
    flex: 1,
    gap: space.sm,
  },
  closedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  closedLabel: {
    color: colors.body,
    fontSize: 14,
  },
  timeRow: {
    flexDirection: "row",
    gap: space.md,
  },
  timeField: {
    flex: 1,
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
  closureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  closureText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  removeBtnText: {
    color: colors.amber,
    fontWeight: "800",
    fontSize: 14,
  },
  addClosureRow: {
    flexDirection: "row",
    gap: space.md,
  },
  closureField: {
    flex: 1,
  },
  ghostBtn: {
    alignSelf: "flex-start",
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
