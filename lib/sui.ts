// Direct RPC call function
const makeRpcCall = async (url: string, method: string, params: any[] = []) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "RPC error");
    }

    return { success: true, data: data.result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Get all balances for an address
export const getAllBalances = async (address: string) => {
  const rpcUrl = "https://fullnode.testnet.sui.io:443";
  return await makeRpcCall(rpcUrl, "suix_getAllBalances", [address]);
};

// Pay SUI to multiple addresses
export const unsafePay = async (
  signer: string,
  inputCoins: string[],
  recipients: string[],
  amounts: string[],
  gas: string | null,
  gasBudget: string
) => {
  const rpcUrl = "https://fullnode.testnet.sui.io:443";

  // Pass parameters as individual array elements, not as an object
  return await makeRpcCall(rpcUrl, "unsafe_pay", [
    signer,
    inputCoins,
    recipients,
    amounts,
    gas,
    gasBudget,
  ]);
};

// Dry run transaction block to get execution effects without committing to chain
export const dryRunTransactionBlock = async (txBytes: string) => {
  const rpcUrl = "https://fullnode.testnet.sui.io:443";

  return await makeRpcCall(rpcUrl, "sui_dryRunTransactionBlock", [txBytes]);
};

// Execute transaction block
export const executeTransactionBlock = async (
  txBytes: string,
  signatures: string[],
  options: {
    showInput?: boolean;
    showRawInput?: boolean;
    showEffects?: boolean;
    showEvents?: boolean;
    showObjectChanges?: boolean;
    showBalanceChanges?: boolean;
    showRawEffects?: boolean;
  } = {},
  requestType:
    | "WaitForEffectsCert"
    | "WaitForLocalExecution" = "WaitForLocalExecution"
) => {
  const rpcUrl = "https://fullnode.testnet.sui.io:443";

  return await makeRpcCall(rpcUrl, "sui_executeTransactionBlock", [
    txBytes,
    signatures,
    options,
    requestType,
  ]);
};
