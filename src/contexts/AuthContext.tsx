import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const fetchUserData = async (userId: string) => {

    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (roleRes.data) setRole(roleRes.data.role as UserRole["role"]);

  };

  useEffect(() => {

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      }

      setLoading(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {

        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await fetchUserData(currentUser.id);
        } else {
          setProfile(null);
          setRole(null);
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

    const { error } = await supabase.auth.signOut();

    if (error) console.error(error);

    setUser(null);
    setProfile(null);
    setRole(null);

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
