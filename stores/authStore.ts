import AsyncStorage from "@react-native-async-storage/async-storage";
// import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
// import { supabase } from "../lib/supabase";

// Simple user interface for Google auth
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  photo?: string;
  randomness?: string;
  ephemeralPublicKey?: string;
  ephemeralKeypair?: string;
  maxEpoch?: number;
  idToken?: string;
  address?: string;
  addresses?: {
    address: string;
    salt: string;
    publicKey: string;
    clientId: string;
    legacy: boolean;
  }[];
}

interface AuthState {
  user: GoogleUser | null;
  // session: Session | null;
  isLoading: boolean;
}

interface AuthActions {
  setUser: (user: GoogleUser | null) => void;
  // setSession: (session: Session | null) => void;
  // setAuthState: (user: User | null, session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  loginUser: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => Promise<{ success: boolean; error?: string }>;
  // fetchSession: () => Promise<{ success: boolean; error?: string }>;
  // initializeAuthListener: () => void;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  // session: null,
  isLoading: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      // setSession: (session) => set({ session }),

      // setAuthState: (user, session) => set({ user, session }),

      setLoading: (isLoading) => set({ isLoading }),

      loginUser: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          // Mock login for Google users - in real implementation, this would handle ZKLogin
          const mockUser: GoogleUser = {
            id: "google_user_" + Date.now(),
            email: email,
            name: email.split("@")[0], // Use email prefix as name
            photo: undefined,
          };

          set({
            user: mockUser,
            isLoading: false,
          });

          return { success: true };
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message };
        }
      },

      logoutUser: async () => {
        set({ isLoading: true });
        try {
          set({
            user: null,
            isLoading: false,
          });

          return { success: true };
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message };
        }
      },

      // fetchSession: async () => {
      //   set({ isLoading: true });
      //   try {
      //     const { data, error } = await supabase.auth.getSession();

      //     if (error) {
      //       set({ isLoading: false });
      //       return { success: false, error: error.message };
      //     }

      //     set({
      //       user: data.session?.user ?? null,
      //       session: data.session,
      //       isLoading: false,
      //     });

      //     return { success: true };
      //   } catch (error: any) {
      //     set({ isLoading: false });
      //     return { success: false, error: error.message };
      //   }
      // },

      // initializeAuthListener: () => {
      //   // Initial session fetch
      //   supabase.auth.getSession().then(({ data: { session } }) => {
      //     set({ user: session?.user ?? null, session });
      //   });

      //   // Set up auth state change listener
      //   supabase.auth.onAuthStateChange((_event, session) => {
      //     set({ user: session?.user ?? null, session });
      //   });
      // },

      reset: () => set(initialState),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        // session: state.session,
      }),
    }
  )
);

// Selectors for better performance
export const useAuthUser = () => useAuthStore((state) => state.user);
// export const useAuthSession = () => useAuthStore((state) => state.session);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);

// Individual action selectors to prevent re-render issues
export const useSetUser = () => useAuthStore((state) => state.setUser);
// export const useSetSession = () => useAuthStore((state) => state.setSession);
// export const useSetAuthState = () =>
//   useAuthStore((state) => state.setAuthState);
export const useSetLoading = () => useAuthStore((state) => state.setLoading);
export const useLoginUser = () => useAuthStore((state) => state.loginUser);
export const useLogoutUser = () => useAuthStore((state) => state.logoutUser);
// export const useFetchSession = () =>
//   useAuthStore((state) => state.fetchSession);
// export const useInitializeAuthListener = () =>
//   useAuthStore((state) => state.initializeAuthListener);
export const useReset = () => useAuthStore((state) => state.reset);
