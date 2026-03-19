import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setLogContext } from "@/lib/logService";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  clinic_id: string;
}

interface UserRole {
  role: "superadmin" | "admin" | "doctor" | "reception";
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole["role"] | null;
  clinicId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole["role"] | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = () => {
    setUser(null);
    setProfile(null);
    setRole(null);
    setLogContext(null, null);
  };

  const fetchUserData = async (userId: string) => {
    const ROLE_PRIORITY: Record<string, number> = {
      superadmin: 4,
      admin: 3,
      admin_doctor: 3,
      doctor: 2,
      reception: 1,
    };

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (profileRes.error) console.error("[Auth] profile fetch error:", profileRes.error);
      if (roleRes.error) console.error("[Auth] role fetch error:", roleRes.error);

      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
        setLogContext((profileRes.data as Profile).clinic_id, userId);
      }

      if (roleRes.data && roleRes.data.length > 0) {
        const topRole = roleRes.data.reduce((best, current) => {
          return (ROLE_PRIORITY[current.role] ?? 0) > (ROLE_PRIORITY[best.role] ?? 0)
            ? current
            : best;
        });
        setRole(topRole.role as UserRole["role"]);
      }
    } catch (err) {
      console.error("[Auth] fetchUserData failed:", err);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[Auth] getSession error:", error);
          clearAuth();
          setLoading(false);
          return;
        }

        if (session?.user) {
          // Validate the session is still valid with a 10-second timeout.
          // getSession() only reads localStorage; getUser() verifies with the server.
          const verifyPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("auth_timeout")), 10_000)
          );

          let validatedUser = null;
          let userError: any = null;

          try {
            const result = await Promise.race([verifyPromise, timeoutPromise]);
            validatedUser = result.data.user;
            userError = result.error;
          } catch (err: any) {
            userError = err;
          }

          // Only wipe localStorage for definitive auth failures, not network/timeout errors.
          const isDefiniteAuthFailure =
            userError &&
            userError.message !== "auth_timeout" &&
            /jwt|invalid.?token|token.?expired|unauthorized|not authenticated|session.?expired/i.test(
              userError.message || ""
            );

          if (isDefiniteAuthFailure) {
            console.warn("[Auth] Session token is invalid, clearing:", userError?.message);
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith("sb-")) localStorage.removeItem(k);
            });
            clearAuth();
            setLoading(false);
            return;
          }

          if (userError) {
            // Network error or timeout — don't wipe session, just proceed with cached user
            console.warn("[Auth] Could not verify session (network/timeout), using cached session:", userError.message);
          }

          // Use validatedUser if available, otherwise fall back to the cached session user
          const resolvedUser = validatedUser ?? session.user;
          setUser(resolvedUser);
          await fetchUserData(resolvedUser.id);
        }
      } catch (err) {
        console.error("[Auth] initSession failed:", err);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" && !session) {
          console.warn("[Auth] Token refresh failed, signing out");
          clearAuth();
          setLoading(false);
          return;
        }

        if (event === "SIGNED_OUT") {
          clearAuth();
          setLoading(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchUserData(currentUser.id);
        } else {
          clearAuth();
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        clinicId: profile?.clinic_id ?? null,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
