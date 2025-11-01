import { Button } from "@rneui/themed";
import * as Google from "expo-auth-session/providers/google";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getNonce, getZkLoginAddresses, makeEphemeral } from "../../lib/enoki";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
    // Remove responseType - let it default to "code" for iOS
    // The provider will auto-exchange the code for id_token with nonce included
  });

  useEffect(() => {
    if (response?.type === "success") {
      handleResponse();
    } else if (response?.type === "error") {
      setError(response.error?.message || "Authentication failed");
      setIsLoading(false);
      Alert.alert(
        "Sign-In Error",
        response.error?.message || "Authentication failed"
      );
    } else if (response?.type === "cancel") {
      setIsLoading(false);
    }
  }, [response]);

  const handleResponse = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (response?.type === "success") {
        // When using code flow, the id_token is in response.authentication.idToken
        // or response.params.id_token (after auto-exchange)
        const idToken =
          response.authentication?.idToken || response.params.id_token;

        if (idToken) {
          const decoded = jwtDecode(idToken) as any;

          console.log("Google login successful!");
          console.log("User:", {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            name: decoded.name || decoded.email,
            picture: decoded.picture || null,
          });
          console.log("ID Token:", idToken);
          console.log("Nonce in JWT:", decoded.nonce);

          // Get ZKLogin addresses
          try {
            const addressesResponse = await getZkLoginAddresses(idToken);
            console.log("ZKLogin addresses:", addressesResponse.data.addresses);

            if (
              addressesResponse.data.addresses &&
              addressesResponse.data.addresses.length > 0
            ) {
              const addresses = addressesResponse.data.addresses;
              console.log("User addresses:");
              addresses.forEach((addr, index) => {
                console.log(`Address ${index + 1}:`, addr.address);
                console.log(`  Salt:`, addr.salt);
                console.log(`  Public Key:`, addr.publicKey);
                console.log(`  Client ID:`, addr.clientId);
                console.log(`  Legacy:`, addr.legacy);
              });

              console.log(
                "Signed in successfully! Address:",
                addresses[0].address
              );
            } else {
              console.log("Signed in successfully! (No addresses found)");
            }
          } catch (addressError: any) {
            console.error("Error getting ZKLogin addresses:", addressError);
            console.log("Signed in successfully! (Error getting addresses)");
          }
        } else {
          throw new Error("No ID token received");
        }
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

      // STEP 1: Get nonce from Enoki
      const { keypair, publicKey } = makeEphemeral();
      console.log("Ephemeral public key:", publicKey);

      const nonceResponse = await getNonce("testnet", publicKey);
      console.log("Nonce response:", nonceResponse);
      const enokiNonce = nonceResponse.data.nonce;
      console.log("Enoki nonce:", enokiNonce);

      if (!request) {
        throw new Error("Auth request not ready. Please try again.");
      }

      // STEP 2: Set the nonce directly on the request object
      // The GoogleAuthRequest class has a nonce property
      (request as any).nonce = enokiNonce;

      // STEP 3: Also set it in extraParams if available
      if ((request as any).extraParams) {
        (request as any).extraParams.nonce = enokiNonce;
      }

      await promptAsync();
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
          disabled={isLoading || !request}
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
