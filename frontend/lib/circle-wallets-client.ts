"use client";

import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeResult, SignTransactionResult } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";

export function circleWalletsClientConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
}

/**
 * Presents a Circle challenge (PIN setup, contract call, or transfer) to the
 * user and resolves once they approve it. Wraps the SDK's callback API in a
 * promise for easier use in async handlers.
 */
export function executeCircleChallenge(
  challengeId: string,
  userToken: string,
  encryptionKey: string
): Promise<ChallengeResult | SignTransactionResult> {
  return new Promise((resolve, reject) => {
    if (!process.env.NEXT_PUBLIC_CIRCLE_APP_ID) {
      reject(new Error("Circle Web SDK is not configured (NEXT_PUBLIC_CIRCLE_APP_ID missing)"));
      return;
    }
    const sdk = new W3SSdk({
      appSettings: { appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID },
    });
    sdk.setAuthentication({ userToken, encryptionKey });
    sdk.execute(challengeId, (error, result) => {
      if (error || !result) {
        reject(new Error(error?.message ?? "Circle challenge failed"));
        return;
      }
      resolve(result);
    });
  });
}
