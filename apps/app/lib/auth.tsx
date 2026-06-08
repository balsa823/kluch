import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  platformLogin,
  platformMe,
  type PartnerUser,
  type Agency,
} from "./api";
import { getToken, setToken, clearToken } from "./storage";

type AuthState = {
  token: string | null;
  user: PartnerUser | null;
  agency: Agency | null;
  dashboards: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [dashboards, setDashboards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (
          typeof window !== "undefined" &&
          window.location.hash.includes("token=")
        ) {
          const m = window.location.hash.match(/token=([^&]+)/);
          if (m) {
            await setToken(decodeURIComponent(m[1]));
            history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }
        }

        const stored = await getToken();
        if (!stored) return;
        try {
          const { user: u, agency: a, dashboards: d } = await platformMe(stored);
          if (!active) return;
          setTokenState(stored);
          setUser(u);
          setAgency(a);
          setDashboards(d);
        } catch {
          await clearToken();
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u, dashboards: d } = await platformLogin(
      email,
      password,
    );
    await setToken(t);
    setTokenState(t);
    setUser(u);
    setDashboards(d);
    try {
      const { agency: a } = await platformMe(t);
      setAgency(a);
    } catch {
      // user/dashboards are set; agency hydration is best-effort
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
    setAgency(null);
    setDashboards([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, agency, dashboards, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
