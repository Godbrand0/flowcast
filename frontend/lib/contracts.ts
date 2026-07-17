import type { Address } from "viem";

export const STREAM_VAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_STREAM_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

export const BATCH_STREAM_ADDRESS = (process.env
  .NEXT_PUBLIC_BATCH_STREAM_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

/** USDC on Arc — same asset as the native gas token, ERC-20 interface (6 decimals). */
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as Address;

export const USDC_DECIMALS = 6;

export const EXPLORER_URL = "https://testnet.arcscan.app";

export enum StreamStatus {
  Active = 0,
  Paused = 1,
  Cancelled = 2,
  Completed = 3,
}

export interface Stream {
  business: Address;
  recipient: Address;
  deposit: bigint;
  ratePerSecond: bigint;
  startTime: number;
  endTime: number;
  pausedAt: number;
  withdrawn: bigint;
  status: StreamStatus;
  cancelable: boolean;
}
