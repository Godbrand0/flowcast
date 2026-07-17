import { Stream, StreamStatus, USDC_DECIMALS } from "./contracts";

/**
 * Client-side mirror of StreamVault._accruedBalance — lets the UI tick every
 * second without RPC calls. `nowMs` is Date.now().
 */
export function accruedBalance(stream: Stream, nowMs: number): bigint {
  if (
    stream.status === StreamStatus.Cancelled ||
    stream.status === StreamStatus.Completed
  ) {
    return 0n;
  }

  const now = Math.floor(nowMs / 1000);
  let effective = stream.status === StreamStatus.Paused ? stream.pausedAt : now;
  if (effective >= stream.endTime) effective = stream.endTime;
  if (effective <= stream.startTime) return 0n;

  const elapsed = BigInt(effective - stream.startTime);
  let vested = elapsed * stream.ratePerSecond;
  if (vested > stream.deposit) vested = stream.deposit;

  return vested > stream.withdrawn ? vested - stream.withdrawn : 0n;
}

/** Total vested so far (withdrawn + withdrawable), for progress bars. */
export function vestedAmount(stream: Stream, nowMs: number): bigint {
  return stream.withdrawn + accruedBalance(stream, nowMs);
}

/** 0–100 progress through the stream's deposit. */
export function streamProgress(stream: Stream, nowMs: number): number {
  if (stream.deposit === 0n) return 0;
  return Number((vestedAmount(stream, nowMs) * 10_000n) / stream.deposit) / 100;
}

export function secondsRemaining(stream: Stream, nowMs: number): number {
  if (stream.status !== StreamStatus.Active) return 0;
  return Math.max(0, stream.endTime - Math.floor(nowMs / 1000));
}

const USDC_UNIT = 10 ** USDC_DECIMALS;

export function usdcToNumber(amount: bigint): number {
  return Number(amount) / USDC_UNIT;
}

/** "1,234.56" — standard 2dp for USDC amounts. */
export function formatUsdc(amount: bigint, dp = 2): string {
  return usdcToNumber(amount).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** High-precision string for the live ticking balance, e.g. "847.234501". */
export function formatUsdcLive(amount: bigint): string {
  const whole = amount / BigInt(USDC_UNIT);
  const frac = (amount % BigInt(USDC_UNIT)).toString().padStart(USDC_DECIMALS, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

/** Parse a user-entered USDC amount ("2000" / "2000.50") into 6-decimal units. */
export function parseUsdc(input: string): bigint | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole) * BigInt(USDC_UNIT) + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

export function ratePerHour(stream: Stream): number {
  return usdcToNumber(stream.ratePerSecond * 3600n);
}

export function ratePerDay(stream: Stream): number {
  return usdcToNumber(stream.ratePerSecond * 86_400n);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "ended";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
