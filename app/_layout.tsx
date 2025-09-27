import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { useAuthSession, useInitializeAuthListener } from "../stores";
import { Splash } from "./splash";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function Root() {
  return (
    <>
      <Splash />
      <RootNavigator />
    </>
  );
}

function RootNavigator() {
  const session = useAuthSession();
  const initializeAuthListener = useInitializeAuthListener();

  useEffect(() => {
    initializeAuthListener();
  }, [initializeAuthListener]);

  return (
    <>
      <Stack>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
