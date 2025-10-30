import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useAuthUser } from "../stores";
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
  const user = useAuthUser();
  // const initializeAuthListener = useInitializeAuthListener();

  // useEffect(() => {
  //   initializeAuthListener();
  // }, [initializeAuthListener]);

  return (
    <>
      <Stack>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
