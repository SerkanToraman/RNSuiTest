import { Button } from "@rneui/themed";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { getAllBalances, unsafePay } from "../../lib/sui";
import { useAuthLoading, useAuthSession, useLogoutUser } from "../../stores";

export default function HomeScreen() {
  const session = useAuthSession();
  const isLoading = useAuthLoading();
  const logoutUser = useLogoutUser();

  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [payResult, setPayResult] = useState<any>(null);
  const [payLoading, setPayLoading] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
  };

  const handleGetBalances = async () => {
    setLoading(true);
    try {
      const result = await getAllBalances(
        "0xd1cb71c7e5990542ae1a0c4f403c6e6edbf4e37a076bacde40b1b0ce4906fd01"
      );
      if (result.success) {
        setBalances(result.data);
      } else {
        Alert.alert("Error", result.error || "Failed to get balances");
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsafePay = async () => {
    setPayLoading(true);
    try {
      const result = await unsafePay(
        "0xd1cb71c7e5990542ae1a0c4f403c6e6edbf4e37a076bacde40b1b0ce4906fd01",
        ["0x33b24bc101c86d8f5695af19411c396da37df5aa6123082c308cb0fcc4afa530"],
        ["0x1e1baaaf6c3478816c3b88d8373d14957e82b156d0c682afac9d5344fc6fddcc"],
        ["1000000"],
        "0xa1133d793ef1cd4c6d34ee4b3b840f357ac2138a1899f466d3ef769d86ca8f91",
        "10000000"
      );
      console.log(result);
      if (result.success) {
        setPayResult(result.data);
        Alert.alert("Success", "Unsafe pay transaction created successfully!");
      } else {
        Alert.alert(
          "Error",
          result.error || "Failed to create unsafe pay transaction"
        );
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <Text>Session: {session ? "Active" : "No session"}</Text>
      <Text>Loading: {isLoading ? "Yes" : "No"}</Text>
      <Text>Home</Text>

      <Button
        title="Get All Balances"
        onPress={handleGetBalances}
        disabled={loading}
        loading={loading}
        style={{ marginTop: 20 }}
      />
      {balances && (
        <View
          style={{
            marginTop: 20,
            padding: 15,
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            All Balances:
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "monospace" }}>
            {JSON.stringify(balances, null, 2)}
          </Text>
        </View>
      )}

      <Button
        title="Unsafe Pay"
        onPress={handleUnsafePay}
        disabled={payLoading}
        loading={payLoading}
        style={{ marginTop: 10 }}
      />

      {payResult && (
        <View
          style={{
            marginTop: 20,
            padding: 15,
            backgroundColor: "#e8f5e8",
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            Unsafe Pay Result:
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "monospace" }}>
            {JSON.stringify(payResult, null, 2)}
          </Text>
        </View>
      )}

      <Button
        title="Logout"
        onPress={handleLogout}
        disabled={isLoading}
        style={{ marginTop: 20 }}
      />
    </ScrollView>
  );
}
