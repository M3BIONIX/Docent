import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { getMe, type Me } from "@/lib/api";

interface AuthState {
  loading: boolean;
  me: Me | null;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  loading: true,
  me: null,
  error: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ loading: false, me: null });
      return;
    }
    try {
      set({ me: await getMe(), loading: false });
    } catch {
      // session exists but profile fetch failed (e.g. token expired) — sign out
      await supabase.auth.signOut();
      set({ loading: false, me: null });
    }
    // keep profile in sync with auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        set({ me: null });
        return;
      }
      try {
        set({ me: await getMe() });
      } catch {
        set({ me: null });
      }
    });
  },

  login: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return;
    }
    try {
      set({ me: await getMe() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Could not load profile" });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ me: null });
  },

  clearError: () => set({ error: null }),
}));
