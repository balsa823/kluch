import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { login as apiLogin, me as apiMe, type User, type Agency } from "./api";
import { getToken, setToken, clearToken } from "./storage";

type AuthState = {
  token: string | null;
  user: User | null;
  agency: Agency | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getToken();
        if (!stored) return;
        try {
          const { user: u, agency: a } = await apiMe(stored);
          if (!active) return;
          setTokenState(stored);
          setUser(u);
          setAgency(a);
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
    const { token: t, user: u } = await apiLogin(email, password);
    await setToken(t);
    setTokenState(t);
    setUser(u);
    try {
      const { agency: a } = await apiMe(t);
      setAgency(a);
    } catch {
      // user is set; agency hydration is best-effort
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
    setAgency(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, agency, loading, login, logout }}
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
