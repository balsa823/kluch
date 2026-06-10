import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";

type NavItemProps = {
  label: string;
  icon: string;
  active?: boolean;
  onPress?: () => void;
};

function NavItem({ label, icon, active = false, onPress }: NavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        active && styles.navItemActive,
        pressed && !active && styles.navItemHover,
      ]}
    >
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Sidebar() {
  const { user, agency, logout } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();

  const agencyName = agency?.name ?? t("nav.yourAgency");
  const agencyCity = "Podgorica";
  const initial = agencyName.charAt(0).toUpperCase() || "K";
  const userName = user?.name || user?.email || t("nav.account");
  const userInitial = userName.charAt(0).toUpperCase();

  const isAgency = pathname?.startsWith("/agency") ?? false;
  const isLeads = pathname?.startsWith("/leads") ?? false;
  const isWebsite = pathname?.startsWith("/website") ?? false;

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>K</Text>
        </View>
        <View>
          <Text style={styles.brandName}>Kluche</Text>
          <Text style={styles.brandTag}>for Agencies</Text>
        </View>
      </View>

      <View style={styles.agencyBox}>
        <View style={styles.agencyPic}>
          <Text style={styles.agencyPicText}>{initial}</Text>
        </View>
        <View style={styles.agencyInfo}>
          <Text style={styles.agencyName} numberOfLines={1}>
            {agencyName}
          </Text>
          <Text style={styles.agencyCity}>{agencyCity}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <NavItem
          label={t("nav.listings")}
          icon="🏠"
          active={isAgency}
          onPress={() => router.push("/agency")}
        />
        <NavItem
          label={t("nav.leads")}
          icon="📥"
          active={isLeads}
          onPress={() => router.push("/leads")}
        />
      </View>

      {/* push the Website tab + footer to the bottom of the sidebar */}
      <View style={styles.spacer} />

      <View style={styles.menu}>
        <NavItem
          label={t("nav.website")}
          icon="🌐"
          active={isWebsite}
          onPress={() => router.push("/website")}
        />
      </View>

      <View style={styles.foot}>
        <View style={styles.userRow}>
          <View style={styles.userPic}>
            <Text style={styles.userPicText}>{userInitial}</Text>
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("nav.settings")}
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.cog, pressed && styles.cogHover]}
          >
            <Text style={styles.cogIcon}>⚙</Text>
            <Text style={styles.cogText}>{t("nav.settings")}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.logoutHover]}
        >
          <Text style={styles.logoutText}>⎋ {t("nav.logout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: colors.navy,
    flexDirection: "column",
    height: "100%",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  brandIconText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 18,
  },
  brandName: {
    fontWeight: "800",
    color: colors.white,
    fontSize: 18,
    lineHeight: 18,
  },
  brandTag: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.navy200,
    marginTop: 3,
  },
  agencyBox: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  agencyPic: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  agencyPicText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  agencyInfo: {
    flexShrink: 1,
  },
  agencyName: {
    fontWeight: "700",
    color: colors.white,
    fontSize: 14,
  },
  agencyCity: {
    color: colors.navy200,
    fontSize: 12,
  },
  menu: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 3,
  },
  spacer: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  navItemHover: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  navIcon: {
    width: 20,
    textAlign: "center",
    fontSize: 14,
  },
  navLabel: {
    color: "#B9C7DA",
    fontWeight: "600",
    fontSize: 14,
  },
  navLabelActive: {
    color: colors.white,
  },
  foot: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userPic: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  userPicText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  userName: {
    flex: 1,
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
  cog: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  cogHover: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cogIcon: {
    color: colors.navy200,
    fontSize: 14,
  },
  cogText: {
    color: colors.navy200,
    fontSize: 12,
    fontWeight: "600",
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  logoutHover: {
    opacity: 0.8,
  },
  logoutText: {
    color: colors.navy200,
    fontSize: 14,
  },
});
