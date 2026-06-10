import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";
import { Sidebar } from "./Sidebar";
import { LangSwitcher } from "./LangSwitcher";

type ConsoleLayoutProps = {
  title?: string;
  subtitle?: string;
  tabs?: React.ReactNode;
  children: React.ReactNode;
};

export function ConsoleLayout({
  title,
  subtitle,
  tabs,
  children,
}: ConsoleLayoutProps) {
  return (
    <View style={styles.root}>
      <Sidebar />
      <View style={styles.main}>
        <View style={styles.header}>
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
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
    backgroundColor: colors.page,
  },
  headerLeft: {
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
});
