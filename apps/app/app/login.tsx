import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Pill, TextField } from "../components/ui";
import { colors, space } from "../theme/tokens";
import { useAuth } from "../lib/auth";
import { routeToDashboard } from "../lib/platform";

export default function Login() {
  const { login, token, dashboards } = useAuth();
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
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Pill label="MONTENEGRO" />
        <Text style={styles.wordmark}>Kluch</Text>
        <Text style={styles.title}>Welcome to Kluch</Text>
        <Text style={styles.subtitle}>Your keys to Montenegro</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@agency.me"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
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
          label={submitting ? "Logging in…" : "Log in"}
          onPress={onSubmit}
          disabled={submitting}
        />
        <Button
          label="Continue with Telegram"
          variant="ghost"
          disabled
        />
        <Text style={styles.note}>Telegram login coming soon.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
