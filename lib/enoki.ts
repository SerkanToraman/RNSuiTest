// enoki.ts

// --- Polyfills MUST be first ---
import "expo-standard-web-crypto"; // defines globalThis.crypto + subtle
import "react-native-get-random-values"; // secure RNG source
import "react-native-url-polyfill/auto"; // URL & URLSearchParams

// Optional but often needed for Node-style libs (like noble)
import { toB64 } from "@mysten/bcs";
import { Buffer } from "buffer";
import * as ExpoRandom from "expo-random";

// --- Imports that depend on crypto being ready ---
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
if (typeof globalThis.Buffer === "undefined") {
  // @ts-ignore
  globalThis.Buffer = Buffer;
}

// --- Safety net: fallback getRandomValues via expo-random (rarely needed) ---
// --- Safety net: fallback getRandomValues via expo-random ---
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
type SuiNetwork = "testnet" | "mainnet" | "devnet";

// --- API helper ---
async function enoki<T>(
  path: string,
  method: string,
  body?: any,
  jwt?: string
): Promise<T> {
  console.log("enoki", `${ENOKI_BASE}${path}`);
  console.log("enoki", ENOKI_PUBLIC_KEY);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${ENOKI_PUBLIC_KEY}`,
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
    throw new Error(text || `Enoki request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Public API ---
export function makeEphemeral() {
  const kp = Ed25519Keypair.generate();
  const publicKey = toB64(kp.getPublicKey().toSuiBytes()); // Changed from toRawBytes() to toSuiBytes()
  return { keypair: kp, publicKey };
}

export async function getNonce(
  network: SuiNetwork,
  ephemeralPublicKey: string
) {
  console.log("getNonce", network, ephemeralPublicKey);

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

export async function getZKP(
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  jwt: string,
  network: SuiNetwork = "testnet"
) {
  console.log("getZKP", {
    ephemeralPublicKey,
    maxEpoch,
    randomness,
    jwt,
    network,
  });

  return enoki<{
    data: {
      zkp: string;
    };
  }>(
    "/zklogin/zkp",
    "POST",
    JSON.stringify({
      ephemeralPublicKey,
      maxEpoch,
      randomness,
    }),
    jwt
  );
}

export async function getZkLogin(jwt: string) {
  console.log("getZkLogin", { jwt });

  return enoki<{
    data: {
      // Add fields that might be returned from zklogin endpoint
      user?: any;
      address?: string;
      // Add other fields as needed
    };
  }>(
    "/zklogin",
    "GET",
    undefined, // No body for GET request
    jwt
  );
}

export async function getZkLoginAddresses(jwt: string) {
  console.log("getZkLoginAddresses", { jwt });

  return enoki<{
    data: {
      addresses?: {
        address: string;
        salt: string;
        publicKey: string;
        clientId: string;
        legacy: boolean;
      }[];
      // Add other fields that might be returned
    };
  }>(
    "/zklogin/addresses",
    "GET",
    undefined, // No body for GET request
    jwt
  );
}

export async function getZkLoginZKP(
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  jwt: string,
  network: SuiNetwork = "testnet"
) {
  console.log("getZkLoginZKP", {
    ephemeralPublicKey,
    maxEpoch,
    randomness,
    jwt,
    network,
  });

  return enoki<{
    data: {
      zkp: string;
      // Add other fields that might be returned
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
