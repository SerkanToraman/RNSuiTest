import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthError,
  AuthRequestConfig,
  DiscoveryDocument,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BASE_URL } from "../lib/constant";

WebBrowser.maybeCompleteAuthSession();

const config: AuthRequestConfig = {
  clientId: "google",
  scopes: ["openid", "profile", "email"],
  redirectUri: makeRedirectUri(),
};

const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${BASE_URL}/api/auth/authorize`,
  tokenEndpoint: `${BASE_URL}/api/auth/token`,
};

// Simple user interface for Google auth
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  photo?: string;
  sub?: string;
  [key: string]: any; // Allow other JWT claims
}

interface AuthState {
  user: GoogleUser | null;
  token: string | null;
  isLoading: boolean;
  error: AuthError | null;
}

interface AuthActions {
  setUser: (user: GoogleUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AuthError | null) => void;
  signOut: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setToken: (token) => set({ token }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      signOut: () => {
        set({
          user: null,
          token: null,
          isLoading: false,
          error: null,
        });
      },

      fetchWithAuth: async (url: string, options?: RequestInit) => {
        const { token } = get();
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            Authorization: `Bearer ${token}`,
          },
        });
        return response;
      },

      reset: () => set(initialState),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
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
export const useSetToken = () => useAuthStore((state) => state.setToken);
export const useSetLoading = () => useAuthStore((state) => state.setLoading);
export const useSetError = () => useAuthStore((state) => state.setError);
export const useSignOut = () => useAuthStore((state) => state.signOut);
export const useFetchWithAuth = () =>
  useAuthStore((state) => state.fetchWithAuth);
export const useReset = () => useAuthStore((state) => state.reset);

// Custom hook that combines useAuthRequest with store methods
export const useGoogleSignIn = () => {
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setError = useAuthStore((state) => state.setError);
  console.log(BASE_URL);

  const [request, response, promptAsync] = useAuthRequest(config, discovery);

  const handleResponse = useCallback(async () => {
    if (response?.type === "success") {
      try {
        setLoading(true);
        const { code } = response.params;

        // Exchange code for JWT token
        const formData = new FormData();
        formData.append("code", code);

        const tokenResponse = await fetch(`${BASE_URL}/api/auth/token`, {
          method: "POST",
          body: formData,
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to exchange code for token");
        }

        const jwtToken = await tokenResponse.json();
        setToken(jwtToken);

        // Decode JWT token and map to GoogleUser
        const decoded = jwtDecode(jwtToken) as any;
        const user: GoogleUser = {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email?.split("@")[0] || "User",
          photo: decoded.picture || null,
          sub: decoded.sub,
          ...decoded, // Include all other JWT claims
        };
        setUser(user);
      } catch (e: any) {
        console.error("Error handling auth response:", e);
        setError(e as AuthError);
      } finally {
        setLoading(false);
      }
    } else if (response?.type === "cancel") {
      // User cancelled - no error needed
    } else if (response?.type === "error") {
      setError(response.error as AuthError);
    }
  }, [response, setLoading, setToken, setUser, setError]);

  // Handle OAuth response
  useEffect(() => {
    handleResponse();
  }, [handleResponse]);

  const signIn = async () => {
    try {
      if (!request) {
        console.log("No request");
        return;
      }
      await promptAsync();
    } catch (e: any) {
      console.error("Sign in error:", e);
      setError(e as AuthError);
    }
  };

  return {
    request,
    response,
    signIn,
    error,
    isLoading,
  };
};
