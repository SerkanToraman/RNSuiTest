import { Button } from "@rneui/themed";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAuthUser } from "../../stores";
import { useGoogleSignIn } from "../../stores/authStore";

export default function LoginScreen() {
  const { signIn, isLoading, error } = useGoogleSignIn();
  const user = useAuthUser();

  // Navigate when user is successfully authenticated
  useEffect(() => {
    if (user && user.idToken) {
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 100);
    }
  }, [user]);

  // Show error alerts
  useEffect(() => {
    if (error) {
      Alert.alert("Sign-In Error", error.message || "Authentication failed");
    }
  }, [error]);

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
          onPress={signIn}
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
        {error && <Text style={styles.errorText}>{error.message}</Text>}
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
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
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
    backgroundColor: "#4285F4",
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "red",
    marginTop: 10,
    textAlign: "center",
  },
});
