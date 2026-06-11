import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { colors } from "../theme/tokens";
import { Sidebar } from "./Sidebar";
import { LangSwitcher } from "./LangSwitcher";

type ConsoleLayoutProps = {
  title?: string;
  subtitle?: string;
  tabs?: React.ReactNode;
  children: React.ReactNode;
};

const PHONE_MAX = 768;

export function ConsoleLayout({
  title,
  subtitle,
  tabs,
  children,
}: ConsoleLayoutProps) {
  const { width } = useWindowDimensions();
  const isPhone = width < PHONE_MAX;
  const [navOpen, setNavOpen] = useState(false);

  return (
    <View style={styles.root}>
      {/* Desktop: persistent sidebar. Phone: it lives in the drawer below. */}
      {!isPhone ? <Sidebar /> : null}

      <View style={styles.main}>
        <View style={styles.header}>
          {isPhone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => setNavOpen(true)}
              style={({ pressed }) => [styles.burger, pressed && styles.burgerPressed]}
            >
              <Text style={styles.burgerIcon}>☰</Text>
            </Pressable>
          ) : null}
          <View style={styles.headerLeft}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {tabs ? <View style={styles.tabs}>{tabs}</View> : null}
          </View>
          <View style={styles.headerRight}>
            <LangSwitcher />
          </View>
        </View>
        {children}
      </View>

      {/* Phone nav drawer */}
      {isPhone && navOpen ? (
        <>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={() => setNavOpen(false)}
          />
          <View style={styles.drawer}>
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.page,
  },
  main: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
    backgroundColor: colors.page,
  },
  burger: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    flexShrink: 0,
  },
  burgerPressed: { opacity: 0.85 },
  burgerIcon: { color: colors.white, fontSize: 20, lineHeight: 22 },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    paddingTop: 2,
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
  tabs: {
    marginTop: 14,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 90,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
    // Sidebar carries its own width (248) + full height; add a drop shadow on web.
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 2, height: 0 },
  },
});
