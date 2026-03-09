import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  clinic_id: string;
}

interface UserRole {
  role: 'superadmin' | 'admin' | 'doctor' | 'reception';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole['role'] | null;
  clinicId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole['role'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchUserData = async (userId: string) => {
    // Use maybeSingle() — unlike single(), it does NOT error on 0 rows
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileRes.error) console.error('[Auth] Profile fetch error:', profileRes.error);
    if (roleRes.error) console.error('[Auth] Role fetch error:', roleRes.error);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (roleRes.data) setRole(roleRes.data.role as UserRole['role']);

    setProfileLoaded(true);
  };

  useEffect(() => {
    // Hard fallback: never stay loading more than 10 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
      setProfileLoaded(true);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        try { await fetchUserData(currentUser.id); } catch (e) {
          console.error('[Auth] fetchUserData threw:', e);
          setProfileLoaded(true);
        }
      } else {
        setProfile(null);
        setRole(null);
        setProfileLoaded(true);
      }
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchUserData(currentUser.id)
            .catch(e => { console.error('[Auth] fetchUserData threw:', e); setProfileLoaded(true); })
            .finally(() => setLoading(false));
        } else {
          setProfileLoaded(true);
          setLoading(false);
        }
      })
      .catch(e => {
        console.error('[Auth] getSession error:', e);
        setProfileLoaded(true);
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setProfileLoaded(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] signOut error:', e);
    }
    setUser(null);
    setProfile(null);
    setRole(null);
    setProfileLoaded(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, clinicId: profile?.clinic_id ?? null, loading: loading || (!!user && !profileLoaded), signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
