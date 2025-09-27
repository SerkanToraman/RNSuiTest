import { Button, Input } from "@rneui/themed";
import React, { useEffect, useState } from "react";
import { Alert, AppState, StyleSheet, View } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuthLoading, useAuthUser, useLoginUser } from "../stores";

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const user = useAuthUser();
  const isLoading = useAuthLoading();
  const loginUser = useLoginUser();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Please fill in all fields");
      return;
    }

    setLoginError(null);
    const result = await loginUser(email, password);
    if (!result.success) {
      setLoginError(result.error || "Login failed. Please try again.");
    }
  };

  // Show error alerts when login error occurs
  useEffect(() => {
    if (loginError) {
      Alert.alert("Login Error", loginError);
    }
  }, [loginError]);

  // Clear form when user successfully logs in
  useEffect(() => {
    if (user) {
      setEmail("");
      setPassword("");
      setLoginError(null);
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input
          label="Email"
          leftIcon={{ type: "font-awesome", name: "envelope" }}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={"none"}
          keyboardType="email-address"
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Password"
          leftIcon={{ type: "font-awesome", name: "lock" }}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={"none"}
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button
          title="Sign in"
          disabled={isLoading}
          onPress={handleLogin}
          loading={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: "stretch",
  },
  mt20: {
    marginTop: 20,
  },
});
