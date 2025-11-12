import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Button } from "@rneui/themed";
import { Buffer } from "buffer";
import { router } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getNonce, getZkLoginAddresses, makeEphemeral } from "../../lib/enoki";
import type { GoogleUser } from "../../stores";
import { useAuthStore } from "../../stores";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    GoogleSignin.configure({
      scopes: ["openid", "profile", "email"],
      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { kp, publicKey } = makeEphemeral();
      const nonceResponse = await getNonce("testnet", publicKey);

      const enokiNonce = nonceResponse.data.nonce;
      const randomness = nonceResponse.data.randomness;
      const maxEpoch = nonceResponse.data.maxEpoch;

      if (!enokiNonce) {
        throw new Error("Failed to retrieve nonce from Enoki.");
      }

      const secretKeyBytes = kp.getSecretKey();
      const secretKey = Buffer.from(secretKeyBytes).toString("base64");
      await GoogleSignin.signOut();
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn({
        nonce: enokiNonce,
      });

      const idToken = userInfo?.data?.idToken;

      if (!idToken) {
        throw new Error("No ID token received from Google.");
      }

      const decoded = jwtDecode(idToken) as any;

      const baseUser: GoogleUser = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.name || decoded.email,
        photo: decoded.picture || null,
        randomness,
        ephemeralPublicKey: publicKey,
        ephemeralKeypair: secretKey,
        maxEpoch,
        idToken,
      };

      let finalUser = baseUser;

      try {
        const addressesResponse = await getZkLoginAddresses(idToken);

        if (
          addressesResponse.data.addresses &&
          addressesResponse.data.addresses.length > 0
        ) {
          const addresses = addressesResponse.data.addresses;
          finalUser = {
            ...baseUser,
            address: addresses[0].address,
            addresses,
          };
        } else {
          throw new Error("No addresses found");
        }
      } catch (addressError: any) {
        console.error("Error getting ZKLogin addresses:", addressError);
        throw new Error("Error getting ZKLogin addresses");
      }

      setUser(finalUser);
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Google Sign In Error:", err);
      const errorMessage =
        err.message || "Something went wrong with Google Sign-In.";
      setError(errorMessage);
      Alert.alert("Sign-In Error", errorMessage);
    } finally {
      setIsLoading(false);
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
          disabled={isLoading}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
  },
  googleButton: {
    backgroundColor: "#4285f4",
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});
