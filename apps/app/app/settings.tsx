import { View, Text, StyleSheet } from "react-native";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { colors } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";

export default function Settings() {
  const { user } = useAuth();
  const { t } = useT();
  return (
    <ConsoleLayout>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("settings.title")}</Text>
        {user ? (
          <Text style={styles.sub}>
            {t("settings.signedInAs", { who: user.name || user.email })}
          </Text>
        ) : null}
        <Text style={styles.soon}>{t("settings.soon")}</Text>
      </View>
    </ConsoleLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 32, gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 14, color: colors.ink },
  soon: { fontSize: 14, color: colors.muted, marginTop: 8 },
});
