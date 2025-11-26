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
import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BASE_URL } from "../lib/constant";
import { getNonce, getZkLoginAddresses, makeEphemeral } from "../lib/enoki";

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
  ephemeralPublicKey?: string;
  randomness?: string;
  maxEpoch?: number;
  address?: string;
  salt?: string;
  publicKey?: string;
  kp?: any; // Add this
}

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null; // For your API calls
  idToken: string | null; // For Enoki/Google services
  isLoading: boolean;
  error: AuthError | null;
}

interface AuthActions {
  setUser: (user: GoogleUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setIdToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AuthError | null) => void;
  signOut: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  accessToken: null,
  idToken: null,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      setIdToken: (token) => set({ idToken: token }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      signOut: () => {
        set({
          user: null,
          accessToken: null,
          idToken: null,
          isLoading: false,
          error: null,
        });
      },

      fetchWithAuth: async (url: string, options?: RequestInit) => {
        const { accessToken } = get();
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            Authorization: `Bearer ${accessToken}`,
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
        accessToken: state.accessToken,
        idToken: state.idToken,
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
export const useSetAccessToken = () =>
  useAuthStore((state) => state.setAccessToken);
export const useSetIdToken = () => useAuthStore((state) => state.setIdToken);
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
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setIdToken = useAuthStore((state) => state.setIdToken);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setError = useAuthStore((state) => state.setError);

  // Ref to store ephemeral data for use in handleResponse
  const ephemeralDataRef = useRef<{
    ephemeralPublicKey: string;
    randomness: string;
    maxEpoch: number;
    kp?: any; // Add this
  } | null>(null);

  // State for config with nonce
  const [authConfig, setAuthConfig] = useState<AuthRequestConfig>(config);

  // Generate nonce and update config
  useEffect(() => {
    const generateNonceAndUpdateConfig = async () => {
      const { kp, publicKey } = makeEphemeral();

      const nonceResponse = await getNonce("testnet", publicKey);
      const nonce = nonceResponse.data.nonce;

      // Store ephemeral data for use in handleResponse
      ephemeralDataRef.current = {
        ephemeralPublicKey: publicKey,
        randomness: nonceResponse.data.randomness,
        maxEpoch: nonceResponse.data.maxEpoch,
        kp: kp,
      };

      // Update config with nonce in extraParams
      const updatedConfig: AuthRequestConfig = {
        ...config,
        extraParams: {
          nonce: nonce,
        },
      };

      setAuthConfig(updatedConfig);
    };

    generateNonceAndUpdateConfig();
  }, []);

  const [request, response, promptAsync] = useAuthRequest(
    authConfig,
    discovery
  );

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
          credentials: "same-origin",
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to exchange code for token");
        }

        const tokenData = await tokenResponse.json();

        const accessToken = tokenData.accessToken || tokenData;
        const idToken = tokenData.idToken;

        if (typeof accessToken !== "string") {
          throw new Error("Invalid token format: expected string");
        }

        // Store both tokens separately
        setAccessToken(accessToken);
        if (idToken) {
          setIdToken(idToken);
        }

        // Decode JWT token and map to GoogleUser
        // Use idToken if available (has full Google user info), otherwise fallback to accessToken
        const tokenToDecode = idToken || accessToken;
        const decoded = jwtDecode(tokenToDecode) as any;

        let user: GoogleUser = {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email?.split("@")[0] || "User",
          photo: decoded.picture || null,
          sub: decoded.sub,
        };

        // Add ephemeral data from nonceResponse if available
        if (ephemeralDataRef.current) {
          user.ephemeralPublicKey = ephemeralDataRef.current.ephemeralPublicKey;
          user.randomness = ephemeralDataRef.current.randomness;
          user.maxEpoch = ephemeralDataRef.current.maxEpoch;
          user.kp = ephemeralDataRef.current.kp; // Add this
        }

        // Get ZKLogin addresses using the ORIGINAL Google ID token (not the custom access token)
        if (idToken) {
          try {
            const addressesResponse = await getZkLoginAddresses(idToken);

            // Update user with ZKLogin address data
            if (
              addressesResponse.data?.addresses &&
              addressesResponse.data.addresses.length > 0
            ) {
              const firstAddress = addressesResponse.data.addresses[0];

              user.address = firstAddress.address;
              user.salt = firstAddress.salt;
              user.publicKey = firstAddress.publicKey; // This is the ZKLogin publicKey
            }
          } catch (zkError: any) {
            console.error("Error getting ZKLogin addresses:", zkError);
            // Don't fail the entire auth if ZKLogin fails
          }
        } else {
          console.warn("Skipping ZKLogin - no idToken available");
        }

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
  }, [response, setLoading, setAccessToken, setIdToken, setUser, setError]);

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
