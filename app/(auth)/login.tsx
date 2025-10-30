import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Button } from "@rneui/themed";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getNonce, getZkLogin, makeEphemeral } from "../../lib/enoki";
import { useAuthLoading, useAuthUser, useLoginUser } from "../../stores";

export default function Auth() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const user = useAuthUser();
  const isLoading = useAuthLoading();
  const loginUser = useLoginUser();

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      console.log("Google login pressed");

      const { keypair, publicKey } = makeEphemeral();
      console.log("Ephemeral keypair:", keypair);
      console.log("Ephemeral public key:", publicKey);

      const nonce = await getNonce("testnet", publicKey);
      console.log("Nonce:", nonce);

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // STEP 2: Sign in with Google (let Google generate its own nonce)
      const userInfo = await GoogleSignin.signIn({ nonce: nonce.data.nonce });

      if (userInfo.user) {
        const googleUser = userInfo.user;
        console.log("Google login successful:", googleUser);

        // Get the JWT token from Google Sign-In
        const tokens = await GoogleSignin.getTokens();
        const jwt = tokens.idToken;
        console.log("JWT token:", jwt);

        // Extract nonce from JWT
        const decodedJWT = jwtDecode(jwt) as any;
        const nonce = decodedJWT.nonce;
        console.log("Extracted nonce from JWT:", nonce);

        // STEP 3: Get ZKLogin user data using just the JWT
        const zkLoginData = await getZkLogin(jwt);

        console.log("ZKLogin user data:", zkLoginData);
      }
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      Alert.alert(
        "Sign-In Error",
        error.message ||
          "Something went wrong with Google Sign-In. Please try again."
      );
    }
  };

  // Show error alerts when login error occurs
  useEffect(() => {
    if (loginError) {
      Alert.alert("Login Error", loginError);
    }
  }, [loginError]);

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
      </View>

      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>Welcome, {user.email}!</Text>
          <Text style={styles.userEmail}>You are successfully logged in</Text>
        </View>
      )}
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
  userInfo: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#e8f5e8",
    borderRadius: 8,
    width: "100%",
    maxWidth: 300,
  },
  userText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
});
