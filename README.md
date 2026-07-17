# FlowCast — Programmable USDC Payroll & Payment Streaming on Arc

> **Hackathon:** Arc Build Hackathon · Circle × Arc
> **Track:** DeFi (qualifies for Agentic Economy too if Circle wallet autonomy is emphasized)
> **Chain:** Arc L1 · USDC native gas token · Sub-500ms finality
> **Stack:** Solidity + TypeScript + Next.js 14 + Circle Programmable Wallets
> **Core Insight:** Businesses should be able to onboard their entire team or grantee pool, deposit USDC once, and have payments flow automatically to every person's wallet — with global bank offramp built in. No bots. No keeper networks. Pure pull-based streaming with a clean business dashboard.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [How It Works — Full Flow](#2-how-it-works--full-flow)
3. [System Architecture](#3-system-architecture)
4. [Smart Contracts](#4-smart-contracts)
5. [Circle Wallet Integration](#5-circle-wallet-integration)
6. [Verification System](#6-verification-system)
7. [Offramp System](#7-offramp-system)
8. [Frontend Pages & UI](#8-frontend-pages--ui)
9. [Backend & API Routes](#9-backend--api-routes)
10. [Database Schema](#10-database-schema)
11. [Build Order](#11-build-order)
12. [Environment Variables](#12-environment-variables)
13. [File Structure](#13-file-structure)
14. [Submission Checklist](#14-submission-checklist)

---

## 1. Product Vision

**FlowCast** is a B2B USDC payroll and payment streaming protocol built on Arc.

A business signs up, creates a workspace, and onboards their people (employees, contractors, grant recipients, vendors). Each person gets a Circle-managed USDC wallet created automatically on onboarding. The business deposits USDC into an escrow vault and sets up streams — specifying who gets paid, how much total, and over what period. The protocol handles the rest: USDC accrues per-second to each recipient's wallet. Recipients can withdraw their accrued balance anytime and offramp directly to their bank account anywhere in the world.

The business controls everything — pause a stream if someone leaves, cancel and reclaim unstreamed funds, adjust payment schedules. Recipients just watch their balance grow and cash out when ready.

### Why Arc Makes This Better Than Doing It on Ethereum

| Feature | Ethereum | Arc (FlowCast) |
|---|---|---|
| Gas token | ETH (volatile, recipients need it) | USDC (recipient's own earnings pay gas) |
| Settlement speed | 12–15 seconds | <500ms |
| Withdrawal cost | $2–15 per tx depending on gas | Fraction of a cent in USDC |
| Batch payroll cost | Very expensive | Near-zero |
| Offramp integration | Requires bridging first | Native USDC, offramp directly |

### Who Is This For

**Primary customer: Businesses paying people in USDC**
- Web3 startups paying remote contractors globally
- DAOs disbursing grants over a vesting period
- African SMBs with diaspora staff who want dollar-denominated pay
- Freelance platforms that hold payments in escrow until work is delivered
- Any company that today uses Deel/Remote but wants crypto-native payroll

---

## 2. How It Works — Full Flow

### Business Side

```
1. Business signs up → creates a workspace (company name, wallet, billing)
2. Business deposits USDC into their FlowCast vault
3. Business invites a recipient (email or phone number)
4. Recipient receives invite link
5. Recipient completes onboarding (see Recipient Side below)
6. Business creates a stream:
   - Select recipient
   - Set total amount (e.g. $2,000 USDC)
   - Set duration (e.g. 30 days)
   - Protocol calculates rate per second automatically
   - Confirm → USDC locked in escrow, stream starts immediately
7. Business dashboard shows:
   - All active streams with live burn rate
   - Total USDC streamed this month
   - Upcoming stream completions
   - Vault balance remaining
8. If needed: pause stream (halts accrual), cancel stream (unstreamed USDC returned)
```

### Recipient Side

```
1. Receives invite link from business (email or SMS)
2. Signs up with email or phone number
3. Circle wallet created automatically (no seed phrase, no crypto knowledge needed)
4. Completes verification:
   - Tier 1: Email/phone OTP (unlocks up to $1,000/month streaming)
   - Tier 2: Selfie / face match (unlocks up to $10,000/month)
   - Tier 3: Government ID upload (unlimited)
5. Wallet address confirmed → business is notified → stream can start
6. Recipient dashboard shows:
   - Live accrued balance (updates every second client-side)
   - Streaming rate (e.g. "$2.31 per hour")
   - Total received lifetime
   - Stream end date
7. Recipient hits "Withdraw" anytime:
   - Accrued USDC transferred from vault to their Circle wallet
   - Then hits "Cash Out" to offramp to bank account
   - Enters bank details (IBAN / account number / routing)
   - Circle converts and sends via wire/ACH/SWIFT
   - Confirmation + tracking shown
```

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│  Business Dashboard · Recipient Portal · Onboarding Flow   │
└───────────────────────┬────────────────────────────────────┘
                        │ REST API + Supabase Realtime
┌───────────────────────▼────────────────────────────────────┐
│                  Backend (Next.js API Routes)               │
│  Stream Manager · Wallet Provisioner · Offramp Controller  │
└──────┬──────────────────┬──────────────────┬───────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────────────┐
│  Supabase   │  │  Circle API     │  │  Arc Contracts      │
│  (Postgres  │  │  · Programmable │  │  · StreamVault.sol  │
│  + Realtime │  │    Wallets      │  │  · BatchStream.sol  │
│  + Storage) │  │  · USDC payouts │  │                     │
│             │  │  · Offramp      │  │                     │
└─────────────┘  └─────────────────┘  └────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| Database | Supabase (Postgres + Realtime + Storage) |
| Blockchain | Arc L1 — EVM-compatible, Solidity contracts |
| Wallets | Circle Programmable Wallets (per recipient) |
| Payments | USDC on Arc — native gas token |
| Offramp | Circle Payouts API (wire/ACH/SWIFT globally) |
| Verification | Persona or Jumio SDK (KYC/face match) |
| Email/SMS | Resend (email) + Twilio (SMS) |

---

## 4. Smart Contracts

### 4.1 StreamVault.sol

The core contract. Holds all business USDC deposits. Manages individual streams. Pull-based — recipients call withdraw() themselves, no automation needed.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract StreamVault is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────

    enum StreamStatus { Active, Paused, Cancelled, Completed }

    struct Stream {
        address business;       // Business wallet that funded the stream
        address recipient;      // Recipient's Circle wallet address
        uint256 deposit;        // Total USDC locked for this stream (6 decimals)
        uint256 ratePerSecond;  // USDC per second (6 decimals)
        uint40  startTime;
        uint40  endTime;
        uint256 withdrawn;      // Total USDC already withdrawn by recipient
        StreamStatus status;
        bool    cancelable;     // Business can cancel and reclaim unstreamed funds
    }

    // ─── State ────────────────────────────────────────────────────────────

    IERC20 public immutable USDC;

    uint256 public nextStreamId = 1;

    /// streamId → Stream
    mapping(uint256 => Stream) private _streams;

    /// business address → vault balance (deposited but not yet streamed)
    mapping(address => uint256) public vaultBalance;

    /// business address → stream IDs
    mapping(address => uint256[]) public businessStreams;

    /// recipient address → stream IDs
    mapping(address => uint256[]) public recipientStreams;

    /// Protocol fee in basis points (0 at launch, governance-controlled)
    uint16 public protocolFeeBps;

    /// Accumulated protocol fees
    uint256 public accruedProtocolFees;

    // ─── Events ──────────────────────────────────────────────────────────

    event Deposited(address indexed business, uint256 amount);
    event StreamCreated(
        uint256 indexed streamId,
        address indexed business,
        address indexed recipient,
        uint256 deposit,
        uint256 ratePerSecond,
        uint40 startTime,
        uint40 endTime
    );
    event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamPaused(uint256 indexed streamId);
    event StreamResumed(uint256 indexed streamId);
    event StreamCancelled(uint256 indexed streamId, uint256 businessRefund, uint256 recipientPayout);
    event StreamCompleted(uint256 indexed streamId);

    // ─── Errors ───────────────────────────────────────────────────────────

    error StreamNotFound(uint256 streamId);
    error NotStreamBusiness(uint256 streamId);
    error NotStreamRecipient(uint256 streamId);
    error StreamNotActive(uint256 streamId);
    error StreamNotPaused(uint256 streamId);
    error NothingToWithdraw(uint256 streamId);
    error StreamNotCancelable(uint256 streamId);
    error InsufficientVaultBalance(uint256 required, uint256 available);
    error InvalidTimeRange();
    error ZeroAmount();
    error ZeroAddress();

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _usdc, address _owner) Ownable(_owner) {
        USDC = IERC20(_usdc);
    }

    // ─── Business: Deposit ───────────────────────────────────────────────

    /**
     * @notice Business deposits USDC into their vault.
     * @dev Business must approve this contract before calling.
     *      Vault balance is tracked per business address.
     *      Multiple streams draw from the same vault balance.
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        vaultBalance[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    // ─── Business: Create Stream ─────────────────────────────────────────

    /**
     * @notice Create a USDC stream to a recipient.
     * @dev USDC is drawn from the business's vault balance.
     *      Rate is computed as: totalAmount / (endTime - startTime)
     *      Actual deposit = ratePerSecond * duration (dust returned to vault)
     *
     * @param recipient     Recipient's Circle wallet address
     * @param totalAmount   Total USDC to stream
     * @param endTime       Unix timestamp when stream fully vests
     * @param cancelable    Whether business can cancel and reclaim
     * @return streamId
     *
     * @example
     * // Stream $2000 USDC to Alice over 30 days
     * vault.createStream(
     *   aliceWallet,
     *   2_000_000_000, // $2000 in 6-decimal USDC
     *   block.timestamp + 30 days,
     *   true
     * );
     */
    function createStream(
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) external nonReentrant whenNotPaused returns (uint256 streamId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        if (endTime <= block.timestamp) revert InvalidTimeRange();
        if (vaultBalance[msg.sender] < totalAmount)
            revert InsufficientVaultBalance(totalAmount, vaultBalance[msg.sender]);

        uint40 startTime = uint40(block.timestamp);
        uint256 duration = endTime - startTime;

        // Apply protocol fee
        uint256 fee = 0;
        if (protocolFeeBps > 0) {
            fee = (totalAmount * protocolFeeBps) / 10_000;
            accruedProtocolFees += fee;
        }

        uint256 deposit = totalAmount - fee;
        uint256 ratePerSecond = deposit / duration;
        uint256 actualDeposit = ratePerSecond * duration;

        // Return dust to vault balance
        uint256 dust = deposit - actualDeposit;
        vaultBalance[msg.sender] -= totalAmount;
        if (dust > 0) vaultBalance[msg.sender] += dust;

        streamId = nextStreamId++;
        _streams[streamId] = Stream({
            business: msg.sender,
            recipient: recipient,
            deposit: actualDeposit,
            ratePerSecond: ratePerSecond,
            startTime: startTime,
            endTime: endTime,
            withdrawn: 0,
            status: StreamStatus.Active,
            cancelable: cancelable
        });

        businessStreams[msg.sender].push(streamId);
        recipientStreams[recipient].push(streamId);

        emit StreamCreated(streamId, msg.sender, recipient, actualDeposit, ratePerSecond, startTime, endTime);
    }

    // ─── Recipient: Withdraw ─────────────────────────────────────────────

    /**
     * @notice Recipient withdraws all accrued USDC.
     * @dev Only callable by the stream recipient.
     *      On Arc: USDC received can pay for future gas — no ETH needed.
     */
    function withdraw(uint256 streamId) external nonReentrant returns (uint256 amount) {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.recipient != msg.sender) revert NotStreamRecipient(streamId);
        if (stream.status != StreamStatus.Active) revert StreamNotActive(streamId);

        amount = _accruedBalance(stream);
        if (amount == 0) revert NothingToWithdraw(streamId);

        stream.withdrawn += amount;

        if (stream.withdrawn >= stream.deposit) {
            stream.status = StreamStatus.Completed;
            emit StreamCompleted(streamId);
        }

        USDC.safeTransfer(msg.sender, amount);
        emit Withdrawn(streamId, msg.sender, amount);
    }

    // ─── Business: Pause / Resume / Cancel ───────────────────────────────

    /**
     * @notice Pause a stream — halts accrual. Business only.
     * @dev Use case: employee on leave, disputed payment, HR hold.
     */
    function pauseStream(uint256 streamId) external {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (stream.status != StreamStatus.Active) revert StreamNotActive(streamId);

        stream.status = StreamStatus.Paused;
        emit StreamPaused(streamId);
    }

    /**
     * @notice Resume a paused stream. Business only.
     * @dev Extends endTime by the paused duration so recipient receives full amount.
     */
    function resumeStream(uint256 streamId) external {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (stream.status != StreamStatus.Paused) revert StreamNotPaused(streamId);

        uint256 remaining = stream.deposit - stream.withdrawn;
        uint256 newDuration = remaining / stream.ratePerSecond;

        stream.startTime = uint40(block.timestamp);
        stream.endTime = uint40(block.timestamp + newDuration);
        stream.status = StreamStatus.Active;

        emit StreamResumed(streamId);
    }

    /**
     * @notice Cancel a stream. Business only. Stream must be cancelable.
     * @dev Accrued-but-unwithdrawn USDC goes to recipient.
     *      Unstreamed USDC returns to business vault balance.
     */
    function cancelStream(uint256 streamId) external nonReentrant {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (!stream.cancelable) revert StreamNotCancelable(streamId);
        if (stream.status != StreamStatus.Active && stream.status != StreamStatus.Paused)
            revert StreamNotActive(streamId);

        uint256 recipientOwed = _accruedBalance(stream);
        uint256 businessRefund = stream.deposit - stream.withdrawn - recipientOwed;

        stream.status = StreamStatus.Cancelled;

        if (recipientOwed > 0) USDC.safeTransfer(stream.recipient, recipientOwed);
        if (businessRefund > 0) vaultBalance[msg.sender] += businessRefund;

        emit StreamCancelled(streamId, businessRefund, recipientOwed);
    }

    // ─── Business: Withdraw Vault Balance ────────────────────────────────

    /**
     * @notice Business withdraws their uninvested vault balance.
     */
    function withdrawVault(uint256 amount) external nonReentrant {
        if (amount > vaultBalance[msg.sender])
            revert InsufficientVaultBalance(amount, vaultBalance[msg.sender]);
        vaultBalance[msg.sender] -= amount;
        USDC.safeTransfer(msg.sender, amount);
    }

    // ─── View Functions ───────────────────────────────────────────────────

    function getStream(uint256 streamId) external view returns (Stream memory) {
        if (_streams[streamId].business == address(0)) revert StreamNotFound(streamId);
        return _streams[streamId];
    }

    function accruedBalance(uint256 streamId) external view returns (uint256) {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) return 0;
        if (stream.status != StreamStatus.Active) return 0;
        return _accruedBalance(stream);
    }

    function getBusinessStreams(address business) external view returns (uint256[] memory) {
        return businessStreams[business];
    }

    function getRecipientStreams(address recipient) external view returns (uint256[] memory) {
        return recipientStreams[recipient];
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    function _accruedBalance(Stream storage stream) internal view returns (uint256) {
        if (block.timestamp <= stream.startTime) return 0;

        uint256 effectiveTime = block.timestamp >= stream.endTime
            ? stream.endTime
            : block.timestamp;

        uint256 elapsed = effectiveTime - stream.startTime;
        uint256 totalVested = elapsed * stream.ratePerSecond;
        if (totalVested > stream.deposit) totalVested = stream.deposit;

        return totalVested > stream.withdrawn ? totalVested - stream.withdrawn : 0;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function setProtocolFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 100, "Max 1%");
        protocolFeeBps = feeBps;
    }

    function claimProtocolFees() external onlyOwner {
        uint256 amount = accruedProtocolFees;
        accruedProtocolFees = 0;
        USDC.safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

---

### 4.2 BatchStream.sol

Allows a business to create multiple streams in a single transaction — one payroll run for the whole team.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IStreamVault } from "./interfaces/IStreamVault.sol";

contract BatchStream {
    IStreamVault public immutable vault;

    event BatchCreated(uint256[] streamIds, address indexed business);

    struct BatchEntry {
        address recipient;
        uint256 totalAmount;
        uint40  endTime;
        bool    cancelable;
    }

    constructor(address _vault) {
        vault = IStreamVault(_vault);
    }

    /**
     * @notice Create multiple streams in one transaction.
     * @dev Business vault balance must cover total of all amounts.
     *      StreamVault.deposit() must be called separately before this.
     *
     * @example — Payroll for 4 people
     * batchStream.createBatch([
     *   { recipient: alice, totalAmount: 2000e6, endTime: t+30days, cancelable: true },
     *   { recipient: bob,   totalAmount: 1500e6, endTime: t+30days, cancelable: true },
     *   { recipient: carol, totalAmount: 3000e6, endTime: t+30days, cancelable: true },
     *   { recipient: dave,  totalAmount: 1000e6, endTime: t+30days, cancelable: false },
     * ]);
     */
    function createBatch(BatchEntry[] calldata entries) external returns (uint256[] memory streamIds) {
        streamIds = new uint256[](entries.length);
        for (uint256 i = 0; i < entries.length; i++) {
            streamIds[i] = vault.createStream(
                entries[i].recipient,
                entries[i].totalAmount,
                entries[i].endTime,
                entries[i].cancelable
            );
        }
        emit BatchCreated(streamIds, msg.sender);
    }
}
```

---

## 5. Circle Wallet Integration

### Per-Recipient Wallet Creation

Every recipient gets a Circle Programmable Wallet created at the moment they complete onboarding. No seed phrase. No MetaMask. Circle manages the key infrastructure.

```typescript
// src/lib/circle/wallets.ts
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

const circle = initiateUserControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
});

/**
 * Create a Circle wallet for a new recipient.
 * Called automatically during recipient onboarding completion.
 *
 * @param recipientId  Internal Supabase user ID (used as Circle userId)
 * @returns            Arc wallet address for this recipient
 */
export async function createRecipientWallet(recipientId: string): Promise<{
  walletId: string;
  walletAddress: string;
}> {
  // Create Circle user entity
  await circle.createUser({ userId: recipientId });

  // Create wallet on Arc network
  const { data } = await circle.createUserWallet({
    userId: recipientId,
    blockchains: ["ARC-TESTNET"], // switch to ARC for mainnet
  });

  const wallet = data.wallets[0];
  return {
    walletId: wallet.id,
    walletAddress: wallet.address,
  };
}

/**
 * Get USDC balance of a recipient's Circle wallet.
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const { data } = await circle.getWalletTokenBalance({
    id: walletId,
    tokenAddress: process.env.ARC_USDC_ADDRESS!,
  });
  return parseFloat(data.tokenBalances[0]?.amount ?? "0");
}

/**
 * Get wallet address for a Circle user.
 */
export async function getWalletAddress(userId: string): Promise<string> {
  const { data } = await circle.listWallets({ userId });
  return data.wallets[0].address;
}
```

### Business Vault Deposit Flow

```typescript
// src/lib/circle/deposit.ts

/**
 * Business deposits USDC into their FlowCast vault.
 *
 * Flow:
 * 1. Business connects their wallet (MetaMask or Circle wallet)
 * 2. Frontend calls approve() on USDC contract
 * 3. Frontend calls deposit() on StreamVault contract
 * 4. Backend records deposit in Supabase
 */
export async function depositToVault(
  businessWallet: WalletClient,
  amount: bigint // USDC in 6 decimals
): Promise<Hash> {
  // Step 1: Approve StreamVault to spend USDC
  const approveTx = await businessWallet.writeContract({
    address: ARC_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [STREAM_VAULT_ADDRESS, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Step 2: Deposit into vault
  const depositTx = await businessWallet.writeContract({
    address: STREAM_VAULT_ADDRESS,
    abi: STREAM_VAULT_ABI,
    functionName: "deposit",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });

  return depositTx;
}
```

---

## 6. Verification System

Recipients complete verification in tiers. Higher tiers unlock higher streaming limits. Verification is handled by Persona (or Jumio) SDK embedded in the recipient onboarding flow.

### Verification Tiers

| Tier | Method | Monthly Limit | Unlocks After |
|------|--------|--------------|---------------|
| **Tier 0** | None | $0 | — |
| **Tier 1** | Email + phone OTP | $1,000/month | ~2 minutes |
| **Tier 2** | Selfie / face match (liveness check) | $10,000/month | ~5 minutes |
| **Tier 3** | Government ID + face match | Unlimited | ~10 minutes |

### Verification Flow

```typescript
// src/lib/verification/index.ts

export type VerificationTier = 0 | 1 | 2 | 3;

export interface VerificationStatus {
  tier: VerificationTier;
  emailVerified: boolean;
  phoneVerified: boolean;
  faceVerified: boolean;
  idVerified: boolean;
  monthlyLimit: number; // USDC
}

/**
 * Calculate monthly streaming limit based on verification tier.
 */
export function getMonthlyLimit(tier: VerificationTier): number {
  const limits: Record<VerificationTier, number> = {
    0: 0,
    1: 1_000,
    2: 10_000,
    3: Infinity,
  };
  return limits[tier];
}

/**
 * Check if a stream amount is within the recipient's verified limit.
 */
export function isStreamAllowed(
  totalAmount: number,
  durationDays: number,
  tier: VerificationTier
): boolean {
  const monthlyRate = (totalAmount / durationDays) * 30;
  return monthlyRate <= getMonthlyLimit(tier);
}
```

### Onboarding Steps (Frontend)

```
Step 1: Enter email or phone number
        → OTP sent → verified → Tier 1 unlocked

Step 2: Circle wallet created automatically
        → walletAddress stored in Supabase

Step 3 (optional): Selfie verification
        → Persona SDK liveness check
        → Tier 2 unlocked

Step 4 (optional): Government ID
        → Persona SDK document scan
        → Tier 3 unlocked

Step 5: Business notified → stream can be created
```

---

## 7. Offramp System

Recipients withdraw accrued USDC from the stream to their Circle wallet, then cash out to their global bank account.

### Two-Step Process

```
Step 1: WITHDRAW from stream
  → Recipient calls withdraw() on StreamVault contract
  → Accrued USDC lands in their Circle wallet
  → Balance shown in recipient dashboard

Step 2: CASH OUT to bank
  → Recipient clicks "Cash Out"
  → Enters bank details (once, saved for future)
  → Selects amount
  → Circle Payouts API processes transfer
  → USDC converted to local currency
  → Wire/ACH/SWIFT sent to recipient's bank
  → Confirmation + tracking number shown
```

### Circle Payouts Integration

```typescript
// src/lib/circle/offramp.ts
import { createBusinessAccountClient } from "@circle-fin/business-account";

const circlePayouts = createBusinessAccountClient({
  apiKey: process.env.CIRCLE_API_KEY!,
});

export interface BankDetails {
  accountNumber: string;
  routingNumber?: string;   // US ACH
  iban?: string;            // International
  swiftCode?: string;       // International wire
  bankName: string;
  accountHolderName: string;
  country: string;
  currency: string;         // Target currency e.g. "NGN", "GBP", "EUR"
}

/**
 * Create a bank wire payout from recipient's Circle wallet.
 *
 * @param recipientId   Internal user ID
 * @param amountUsdc    Amount in USDC (6 decimals)
 * @param bankDetails   Recipient's bank account
 */
export async function createPayout(
  recipientId: string,
  amountUsdc: string,
  bankDetails: BankDetails
): Promise<{ payoutId: string; trackingRef: string }> {
  // Step 1: Create wire bank account in Circle
  const { data: bankData } = await circlePayouts.createWireBankAccount({
    accountNumber: bankDetails.accountNumber,
    routingNumber: bankDetails.routingNumber,
    iban: bankDetails.iban,
    billingDetails: {
      name: bankDetails.accountHolderName,
      country: bankDetails.country,
    },
    bankAddress: {
      bankName: bankDetails.bankName,
      country: bankDetails.country,
    },
  });

  // Step 2: Create payout
  const { data: payoutData } = await circlePayouts.createPayout({
    idempotencyKey: `${recipientId}-${Date.now()}`,
    destination: {
      type: "wire",
      id: bankData.id,
    },
    amount: {
      amount: amountUsdc,
      currency: "USD",
    },
    metadata: {
      beneficiaryEmail: "", // recipient email
    },
  });

  return {
    payoutId: payoutData.id,
    trackingRef: payoutData.trackingRef ?? "",
  };
}

/**
 * Get payout status.
 */
export async function getPayoutStatus(payoutId: string) {
  const { data } = await circlePayouts.getPayout({ id: payoutId });
  return data.status; // "pending" | "complete" | "failed"
}
```

### Supported Countries (via Circle Payouts)

Circle Payouts supports wire transfers to 180+ countries. Key markets:
- **Nigeria** → NGN bank transfer
- **Ghana** → GHS bank transfer
- **Kenya** → KES bank transfer / M-Pesa
- **United Kingdom** → GBP / Faster Payments
- **Europe** → EUR / SEPA
- **United States** → USD / ACH

---

## 8. Frontend Pages & UI

### Pages

| Route | Who Sees It | Description |
|-------|-------------|-------------|
| `/` | Public | Landing page — product pitch, how it works |
| `/signup` | Public | Business or recipient signup choice |
| `/business/onboard` | Business | Company setup wizard |
| `/business/dashboard` | Business | Main dashboard — vault, streams, team |
| `/business/team` | Business | Manage recipients, invite new |
| `/business/streams/create` | Business | Create single stream |
| `/business/streams/batch` | Business | Batch payroll run |
| `/business/streams/[id]` | Business | Single stream detail + controls |
| `/business/vault` | Business | Vault balance, deposit, withdraw |
| `/recipient/onboard` | Recipient | Onboarding wizard (invite flow) |
| `/recipient/dashboard` | Recipient | Live balance, withdraw, cash out |
| `/recipient/cashout` | Recipient | Bank details + offramp flow |
| `/recipient/history` | Recipient | Payment history |

---

### Business Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  FlowCast    [Company Name]          [Deposit USDC] [Settings]│
├──────────┬──────────────────────────────────────────────────┤
│          │                                                    │
│ Dashboard│  Vault Balance                                     │
│ Team     │  ┌────────────────────────────────────────────┐   │
│ Streams  │  │  $24,500.00 USDC available                 │   │
│ Vault    │  │  Streaming: $8,200/month to 6 people       │   │
│ Settings │  │  [Deposit More]  [Withdraw Unused]         │   │
│          │  └────────────────────────────────────────────┘   │
│          │                                                    │
│          │  Active Streams                    [+ New Stream]  │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Alice Chen      $2,000/mo  ████████░░ 67%    │ │
│          │  │ $1,340 streamed · $660 remaining · 10d left  │ │
│          │  │ [Pause] [Cancel]                             │ │
│          │  ├──────────────────────────────────────────────┤ │
│          │  │ Bob Mensah      $1,500/mo  ████░░░░░░ 40%    │ │
│          │  │ $600 streamed · $900 remaining · 18d left    │ │
│          │  │ [Pause] [Cancel]                             │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

---

### Recipient Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  FlowCast    Hi Alice 👋                        [Settings]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Your Balance                                               │
│   ┌────────────────────────────────────────────────────┐    │
│   │                                                    │    │
│   │   $847.23  USDC                                   │    │
│   │   Available to withdraw                            │    │
│   │                                                    │    │
│   │   Earning $0.77 / hour  ·  $18.52 / day           │    │
│   │                                                    │    │
│   │   [Withdraw to Wallet]   [Cash Out to Bank]        │    │
│   │                                                    │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   Stream from Acme Corp                                      │
│   ┌────────────────────────────────────────────────────┐    │
│   │  Total: $2,000 USDC over 30 days                  │    │
│   │  Progress: ████████░░░░  67%  · 10 days left      │    │
│   │  Started: Jun 1 · Ends: Jul 1                     │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   Recent Activity                                            │
│   Jun 15  Withdrawn $200.00 USDC                            │
│   Jun 10  Withdrawn $150.00 USDC                            │
│   Jun 01  Stream started from Acme Corp                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Create Stream Form

```
Create Payment Stream
─────────────────────────────────────────

Recipient
[ Select from your team ▼ ]
  Alice Chen · alice@email.com · Tier 2 verified ✓

Total Amount
[ 2,000 ] USDC

Duration
[ 30 ] days   (or set end date: [ Jul 15, 2026 ])

Payment Rate (calculated)
$66.67 / day  ·  $2.78 / hour  ·  $0.00077 / second

Stream Type
○ Cancelable   (you can cancel and reclaim unstreamed funds)
● Fixed        (recipient is guaranteed the full amount)

Vault Balance After
$24,500 → $22,500 remaining

─────────────────────────────────────────
  [Cancel]              [Create Stream →]
```

---

### Offramp / Cash Out Flow

```
Cash Out to Bank
─────────────────────────────────────────

Amount to cash out
[ 500.00 ] USDC  (available: $847.23)

Your bank account
○ First Bank Nigeria — **** 4521 (saved)
● Add new bank account

Bank country:    [ Nigeria ▼ ]
Bank name:       [ First Bank Nigeria ]
Account number:  [ _________________ ]
Account name:    [ _________________ ]

Estimated receipt
$500.00 USDC → ~₦780,000 NGN
Exchange rate: 1 USDC ≈ ₦1,560
Transfer fee: $2.00 USDC
Arrival: 1–3 business days

[ Save bank & Cash Out → ]
```

---

### Design System

- **Theme:** Light mode with strong financial credibility aesthetic
- **Primary:** `#0F4C81` (deep trust blue — Circle's color family)
- **Accent:** `#00C896` (USDC green — live balance, earnings)
- **Background:** `#F8FAFC`
- **Surface:** `#FFFFFF`
- **Text:** `#0F172A`
- **Success:** `#10B981` · **Warning:** `#F59E0B` · **Error:** `#EF4444`
- **Font:** `Inter` for all UI · `JetBrains Mono` for USDC amounts only
- **Stream progress bar:** Animated gradient fill (green → blue)
- **Live balance counter:** Increments client-side every second (no RPC calls)

---

## 9. Backend & API Routes

```
POST /api/business/onboard
  body: { companyName, email, walletAddress }
  → Creates business record in Supabase

POST /api/recipients/invite
  body: { email?, phone?, businessId }
  → Creates pending recipient, sends invite email/SMS via Resend/Twilio

POST /api/recipients/onboard
  body: { inviteToken, email?, phone? }
  → Validates invite, creates Circle wallet, returns walletAddress

POST /api/recipients/verify/otp
  body: { recipientId, otp }
  → Validates OTP, upgrades to Tier 1

POST /api/recipients/verify/face
  body: { recipientId, personaSessionToken }
  → Validates Persona result, upgrades to Tier 2

POST /api/recipients/verify/id
  body: { recipientId, personaSessionToken }
  → Validates Persona result, upgrades to Tier 3

GET  /api/business/[id]/vault
  → Returns vault balance on-chain + deposit history

POST /api/streams/create
  body: { businessId, recipientId, totalAmount, endTime, cancelable }
  → Validates, calls createStream on contract, saves to Supabase

POST /api/streams/batch
  body: { businessId, entries: [{recipientId, totalAmount, endTime}] }
  → Batch stream creation

POST /api/streams/[id]/pause
  → Calls pauseStream on contract, updates Supabase

POST /api/streams/[id]/resume
  → Calls resumeStream on contract, updates Supabase

POST /api/streams/[id]/cancel
  → Calls cancelStream on contract, updates Supabase

GET  /api/streams/[id]
  → Stream detail with live accrued balance

GET  /api/recipient/[id]/streams
  → All streams for a recipient with live balances

POST /api/recipient/withdraw
  body: { recipientId, streamId }
  → Calls withdraw() on contract on behalf of recipient

POST /api/recipient/cashout
  body: { recipientId, amount, bankDetails }
  → Calls Circle Payouts API, creates payout record

GET  /api/recipient/cashout/[payoutId]/status
  → Polls Circle for payout status

GET  /api/business/[id]/streams
  → All streams for a business with live data
```

---

## 10. Database Schema

```sql
-- Supabase Postgres

-- Businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  wallet_address text,           -- Business's own wallet (for vault deposits)
  vault_balance numeric(20,6) default 0,
  created_at timestamptz default now()
);

-- Recipients (employees, contractors, grantees)
create table recipients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) not null,
  email text,
  phone text,
  full_name text,
  circle_wallet_id text unique,  -- Circle internal wallet ID
  wallet_address text unique,    -- Arc wallet address (from Circle)
  verification_tier integer default 0 check (verification_tier in (0,1,2,3)),
  email_verified boolean default false,
  phone_verified boolean default false,
  face_verified boolean default false,
  id_verified boolean default false,
  status text default 'pending' check (status in ('pending','active','suspended')),
  invite_token text unique,      -- Used for onboarding link
  invited_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- Streams
create table streams (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) not null,
  recipient_id uuid references recipients(id) not null,
  contract_stream_id bigint unique,  -- On-chain stream ID from StreamVault
  total_amount numeric(20,6) not null,
  rate_per_second numeric(20,10) not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  withdrawn numeric(20,6) default 0,
  status text default 'active'
    check (status in ('active','paused','cancelled','completed')),
  cancelable boolean default true,
  paused_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Withdrawals (recipient pulls from stream to Circle wallet)
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid references streams(id) not null,
  recipient_id uuid references recipients(id) not null,
  amount numeric(20,6) not null,
  tx_hash text,                  -- Arc transaction hash
  created_at timestamptz default now()
);

-- Payouts (Circle offramp — Circle wallet to bank)
create table payouts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references recipients(id) not null,
  amount_usdc numeric(20,6) not null,
  target_currency text not null, -- e.g. "NGN", "GBP"
  bank_name text,
  account_last4 text,
  circle_payout_id text unique,
  status text default 'pending'
    check (status in ('pending','processing','complete','failed')),
  tracking_ref text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Deposits (business depositing USDC into vault)
create table deposits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) not null,
  amount numeric(20,6) not null,
  tx_hash text,
  created_at timestamptz default now()
);

-- Bank accounts (saved by recipients for offramp)
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references recipients(id) not null,
  bank_name text not null,
  account_number_encrypted text not null, -- AES-256 encrypted
  account_holder_name text not null,
  country text not null,
  currency text not null,
  routing_number text,
  iban text,
  swift_code text,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index on streams(business_id);
create index on streams(recipient_id);
create index on streams(status);
create index on recipients(business_id);
create index on recipients(invite_token);
create index on withdrawals(stream_id);
create index on payouts(recipient_id);

-- Realtime: live balance updates in recipient dashboard
alter publication supabase_realtime add table withdrawals;
alter publication supabase_realtime add table streams;
alter publication supabase_realtime add table payouts;
```

---

## 11. Build Order

### Phase 1: Foundation (Day 1–2)
- [ ] Next.js 14 scaffold + Tailwind + shadcn/ui
- [ ] Supabase project + run schema migration
- [ ] Arc testnet connection + Hardhat config
- [ ] Deploy StreamVault.sol to Arc testnet
- [ ] Deploy BatchStream.sol to Arc testnet
- [ ] Circle API credentials + test wallet creation

### Phase 2: Business Onboarding (Day 3)
- [ ] `/signup` → business signup form
- [ ] `/business/onboard` → workspace setup
- [ ] Business record created in Supabase
- [ ] Vault deposit flow (approve + deposit on-chain)
- [ ] `/business/vault` — vault balance display

### Phase 3: Recipient Onboarding (Day 4–5)
- [ ] `POST /api/recipients/invite` — generates invite token, sends email via Resend
- [ ] `/recipient/onboard?token=xxx` — recipient landing page
- [ ] Email/phone OTP → Tier 1 verification
- [ ] Circle wallet created on Tier 1 completion
- [ ] Wallet address stored in Supabase + business notified
- [ ] Persona SDK integrated for Tier 2 face check

### Phase 4: Stream Creation (Day 6–7)
- [ ] `/business/team` — list of onboarded recipients
- [ ] `/business/streams/create` — stream creation form
- [ ] `POST /api/streams/create` — on-chain + Supabase
- [ ] Batch stream creation (`/business/streams/batch`)
- [ ] Stream status display on business dashboard

### Phase 5: Recipient Dashboard + Withdraw (Day 8–9)
- [ ] `/recipient/dashboard` — live accruing balance
- [ ] Client-side balance counter (increments per second from ratePerSecond)
- [ ] Supabase Realtime subscription for stream state changes
- [ ] `POST /api/recipient/withdraw` — calls withdraw() on contract
- [ ] Withdrawal history shown in dashboard

### Phase 6: Offramp (Day 10–11)
- [ ] `/recipient/cashout` — bank details form
- [ ] Bank account saved (encrypted) in Supabase
- [ ] `POST /api/recipient/cashout` — Circle Payouts API
- [ ] Payout status polling (`/api/recipient/cashout/[id]/status`)
- [ ] Payout confirmation + tracking shown

### Phase 7: Business Stream Controls (Day 12)
- [ ] Pause stream — on-chain + Supabase
- [ ] Resume stream — on-chain + Supabase
- [ ] Cancel stream — on-chain, refund to vault balance, Supabase
- [ ] Business dashboard shows live burn rate + remaining vault

### Phase 8: Polish + Demo Prep (Day 13–14)
- [ ] Seed: 2 demo businesses, 6 demo recipients, 8 active streams
- [ ] Government ID verification (Tier 3) — Persona
- [ ] Deploy to Vercel
- [ ] Record 3-minute Loom demo
- [ ] Deck (problem → solution → Arc advantage → traction → ask)
- [ ] Submit by August 9

---

## 12. Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Arc / Blockchain
ARC_RPC_URL=
ARC_CHAIN_ID=
ARC_USDC_ADDRESS=
DEPLOYER_PRIVATE_KEY=
NEXT_PUBLIC_STREAM_VAULT_ADDRESS=
NEXT_PUBLIC_BATCH_STREAM_ADDRESS=

# Circle
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=

# Persona (KYC)
PERSONA_API_KEY=
NEXT_PUBLIC_PERSONA_TEMPLATE_ID_FACE=
NEXT_PUBLIC_PERSONA_TEMPLATE_ID_ID=

# Communication
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Encryption (bank account numbers)
ENCRYPTION_KEY=           # 32-byte hex key for AES-256

# App
NEXT_PUBLIC_APP_URL=
PLATFORM_WALLET_ADDRESS=  # receives protocol fees
```

---

## 13. File Structure

```
flowcast/
├── contracts/
│   ├── src/
│   │   ├── StreamVault.sol
│   │   ├── BatchStream.sol
│   │   └── interfaces/
│   │       └── IStreamVault.sol
│   ├── test/
│   │   ├── StreamVault.t.sol
│   │   └── BatchStream.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
│
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Landing page
│   │   ├── signup/page.tsx
│   │   ├── business/
│   │   │   ├── onboard/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   ├── vault/page.tsx
│   │   │   └── streams/
│   │   │       ├── create/page.tsx
│   │   │       ├── batch/page.tsx
│   │   │       └── [id]/page.tsx
│   │   ├── recipient/
│   │   │   ├── onboard/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── cashout/page.tsx
│   │   │   └── history/page.tsx
│   │   └── api/
│   │       ├── business/
│   │       │   ├── onboard/route.ts
│   │       │   └── [id]/vault/route.ts
│   │       ├── recipients/
│   │       │   ├── invite/route.ts
│   │       │   ├── onboard/route.ts
│   │       │   └── verify/
│   │       │       ├── otp/route.ts
│   │       │       ├── face/route.ts
│   │       │       └── id/route.ts
│   │       ├── streams/
│   │       │   ├── create/route.ts
│   │       │   ├── batch/route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── pause/route.ts
│   │       │       ├── resume/route.ts
│   │       │       └── cancel/route.ts
│   │       └── recipient/
│   │           ├── withdraw/route.ts
│   │           └── cashout/
│   │               ├── route.ts
│   │               └── [payoutId]/status/route.ts
│   │
│   ├── lib/
│   │   ├── circle/
│   │   │   ├── wallets.ts
│   │   │   ├── deposit.ts
│   │   │   └── offramp.ts
│   │   ├── contracts/
│   │   │   ├── stream-vault.ts
│   │   │   ├── batch-stream.ts
│   │   │   └── abis/
│   │   ├── verification/
│   │   │   └── index.ts
│   │   ├── notifications/
│   │   │   ├── email.ts       # Resend
│   │   │   └── sms.ts         # Twilio
│   │   ├── crypto.ts          # Bank account encryption
│   │   ├── supabase.ts
│   │   └── stream-math.ts     # Client-side accrual calc
│   │
│   └── components/
│       ├── business/
│       │   ├── StreamCard.tsx
│       │   ├── VaultBalance.tsx
│       │   ├── CreateStreamForm.tsx
│       │   ├── BatchPayrollForm.tsx
│       │   └── TeamTable.tsx
│       ├── recipient/
│       │   ├── LiveBalance.tsx      # Increments per second
│       │   ├── StreamProgress.tsx
│       │   ├── WithdrawButton.tsx
│       │   └── CashOutForm.tsx
│       ├── onboarding/
│       │   ├── BusinessOnboard.tsx
│       │   ├── RecipientOnboard.tsx
│       │   ├── OTPVerify.tsx
│       │   └── PersonaEmbed.tsx
│       └── ui/                      # shadcn components
│
├── package.json
├── hardhat.config.ts
└── .env.local
```

---

## 14. Submission Checklist

- [ ] Public GitHub repo with clean README
- [ ] Contracts deployed and verified on Arc testnet
- [ ] Live Vercel deployment
- [ ] Demo: business onboards 3 recipients, creates streams, recipient withdraws, offramps to bank
- [ ] At least $100 in real USDC streamed on testnet
- [ ] 3-minute Loom video covering: business onboard → invite recipient → stream created → live balance → withdraw → cash out
- [ ] Deck: problem (paying people globally is broken) → solution (FlowCast) → Arc advantage (USDC gas, speed, cost) → traction → team
- [ ] Checkpoint 1 submitted by July 19
- [ ] Checkpoint 2 submitted by July 26
- [ ] Final submitted by August 9

---

*FlowCast · Built on Arc · Settled in USDC · Payments that flow*
