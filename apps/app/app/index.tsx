import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";

// The app's entry routes straight into the console: dashboard if signed in,
// otherwise the login screen. (Marketing lives on the separate landing site.)
export default function Index() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={token ? "/dashboard" : "/login"} />;
}
