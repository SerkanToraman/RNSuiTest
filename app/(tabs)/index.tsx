// Import polyfill first, before any other imports that might use crypto
import "react-native-get-random-values";

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { Button } from "@rneui/themed";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import {
  dryRunTransactionBlock,
  executeTransactionBlock,
  getAllBalances,
  unsafePay,
} from "../../lib/sui";
import { useAuthLoading, useAuthSession, useLogoutUser } from "../../stores";

// Function to create a new keypair with error handling and retry logic
const createKeypair = async (): Promise<Ed25519Keypair | null> => {
  try {
    const keypair = new Ed25519Keypair();
    console.log("keypair created successfully", keypair);
    return keypair;
  } catch (error) {
    console.error("Error creating keypair:", error);

    // Retry after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const retryKeypair = new Ed25519Keypair();
          console.log("keypair created on retry", retryKeypair);
          resolve(retryKeypair);
        } catch (retryError) {
          console.error("Error creating keypair (retry):", retryError);
          resolve(null);
        }
      }, 100);
    });
  }
};

export default function HomeScreen() {
  const rpcUrl = getFullnodeUrl("testnet");
  const client = new SuiClient({ url: rpcUrl });

  const [keypair, setKeypair] = useState<Ed25519Keypair | null>(null);

  const session = useAuthSession();
  const isLoading = useAuthLoading();
  const logoutUser = useLogoutUser();

  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [payResult, setPayResult] = useState<any>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [coins, setCoins] = useState<any>(null);

  // Function to initialize keypair
  const initializeKeypair = async () => {
    const newKeypair = await createKeypair();
    setKeypair(newKeypair);
  };

  // Move the async code to useEffect
  useEffect(() => {
    // Use setTimeout to ensure polyfill is loaded
    setTimeout(initializeKeypair, 0);

    const fetchCoins = async () => {
      try {
        const coinsData = await client.getCoins({
          owner:
            "0xd1cb71c7e5990542ae1a0c4f403c6e6edbf4e37a076bacde40b1b0ce4906fd01",
        });
        setCoins(coinsData);
      } catch (error) {
        console.error("Error fetching coins:", error);
      }
    };

    fetchCoins();
  }, []);

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

        // Extract txBytes from result.data and run dry run
        if (result.data && result.data.txBytes) {
          const dryRunResult = await dryRunTransactionBlock(
            result.data.txBytes
          );
          console.log("Dry run result:", dryRunResult);
          console.log("Signature:", process.env.EXPO_PUBLIC_SIGNATURE);
          if (dryRunResult.success) {
            setDryRunResult(dryRunResult.data);

            // Use private key directly (replace with your actual private key)
            const privateKeyHex = process.env.EXPO_PUBLIC_BASE_64_KEY;

            // Convert hex private key to Uint8Array
            if (!privateKeyHex) {
              console.error("No private key found in environment variables");
              return;
            }

            const executeResult = await executeTransactionBlock(
              result.data.txBytes,
              [process.env.EXPO_PUBLIC_SIGNATURE as string],
              {},
              "WaitForLocalExecution"
            );
            console.log("Execute result:", executeResult);
          } else {
            console.error("Dry run failed:", dryRunResult.error);
          }
        }

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
      <Text>Coins: {coins ? JSON.stringify(coins) : "No coins"}</Text>

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

      {dryRunResult && (
        <View
          style={{
            marginTop: 20,
            padding: 15,
            backgroundColor: "#f0f8ff",
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            Dry Run Result:
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "monospace" }}>
            {JSON.stringify(dryRunResult, null, 2)}
          </Text>
        </View>
      )}

      {/* <Button
        title="Logout"
        onPress={handleLogout}
        disabled={isLoading}
        style={{ marginTop: 20 }}
      /> */}
    </ScrollView>
  );
}
