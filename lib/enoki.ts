import "expo-standard-web-crypto";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import { toB64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Buffer } from "buffer";
import * as ExpoRandom from "expo-random";
if (typeof globalThis.Buffer === "undefined") {
  // @ts-ignore
  globalThis.Buffer = Buffer;
}

(() => {
  const needsRng =
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.getRandomValues !== "function";

  if (needsRng) {
    // @ts-ignore
    globalThis.crypto = globalThis.crypto || ({} as Crypto);

    // @ts-ignore
    globalThis.crypto.getRandomValues = <T extends ArrayBufferView>(
      view: T
    ): T => {
      const bytes = ExpoRandom.getRandomBytes(view.byteLength);
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength).set(bytes);
      return view;
    };
  }
})();

// --- Config ---
const ENOKI_BASE = "https://api.enoki.mystenlabs.com/v1";
const ENOKI_PUBLIC_KEY = process.env.EXPO_PUBLIC_ENOKI_PUBLIC_KEY!;
const ENOKI_PRIVATE_KEY = process.env.EXPO_PUBLIC_PRIVATE_ENOKI_KEY!;
type SuiNetwork = "testnet" | "mainnet" | "devnet";

// --- API helper ---
async function enoki<T>(
  path: string,
  method: string,
  body?: any,
  jwt?: string,
  usePrivateKey: boolean = false
): Promise<T> {
  const apiKey = usePrivateKey ? ENOKI_PRIVATE_KEY : ENOKI_PUBLIC_KEY;

  // Add validation
  if (!apiKey) {
    throw new Error(
      `Missing Enoki API key (${usePrivateKey ? "private" : "public"})`
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (jwt) {
    headers["zklogin-jwt"] = jwt;
  }

  const res = await fetch(`${ENOKI_BASE}${path}`, {
    method: method,
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Log more details for debugging
    console.error("Enoki API Error:", {
      status: res.status,
      statusText: res.statusText,
      url: `${ENOKI_BASE}${path}`,
      errorText: text,
    });
    throw new Error(text || `Enoki request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Public API ---
export function makeEphemeral() {
  const kp = Ed25519Keypair.generate();
  const publicKey = toB64(kp.getPublicKey().toSuiBytes());

  // const secretKeyBase64 = encodeSuiPrivateKey(
  //   new Uint8Array(Buffer.from(secretKey, "base64")),
  //   "ED25519"
  // );

  return { kp, publicKey };
}

export async function getNonce(
  network: SuiNetwork,
  ephemeralPublicKey: string
) {
  return enoki<{
    data: {
      nonce: string;
      randomness: string;
      epoch: number;
      maxEpoch: number;
      estimatedExpiration: number;
    };
  }>(
    "/zklogin/nonce",
    "POST",
    JSON.stringify({
      network,
      ephemeralPublicKey,
      additionalEpochs: 2,
    })
  );
}

export async function getZkLogin(jwt: string) {
  return enoki<{
    data: {
      user?: any;
      address?: string;
    };
  }>("/zklogin", "GET", undefined, jwt);
}

export async function getZkLoginAddresses(jwt: string) {
  return enoki<{
    data: {
      addresses?: {
        address: string;
        salt: string;
        publicKey: string;
        clientId: string;
        legacy: boolean;
      }[];
    };
  }>("/zklogin/addresses", "GET", undefined, jwt);
}

export async function getZkLoginZKP(
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  jwt: string,
  network: SuiNetwork = "testnet"
) {
  return enoki<{
    data: {
      zkp: string;
    };
  }>(
    "/zklogin/zkp",
    "POST",
    JSON.stringify({
      network,
      ephemeralPublicKey,
      maxEpoch,
      randomness,
    }),
    jwt
  );
}

export async function sponsorTransaction(
  transactionBlockKindBytes: string,
  network: SuiNetwork,
  sender: string,
  jwt: string,
  allowedAddresses: string[] = [],
  allowedMoveCallTargets: string[] = []
) {
  console.log("sponsorTransaction", {
    transactionBlockKindBytes,
    network,
    sender,
    allowedAddresses,
    allowedMoveCallTargets,
  });

  return enoki<{
    data: {
      bytes: string;
      digest: string;
      zkp: string;
    };
  }>(
    "/transaction-blocks/sponsor",
    "POST",
    JSON.stringify({
      transactionBlockKindBytes,
      network,
      sender,
      allowedAddresses,
      allowedMoveCallTargets,
    }),
    jwt,
    true
  );
}

export async function signSponsoredTransaction(
  digest: string,
  signature: string | undefined,
  jwt: string
) {
  if (!signature) {
    throw new Error("Signature not found");
  }
  console.log("signSponsoredTransaction", {
    digest,
    signature: signature,
  });

  return enoki<{
    data: {
      bytes: string;
      digest: string;
      zkp?: string;
    };
  }>(
    `/transaction-blocks/sponsor/${digest}`,
    "POST",
    JSON.stringify({
      signature,
    }),
    jwt,
    true
  );
}
