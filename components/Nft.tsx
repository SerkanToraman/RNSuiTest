import "react-native-get-random-values";

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Button } from "@rneui/themed";
import { Buffer } from "buffer";

import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { createHero } from "../lib/createHero";
import { getZkLoginZKP, sponsorTransaction } from "../lib/enoki";
import { useAuthStore, useAuthUser } from "../stores";

export default function Nft() {
  const rpcUrl = getFullnodeUrl("testnet");
  const client = useMemo(() => new SuiClient({ url: rpcUrl }), [rpcUrl]);
  const user = useAuthUser();
  const idToken = useAuthStore((state) => state.idToken); // Get idToken from store
  console.log("user", user);
  

  const [nftLoading, setNftLoading] = useState(false);
  const [createdNft, setCreatedNft] = useState<any>(null);

  const handleCreateNFT = async () => {
    if (
      !user?.ephemeralPublicKey ||
      !user?.randomness ||
      !idToken || // Use idToken from store
      !user?.address
    ) {
      Alert.alert(
        "Missing Data",
        "Please ensure you have completed the login process with all required data."
      );
      return;
    }

    setNftLoading(true);
    try {
      const packageId = process.env.EXPO_PUBLIC_PACKAGE_ID || "YOUR_PACKAGE_ID";
      const tx = createHero(
        packageId,
        `Hero ${Date.now()}`,
        "https://example.com/hero.png",
        "100"
      );

      const transactionBytes = await tx.build({
        client: client,
        onlyTransactionKind: true,
      });
      const txBytes = Buffer.from(transactionBytes).toString("base64");

      const { data } = await sponsorTransaction(
        txBytes,
        "testnet",
        user.address,
        idToken, // Use idToken from store
        [user.address],
        [`${packageId}::hero::create_hero`]
      );

      const zkp = await getZkLoginZKP(
        user.ephemeralPublicKey,
        user.maxEpoch || 2,
        user.randomness,
        idToken, // Use idToken from store
        "testnet"
      );

      console.log("zkp", zkp);

      // console.log("bytes", bytes);
      // console.log("userSignature", userSignature);

      // console.log("userSignature", userSignature);

      // const signedResult = await signSponsoredTransaction(
      //   data.digest,
      //   user?.ephemeralKeypair,
      //   user.idToken
      // );
      // console.log("signedResult", signedResult);

      setCreatedNft({
        bytes: data.bytes,
        digest: data.digest,
      });
    } catch (error: any) {
      console.error("Error creating NFT:", error);
    } finally {
      setNftLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Button
        title="Create NFT"
        onPress={handleCreateNFT}
        disabled={
          nftLoading ||
          !user?.ephemeralPublicKey ||
          !user?.randomness ||
          !idToken || // Use idToken from store
          !user?.address
        }
        loading={nftLoading}
        buttonStyle={{
          backgroundColor: "#28a745",
          marginTop: 20,
        }}
        titleStyle={{
          fontSize: 16,
          fontWeight: "600",
        }}
      />

      {createdNft && (
        <View
          style={{
            marginTop: 20,
            padding: 15,
            backgroundColor: "#d4edda",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#c3e6cb",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            Sponsored Transaction:
          </Text>
          {createdNft.digest && (
            <Text
              style={{ fontSize: 12, fontFamily: "monospace", marginBottom: 5 }}
            >
              <Text style={{ fontWeight: "600" }}>Digest:</Text>{" "}
              {createdNft.digest}
            </Text>
          )}
          {createdNft.zkp && (
            <View style={{ marginTop: 10 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", marginBottom: 5 }}
              >
                ZKP:
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
                {createdNft.zkp.substring(0, 50)}...
              </Text>
            </View>
          )}
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 5 }}>
              Transaction Data:
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
              {JSON.stringify(createdNft, null, 2)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
