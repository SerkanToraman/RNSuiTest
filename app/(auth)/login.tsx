import { Button } from "@rneui/themed";
import {
  AuthRequest,
  AuthSessionResult,
  ResponseType,
  makeRedirectUri,
} from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { getNonce, getZkLoginAddresses, makeEphemeral } from "../../lib/enoki";
import { useAuthStore } from "../../stores";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const [authRequest, setAuthRequest] = useState<AuthRequest | null>(null);

  useEffect(() => {
    // Initialize auth request (without nonce initially)
    const request = new AuthRequest({
      clientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID!,
      scopes: ["openid", "profile", "email"],
      responseType: ResponseType.IdToken,
      redirectUri: makeRedirectUri(),
    });
    setAuthRequest(request);
  }, []);

  const handleResponse = async (result: AuthSessionResult) => {
    try {
      setIsLoading(true);
      setError(null);

      if (result.type === "success") {
        const idToken = result.params.id_token;

        if (!idToken) {
          throw new Error("No ID token received");
        }

        const decoded = jwtDecode(idToken) as any;

        // Retrieve stored data from authRequest
        const randomness = (authRequest as any)?._randomness;
        const ephemeralPublicKey = (authRequest as any)?._ephemeralPublicKey;
        const maxEpoch = (authRequest as any)?._maxEpoch;
        const keypairBase64 = (authRequest as any)?._keypair;

        setUser({
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email,
          photo: decoded.picture || null,
          randomness: randomness,
          ephemeralPublicKey: ephemeralPublicKey,
          ephemeralKeypair: keypairBase64,
          maxEpoch: maxEpoch,
          idToken: idToken,
        });

        try {
          const addressesResponse = await getZkLoginAddresses(idToken);

          if (
            addressesResponse.data.addresses &&
            addressesResponse.data.addresses.length > 0
          ) {
            const addresses = addressesResponse.data.addresses;

            console.log("Signed in successfully! Address:", addresses[0]);

            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
              setUser({
                ...currentUser,
                address: addresses[0].address,
                addresses: addresses,
              });
            }
          } else {
            console.log("Signed in successfully! (No addresses found)");
          }
        } catch (addressError: any) {
          console.error("Error getting ZKLogin addresses:", addressError);
        }

        setTimeout(() => {
          router.replace("/(tabs)");
        }, 100);
      } else if (result.type === "error") {
        setError(result.error?.message || "Authentication failed");
        Alert.alert(
          "Sign-In Error",
          result.error?.message || "Authentication failed"
        );
      } else if (result.type === "cancel") {
        // User cancelled
      }
    } catch (error: any) {
      console.error("Error handling auth response:", error);
      const errorMessage =
        error.message || "Something went wrong with Google Sign-In.";
      setError(errorMessage);
      Alert.alert("Sign-In Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { kp, publicKey } = makeEphemeral();
      const secretKey = kp.getSecretKey();
      const keypairBase64 = Buffer.from(secretKey).toString("base64");

      const nonceResponse = await getNonce("testnet", publicKey);
      const enokiNonce = nonceResponse.data.nonce;
      const randomness = nonceResponse.data.randomness;
      const maxEpoch = nonceResponse.data.maxEpoch;

      if (!authRequest) {
        throw new Error("Auth request not ready. Please try again.");
      }

      // Create a new request with the nonce in additionalParameters
      const requestWithNonce = new AuthRequest({
        clientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID!,
        scopes: ["openid", "profile", "email"],
        responseType: ResponseType.IdToken,
        redirectUri: makeRedirectUri(), // Use the imported function
      });

      // Store temporary data on the request object
      (requestWithNonce as any)._randomness = randomness;
      (requestWithNonce as any)._ephemeralPublicKey = publicKey;
      (requestWithNonce as any)._maxEpoch = maxEpoch;
      (requestWithNonce as any)._keypair = keypairBase64;

      setAuthRequest(requestWithNonce);

      // Launch the OAuth flow
      const result = await requestWithNonce.promptAsync({
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      });

      await handleResponse(result);
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      const errorMessage =
        error.message || "Something went wrong with Google Sign-In.";
      setError(errorMessage);
      setIsLoading(false);
      Alert.alert("Sign-In Error", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Sui App</Text>
        <Text style={styles.subtitle}>Sign in with Google to continue</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Sign in with Google"
          disabled={isLoading || !authRequest}
          onPress={handleGoogleLogin}
          loading={isLoading}
          buttonStyle={styles.googleButton}
          titleStyle={styles.buttonText}
          icon={{
            name: "google",
            type: "font-awesome",
            color: "white",
            size: 20,
          }}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}
