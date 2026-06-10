import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius } from "../theme/tokens";
import { LANGS } from "../lib/i18n/dict";
import { useT } from "../lib/i18n";

export function LangSwitcher() {
  const { lang, setLang } = useT();

  return (
    <View style={styles.row}>
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="button"
            onPress={() => setLang(l.code)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.sand,
    backgroundColor: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  pillText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 12,
  },
  pillTextActive: {
    color: colors.white,
  },
});
