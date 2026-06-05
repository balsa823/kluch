import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, space, radius } from "../theme/tokens";
import { useAuth } from "../lib/auth";

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
  const { agency, logout } = useAuth();
  const router = useRouter();

  const agencyName = agency?.name ?? "Your agency";
  const agencyCity = "Podgorica";
  const initial = agencyName.charAt(0).toUpperCase() || "K";

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
          <Text style={styles.brandName}>Kluch</Text>
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
        <NavItem label="Listings" icon="🏠" active />
      </View>

      <View style={styles.foot}>
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.logoutHover]}
        >
          <Text style={styles.logoutText}>⎋ Log out</Text>
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
    marginTop: "auto",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
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
