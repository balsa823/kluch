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
import { listLeads, type Lead } from "../lib/api";
import { groupPhoneClicks, type ClickGroup } from "../lib/clicks";

type Tab = "tour" | "inquiry" | "phone_click";

const TABS: { key: Tab; label: string }[] = [
  { key: "tour", label: "Tours" },
  { key: "inquiry", label: "Inquiries" },
  { key: "phone_click", label: "Clicks" },
];

const EMPTY: Record<Tab, string> = {
  tour: "No tours yet",
  inquiry: "No inquiries yet",
  phone_click: "No phone clicks yet",
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
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {lead.propertyName ?? "—"}
        </Text>
        {lead.kind === "phone_click" ? (
          <Text style={styles.rowMeta}>Phone click</Text>
        ) : (
          <>
            {lead.name || lead.contact ? (
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[lead.name, lead.contact].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {lead.kind === "tour" && lead.tourDate ? (
              <Text style={styles.rowMeta} numberOfLines={1}>
                Tour: {fmtDate(lead.tourDate)}
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
        <Text style={styles.rowMeta}>last {fmt(group.lastCreatedAt)}</Text>
      </View>
      <View style={styles.rowTimeCol}>
        <Text style={styles.clickCount}>
          {group.count} {group.count === 1 ? "click" : "clicks"}
        </Text>
      </View>
    </View>
  );
}

export default function Leads() {
  const { token } = useAuth();

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
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const clickGroups = tab === "phone_click" ? groupPhoneClicks(leads) : [];

  const subtitle = loading
    ? "Loading…"
    : tab === "phone_click"
      ? `${leads.length} ${leads.length === 1 ? "click" : "clicks"} across ${clickGroups.length} ${clickGroups.length === 1 ? "listing" : "listings"}`
      : `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`;

  return (
    <ConsoleLayout>
      <View style={styles.topbar}>
        <View style={styles.topbarText}>
          <Text style={styles.title}>Leads</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                onPress={() => setTab(t.key)}
                style={[styles.tabChip, active && styles.tabChipActive]}
              >
                <Text
                  style={[styles.tabChipText, active && styles.tabChipTextActive]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
              <Text style={styles.ghostBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : leads.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>{EMPTY[tab]}</Text>
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
