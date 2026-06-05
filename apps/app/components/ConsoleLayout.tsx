import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";
import { Sidebar } from "./Sidebar";

type ConsoleLayoutProps = {
  children: React.ReactNode;
};

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <View style={styles.root}>
      <Sidebar />
      <View style={styles.main}>{children}</View>
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
});
