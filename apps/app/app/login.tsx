import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Pill, TextField } from "../components/ui";
import { LangSwitcher } from "../components/LangSwitcher";
import { colors, space } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { routeToDashboard } from "../lib/platform";

export default function Login() {
  const { login, token, dashboards } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Once a successful submit lands a token + dashboards in the auth context,
  // route the partner to their first dashboard (cross-subdomain on *.kluche.me,
  // in-app navigation otherwise).
  useEffect(() => {
    if (!submitted || !token) return;
    routeToDashboard(token, dashboards, (p) => router.replace(p));
  }, [submitted, token, dashboards, router]);

  async function onSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.topRow}>
          <Pill label={t("login.badge")} />
          <LangSwitcher />
        </View>
        <Text style={styles.wordmark}>Kluch</Text>
        <Text style={styles.title}>{t("login.title")}</Text>
        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

        <View style={styles.form}>
          <TextField
            label={t("login.email")}
            value={email}
            onChangeText={setEmail}
            placeholder="you@agency.me"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextField
            label={t("login.password")}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={submitting ? t("login.submitting") : t("login.submit")}
          onPress={onSubmit}
          disabled={submitting}
        />
        <Button
          label={t("login.telegram")}
          variant="ghost"
          disabled
        />
        <Text style={styles.note}>{t("login.telegramNote")}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  wordmark: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 15,
    color: colors.body,
    marginTop: -space.xs,
  },
  form: {
    marginTop: space.sm,
    gap: space.md,
  },
  error: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "600",
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
