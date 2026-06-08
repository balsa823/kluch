import { View, Text, StyleSheet } from "react-native";
import { ConsoleLayout } from "../components/ConsoleLayout";
import { colors } from "../theme/tokens";
import { useAuth } from "../lib/auth";

export default function Settings() {
  const { user } = useAuth();
  return (
    <ConsoleLayout>
      <View style={styles.wrap}>
        <Text style={styles.title}>Settings</Text>
        {user ? <Text style={styles.sub}>Signed in as {user.name || user.email}</Text> : null}
        <Text style={styles.soon}>More settings coming soon.</Text>
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
