/**
 * Server-side client for Circle's Programmable Wallets — User-Controlled model.
 *
 * The recipient's device (via the Web SDK, client-side) sets a PIN/passkey and
 * signs; FlowCast's backend never holds recipient key material — it only
 * requests "challenges" (wallet creation, contract calls, transfers) which the
 * SDK then presents to the user for approval.
 *
 * Live once CIRCLE_API_KEY + NEXT_PUBLIC_CIRCLE_APP_ID are set. Field names
 * verified against developers.circle.com/wallets/user-controlled docs.
 * Sandbox vs production is determined by which API key you use, not the
 * host — Circle Wallets uses a single base URL for both.
 */
import { randomUUID } from "crypto";

const CIRCLE_API_BASE =
  process.env.CIRCLE_WALLETS_API_BASE ?? "https://api.circle.com";

export function circleWalletsConfigured(): boolean {
  return !!process.env.CIRCLE_API_KEY && !!process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
}

interface CircleErrorBody {
  code?: number;
  message?: string;
}

async function circleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CIRCLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(
      `Circle ${path} failed (${res.status}): ${body?.message ?? JSON.stringify(body)}`
    ) as Error & { circleCode?: number };
    err.circleCode = (body as CircleErrorBody)?.code;
    throw err;
  }
  return (body.data ?? body) as T;
}

/** Registers a Circle end-user for this recipient. Safe to call again — Circle
 *  rejects duplicates, which we treat as already-provisioned. */
export async function ensureCircleUser(userId: string): Promise<void> {
  try {
    await circleFetch(`/v1/w3s/users`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    const alreadyExists = e instanceof Error && /exist/i.test(e.message);
    if (!alreadyExists) throw e;
  }
}

export async function createUserToken(
  userId: string
): Promise<{ userToken: string; encryptionKey: string }> {
  return circleFetch(`/v1/w3s/users/token`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

/** Circle's code for "this user has already completed PIN setup" — not an
 *  error for us, just means we should load their existing wallet instead. */
export const ALREADY_INITIALIZED_CODE = 155106;

/** Kicks off PIN setup + wallet creation on Arc Testnet. The returned challengeId
 *  is executed client-side by the Web SDK. Throws with `circleCode ===
 *  ALREADY_INITIALIZED_CODE` if this user already has a wallet. */
export async function initializeUserWallet(
  userToken: string
): Promise<{ challengeId: string }> {
  return circleFetch(`/v1/w3s/user/initialize`, {
    method: "POST",
    headers: { "X-User-Token": userToken },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      blockchains: ["ARC-TESTNET"],
      accountType: "SCA",
    }),
  });
}

export interface CircleWallet {
  id: string;
  address: string;
  blockchain: string;
}

export async function getUserWallets(userToken: string): Promise<CircleWallet[]> {
  const data = await circleFetch<{ wallets: CircleWallet[] }>(`/v1/w3s/wallets`, {
    headers: { "X-User-Token": userToken },
  });
  return data.wallets;
}

/** Finds the USDC token's internal Circle tokenId for a wallet — needed by
 *  the transfer endpoint (which addresses tokens by id, not contract address). */
export async function findUsdcTokenId(
  walletId: string,
  userToken: string
): Promise<string | null> {
  const data = await circleFetch<{
    tokenBalances: { token: { id: string; symbol: string } }[];
  }>(`/v1/w3s/wallets/${walletId}/balances`, {
    headers: { "X-User-Token": userToken },
  });
  const usdc = data.tokenBalances.find((b) => b.token.symbol === "USDC");
  return usdc?.token.id ?? null;
}

/** Challenge for the recipient to approve calling a contract function (e.g.
 *  StreamVault.withdraw(streamId)) from their Circle wallet, via PIN. */
export async function createContractExecutionChallenge(
  userToken: string,
  walletId: string,
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: unknown[]
): Promise<{ challengeId: string }> {
  return circleFetch(`/v1/w3s/user/transactions/contractExecution`, {
    method: "POST",
    headers: { "X-User-Token": userToken },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      feeLevel: "MEDIUM",
    }),
  });
}

/** Challenge for the recipient to send USDC from their Circle wallet to an
 *  external address (e.g. an exchange or another wallet they control). */
export async function createExternalTransferChallenge(
  userToken: string,
  walletId: string,
  destinationAddress: string,
  tokenId: string,
  amount: string
): Promise<{ challengeId: string }> {
  return circleFetch(`/v1/w3s/user/transactions/transfer`, {
    method: "POST",
    headers: { "X-User-Token": userToken },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      walletId,
      destinationAddress,
      tokenId,
      amounts: [amount],
      feeLevel: "MEDIUM",
    }),
  });
}
