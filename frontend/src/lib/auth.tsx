"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, tokens } from "./api";
import type { Organization, User } from "./types";

interface AuthState {
  user: User | null;
  orgs: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  setCurrentOrg: (org: Organization) => void;
  refreshOrgs: () => Promise<Organization[]>;
  refreshUser: () => Promise<void>;
}

interface RegisterInput extends Record<string, unknown> {
  email: string;
  full_name: string;
  password: string;
  password_confirm: string;
}

const ORG_KEY = "pt_org";
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadOrgs = useCallback(async () => {
    const data = await api.get<{ results: Organization[] }>(
      "/organizations/?page_size=100",
    );
    const list = data.results ?? [];
    setOrgs(list);

    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(ORG_KEY);
    } catch {
      /* ignore */
    }
    const match =
      list.find((o) => String(o.id) === remembered) ?? list[0] ?? null;
    setCurrentOrgState(match);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokens.access && !tokens.refresh) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<User>("/auth/me/");
        if (cancelled) return;
        setUser(me);
        await loadOrgs();
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrgs]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{
        access: string;
        refresh: string;
        user: User;
      }>("/auth/token/", { email, password });
      tokens.set(data.access, data.refresh);
      setUser(data.user);
      await loadOrgs();
    },
    [loadOrgs],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.post("/auth/register/", input);
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    tokens.clear();
    try {
      window.localStorage.removeItem(ORG_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    setOrgs([]);
    setCurrentOrgState(null);
    router.push("/login");
  }, [router]);

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    try {
      window.localStorage.setItem(ORG_KEY, String(org.id));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get<User>("/auth/me/");
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({
      user,
      orgs,
      currentOrg,
      loading,
      login,
      register,
      logout,
      setCurrentOrg,
      refreshOrgs: loadOrgs,
      refreshUser,
    }),
    [
      user,
      orgs,
      currentOrg,
      loading,
      login,
      register,
      logout,
      setCurrentOrg,
      loadOrgs,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
