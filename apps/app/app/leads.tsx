import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { colors, space, radius } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { listLeads, type Lead } from "../lib/api";
import { groupPhoneClicks, type ClickGroup } from "../lib/clicks";

type Tab = "tour" | "inquiry" | "phone_click";

const TABS: { key: Tab; labelKey: string }[] = [
  { key: "tour", labelKey: "leads.tab.tours" },
  { key: "inquiry", labelKey: "leads.tab.inquiries" },
  { key: "phone_click", labelKey: "leads.tab.clicks" },
];

const EMPTY_KEY: Record<Tab, string> = {
  tour: "leads.empty.tours",
  inquiry: "leads.empty.inquiries",
  phone_click: "leads.empty.clicks",
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Date-only (no time) — for the visitor's preferred tour date, which is a plain date string. */
function fmtDate(value: string): string {
  // Parse "YYYY-MM-DD" as a local date (avoid UTC midnight shifting the day).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function LeadRow({ lead }: { lead: Lead }) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {lead.propertyName ?? "—"}
        </Text>
        {lead.kind === "phone_click" ? (
          <Text style={styles.rowMeta}>{t("leads.phoneClick")}</Text>
        ) : (
          <>
            {lead.name || lead.contact ? (
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[lead.name, lead.contact].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {lead.kind === "tour" && lead.tourDate ? (
              <Text style={styles.rowMeta} numberOfLines={1}>
                {t("leads.tourPrefix", { date: fmtDate(lead.tourDate) })}
              </Text>
            ) : null}
            {lead.message ? (
              <Text style={styles.rowMessage} numberOfLines={2}>
                {lead.message}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={styles.rowTimeCol}>
        <Text style={styles.rowTime}>{fmt(lead.createdAt)}</Text>
      </View>
    </View>
  );
}

function ClickGroupRow({ group }: { group: ClickGroup }) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <View style={styles.clickTitleRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {group.propertyName ?? "—"}
          </Text>
          {group.refCode ? (
            <Text style={styles.codeChip}>{group.refCode}</Text>
          ) : null}
        </View>
        <Text style={styles.rowMeta}>
          {t("leads.lastClick", { time: fmt(group.lastCreatedAt) })}
        </Text>
      </View>
      <View style={styles.rowTimeCol}>
        <Text style={styles.clickCount}>
          {t(group.count === 1 ? "leads.clickCountOne" : "leads.clickCount", {
            n: group.count,
          })}
        </Text>
      </View>
    </View>
  );
}

export default function Leads() {
  const { token } = useAuth();
  const { t } = useT();

  const [tab, setTab] = useState<Tab>("inquiry");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listLeads(token, tab);
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("leads.error"));
    } finally {
      setLoading(false);
    }
  }, [token, tab, t]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const clickGroups = tab === "phone_click" ? groupPhoneClicks(leads) : [];

  const subtitle = loading
    ? t("common.loading")
    : tab === "phone_click"
      ? t("leads.clicksSummary", {
          clicks: leads.length,
          listings: clickGroups.length,
        })
      : t(leads.length === 1 ? "leads.countOne" : "leads.count", {
          n: leads.length,
        });

  const tabs = (
    <View style={styles.tabRow}>
      {TABS.map((tabDef) => {
        const active = tab === tabDef.key;
        return (
          <Pressable
            key={tabDef.key}
            accessibilityRole="button"
            onPress={() => setTab(tabDef.key)}
            style={[styles.tabChip, active && styles.tabChipActive]}
          >
            <Text
              style={[styles.tabChipText, active && styles.tabChipTextActive]}
            >
              {t(tabDef.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ConsoleLayout title={t("leads.title")} subtitle={subtitle} tabs={tabs}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.navy} style={styles.spinner} />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refetch()}
              style={({ pressed }) => [
                styles.ghostBtn,
                styles.retryBtn,
                pressed && styles.ghostBtnPressed,
              ]}
            >
              <Text style={styles.ghostBtnText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : leads.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>{t(EMPTY_KEY[tab])}</Text>
          </View>
        ) : tab === "phone_click" ? (
          <View style={styles.table}>
            {clickGroups.map((group, i) => (
              <View
                key={group.key || "—"}
                style={[
                  styles.rowWrap,
                  i < clickGroups.length - 1 && styles.rowDivider,
                ]}
              >
                <ClickGroupRow group={group} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.table}>
            {leads.map((lead, i) => (
              <View
                key={lead.id}
                style={[
                  styles.rowWrap,
                  i < leads.length - 1 && styles.rowDivider,
                ]}
              >
                <LeadRow lead={lead} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ConsoleLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 30,
    paddingTop: 26,
    paddingBottom: 50,
    gap: space.lg,
  },
  tabRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  tabChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    backgroundColor: colors.white,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  tabChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  tabChipText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 13,
  },
  tabChipTextActive: {
    color: colors.white,
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
  ghostBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnPressed: {
    opacity: 0.85,
  },
  ghostBtnText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  retryBtn: {
    alignSelf: "flex-start",
    marginTop: space.sm,
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
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 13,
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
  rowMeta: {
    color: colors.body,
    fontSize: 13,
    marginTop: 2,
  },
  clickTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  codeChip: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
    backgroundColor: colors.sand,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  clickCount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  rowMessage: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  rowTimeCol: {
    minWidth: 130,
    alignItems: "flex-end",
  },
  rowTime: {
    color: colors.muted,
    fontSize: 12,
  },
});
