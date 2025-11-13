// Import polyfill first, before any other imports that might use crypto
import "react-native-get-random-values";

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { getAllBalances } from "../../lib/sui";

import { Button } from "@rneui/themed";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import Nft from "../../components/Nft"; // Add this import
import { useAuthLoading, useAuthUser, useSignOut } from "../../stores";

export default function HomeScreen() {
  const rpcUrl = getFullnodeUrl("testnet");
  const client = useMemo(() => new SuiClient({ url: rpcUrl }), [rpcUrl]); // Wrap in useMemo

  const user = useAuthUser();
  const isLoading = useAuthLoading();
  const signOut = useSignOut();

  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState<any>(null);
  // Remove: const [nftLoading, setNftLoading] = useState(false);
  // Remove: const [createdNft, setCreatedNft] = useState<any>(null);

  // Move the async code to useEffect
  useEffect(() => {
    const fetchCoins = async () => {
      if (!user?.address) {
        return; // Don't fetch if user doesn't have an address yet
      }

      try {
        const coinsData = await client.getCoins({
          owner: user.address, // Use user's address instead of hardcoded one
        });
        setCoins(coinsData);
      } catch (error) {
        console.error("Error fetching coins:", error);
      }
    };

    fetchCoins();
  }, [user?.address, client]); // Add client to dependencies

  const handleLogout = async () => {
    signOut(); // This just clears the state, doesn't return a promise
    router.replace("/(auth)/login");
  };

  const handleGetBalances = async () => {
    if (!user?.address) {
      Alert.alert(
        "No Address",
        "User address not available. Please complete the login process."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await getAllBalances(user.address); // Use user's address
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

  // Remove the entire handleCreateNFT function (lines 85-132)

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <Text>Session: {user ? "Active" : "No session"}</Text>
      <Text>Loading: {isLoading ? "Yes" : "No"}</Text>

      {/* Display user information */}
      {user && (
        <View
          style={{
            marginTop: 20,
            padding: 15,
            backgroundColor: "#e8f4f8",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#b3d9e6",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            User Information
          </Text>
          <Text style={{ fontSize: 14, marginBottom: 5 }}>
            <Text style={{ fontWeight: "600" }}>Name:</Text> {user.name}
          </Text>
          <Text style={{ fontSize: 14, marginBottom: 5 }}>
            <Text style={{ fontWeight: "600" }}>Email:</Text> {user.email}
          </Text>
          {user.address && (
            <View style={{ marginTop: 10 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", marginBottom: 5 }}
              >
                Sui Address:
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  backgroundColor: "#f5f5f5",
                  padding: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {user.address}
              </Text>
            </View>
          )}
          {!user.address && (
            <Text
              style={{
                fontSize: 12,
                color: "#666",
                fontStyle: "italic",
                marginTop: 10,
              }}
            >
              No address available
            </Text>
          )}
        </View>
      )}
      <Text>{JSON.stringify(user?.ephemeralKeypair, null, 2)}</Text>

      <Text style={{ marginTop: 20 }}>Home</Text>
      <Text>Coins: {coins ? JSON.stringify(coins) : "No coins"}</Text>

      <Button
        title="Get All Balances"
        onPress={handleGetBalances}
        disabled={loading || !user?.address} // Disable if no address
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
      {/* Remove the dryRunResult display section (lines 251-267) */}

      {/* Uncomment and update the logout button */}
      <Button
        title="Logout"
        onPress={handleLogout}
        disabled={isLoading}
        loading={isLoading}
        buttonStyle={{
          backgroundColor: "#dc3545",
          marginTop: 20,
        }}
        titleStyle={{
          fontSize: 16,
          fontWeight: "600",
        }}
      />

      {/* Replace the Create NFT button and display with: */}
      <Nft />

      {/* Remove the old Create NFT button and createdNft display */}
    </ScrollView>
  );
}
