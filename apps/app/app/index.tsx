import { useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { routeToDashboard } from "../lib/platform";

// The app's entry routes straight into the console: the partner's first
// dashboard if signed in, otherwise the login screen. (Marketing lives on the
// separate landing site.)
export default function Index() {
  const { token, dashboards, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !token) return;
    routeToDashboard(token, dashboards, (p) => router.replace(p));
  }, [loading, token, dashboards, router]);

  if (loading) return null;
  if (token) return null;
  return <Redirect href="/login" />;
}
