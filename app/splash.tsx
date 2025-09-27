import { SplashScreen } from "expo-router";
import { useAuthLoading } from "../stores";

export function Splash() {
  const isLoading = useAuthLoading();

  if (!isLoading) {
    SplashScreen.hideAsync();
  }

  return null;
}
