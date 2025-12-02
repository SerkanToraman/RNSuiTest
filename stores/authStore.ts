import { toB64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
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
  keypair: any | null; // Ephemeral keypair (not persisted)
  serializedKeypair: string | null; // Serialized keypair for persistence
}

interface AuthActions {
  setUser: (user: GoogleUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setIdToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AuthError | null) => void;
  setKeypair: (keypair: any | null) => void;
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
  keypair: null,
  serializedKeypair: null,
};

// Helper function to serialize keypair (for potential future use)
function serializeKeypair(keypair: Ed25519Keypair | null): string | null {
  if (!keypair) return null;
  try {
    const secretKey = keypair.getSecretKey();
    if (typeof secretKey === "string") {
      return secretKey;
    }
    return toB64(secretKey as unknown as Uint8Array);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      setIdToken: (token) => set({ idToken: token }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      setKeypair: (keypair) => {
        const serialized = serializeKeypair(keypair);
        set({ keypair, serializedKeypair: serialized });
      },

      signOut: () => {
        set({
          user: null,
          accessToken: null,
          idToken: null,
          isLoading: false,
          error: null,
          keypair: null,
          serializedKeypair: null,
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
        // Don't persist keypair - ephemeral keypairs should be generated fresh on each login
      }),
      onRehydrateStorage: () => (state) => {
        // Don't deserialize keypair - ephemeral keypairs should be generated fresh
        // Clear any persisted keypair data
        if (state) {
          state.keypair = null;
          state.serializedKeypair = null;
        }
      },
    }
  )
);

// Selectors for better performance
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthKeypair = () => useAuthStore((state) => state.keypair);
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
  const setKeypair = useAuthStore((state) => state.setKeypair);

  // Ref to store ephemeral data for use in handleResponse
  const ephemeralDataRef = useRef<{
    ephemeralPublicKey: string;
    randomness: string;
    maxEpoch: number;
    kp?: any; // Add this
  } | null>(null);

  // State for config with nonce
  const [authConfig, setAuthConfig] = useState<AuthRequestConfig>(config);

  // Generate nonce and update config - only when signIn is called
  const generateNonceAndUpdateConfig = useCallback(async () => {
    // Guard to prevent multiple executions
    if (ephemeralDataRef.current) {
      return;
    }

    // Don't generate keypair if user is already logged in
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      return;
    }

    const { kp, publicKey } = makeEphemeral();
    console.log("kp", kp);

    // Store keypair immediately in store
    setKeypair(kp);

    try {
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
    } catch {
      // Silently handle errors
    }
  }, [setKeypair]);

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
          // Store keypair in separate state
          if (ephemeralDataRef.current.kp) {
            setKeypair(ephemeralDataRef.current.kp);
          }
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
          } catch {
            // Don't fail the entire auth if ZKLogin fails
          }
        }

        setUser(user);
      } catch (e: any) {
        setError(e as AuthError);
      } finally {
        setLoading(false);
      }
    } else if (response?.type === "cancel") {
      // User cancelled - no error needed
    } else if (response?.type === "error") {
      setError(response.error as AuthError);
    }
  }, [
    response,
    setLoading,
    setAccessToken,
    setIdToken,
    setUser,
    setError,
    setKeypair,
  ]);

  // Handle OAuth response
  useEffect(() => {
    handleResponse();
  }, [handleResponse]);

  const signIn = async () => {
    try {
      // Generate keypair and nonce before signing in (if not already generated)
      if (!ephemeralDataRef.current) {
        await generateNonceAndUpdateConfig();
        // Wait for the config to update - useAuthRequest will re-initialize with new config
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (!request) {
        return;
      }
      await promptAsync();
    } catch (e: any) {
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
