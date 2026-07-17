# Arc Network Reference — FlowCast

Distilled from [docs.arc.io](https://docs.arc.io/integrate) (fetched 2026-07-17). Everything here is **Arc Testnet** — mainnet addresses are not published yet.

---

## 1. Network Configuration

| Parameter | Value |
|---|---|
| Network name | Arc Testnet |
| Chain ID | `5042002` |
| Native gas token | USDC (18 decimals at the native layer) |
| Block explorer | https://testnet.arcscan.app (Blockscout) |
| Faucet | https://faucet.circle.com (select Arc Testnet → dispenses testnet USDC) |
| Block time | ~0.5s · deterministic finality on inclusion (single confirmation is final, no reorgs) |

### RPC Endpoints

| Provider | HTTPS | WebSocket |
|---|---|---|
| Primary | `https://rpc.testnet.arc.network` | `wss://rpc.testnet.arc.network` |
| Blockdaemon | `https://rpc.blockdaemon.testnet.arc.network` | `wss://rpc.blockdaemon.testnet.arc.network:443/websocket` |
| dRPC | `https://rpc.drpc.testnet.arc.network` | `wss://rpc.drpc.testnet.arc.network` |
| QuickNode | `https://rpc.quicknode.testnet.arc.network` | `wss://rpc.quicknode.testnet.arc.network` |

### viem / wagmi

`arcTestnet` is a **built-in chain definition** in viem — no manual chain object needed:

```typescript
import { arcTestnet } from "viem/chains";
import { createPublicClient, http } from "viem";

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});
```

### `.env.local` values this gives us

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

---

## 2. USDC: The Dual-Decimals Trap ⚠️

**Native USDC and ERC-20 USDC are the SAME asset with two interfaces:**

- **Native interface** — 18 decimals. Used for gas, `msg.value`, plain native sends.
- **ERC-20 interface** — 6 decimals. Used for `transfer` / `transferFrom` / `approve` / `balanceOf`.

Implications for FlowCast:

- `StreamVault` interacts with USDC **only via the ERC-20 interface at `0x3600...0000`**, so all our contract math stays in 6 decimals — matches the README design (e.g. `$2,000 = 2_000_000_000`).
- `balanceOf()` truncates to 6 decimals: dust below `0.000001` USDC exists in the native balance but reads as `0` via ERC-20. Irrelevant at our amounts, but don't be surprised by it.
- **EIP-7708:** every *native* USDC movement (gas payments, native sends) also emits an ERC-20 `Transfer` event — but from a **system address and in 18 decimals**. When indexing `Transfer` logs for deposit/withdraw history, **filter by emitter = the USDC contract address** to only get real 6-decimal ERC-20 transfers.
- Recipients pay gas from their own USDC earnings — no second token to fund. This is the core demo pitch.

---

## 3. Contract Addresses (Arc Testnet)

### The ones FlowCast needs

| Contract | Address | Notes |
|---|---|---|
| **USDC** | `0x3600000000000000000000000000000000000000` | ERC-20 interface, 6 decimals |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch RPC reads (dashboard stream data) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Optional: gasless approvals for vault deposit |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | Standard deterministic deployer |

### Other system contracts (reference only)

| Contract | Address |
|---|---|
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| CCTP TokenMessengerV2 (Domain 26) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Memo (tx extension) | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |

---

## 4. Gas & Fees

- **EIP-1559 with EWMA smoothing** — base fee is a moving average of block utilization, so costs are stable. Target: **~$0.01 per transaction**.
- **Base fee is paid to the block beneficiary, not burned.**
- Testnet floor: **20 Gwei minimum base fee** (hard ceiling 20,000 Gwei). 30M gas/block.
- Rules for our txs:
  - Set `maxFeePerGas` ≥ **20 Gwei**.
  - `maxPriorityFeePerGas` of 0 is fine; **1 Gwei** improves inclusion under load.
  - Estimate via `eth_gasPrice` (quick) or `eth_feeHistory` (precise).
- **UI guideline from Circle:** display fees in **dollar terms**, not Gwei — fits our audience anyway.

---

## 5. EVM Differences That Affect Us

Arc is EVM-compatible (Ethereum bytecode + RPC). CREATE2, EIP-7702, and block-hash history behave exactly like Ethereum. Solidity `^0.8.24` and OpenZeppelin work as-is. Differences:

| Difference | Impact on FlowCast |
|---|---|
| `PREVRANDAO` always returns `0` | None — we don't use randomness |
| Blob txs (type-3) rejected | None |
| `block.timestamp` non-decreasing, 1s granularity; sub-second blocks can share a timestamp | Fine — stream accrual math is per-second anyway |
| Value transfers can revert despite sufficient balance (zero address, blocklisted addresses, precompiles) | USDC blocklist checks apply at runtime; a blocklisted recipient's `withdraw()` would revert — acceptable |
| `SELFDESTRUCT` moves native USDC + emits Transfer log | None — we don't self-destruct |
| Two-state tx model: **pending or final**, nothing in between | Backend can treat 1 confirmation (`waitForTransactionReceipt`) as settled — no polling for N confirmations |

---

## 6. Foundry: Deploy & Verify

```bash
# contracts/.env
ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
PRIVATE_KEY="0x..."
```

```bash
# Fund the deployer: https://faucet.circle.com → Arc Testnet → testnet USDC (this IS the gas token)

# Deploy
forge create src/StreamVault.sol:StreamVault \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args 0x3600000000000000000000000000000000000000 $OWNER_ADDRESS

# Verify (Blockscout)
forge verify-contract $VAULT_ADDRESS src/StreamVault.sol:StreamVault \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/

# Interact
cast call $VAULT_ADDRESS "nextStreamId()(uint256)" --rpc-url $ARC_TESTNET_RPC_URL
```

Suggested `foundry.toml` additions:

```toml
[rpc_endpoints]
arc_testnet = "${ARC_TESTNET_RPC_URL}"

[etherscan]
arc_testnet = { key = "verifyContract", chain = 5042002, url = "https://testnet.arcscan.app/api/" }
```

---

## 7. Circle Wallets on Arc

- Circle Programmable Wallets support Arc Testnet — blockchain identifier **`ARC-TESTNET`** (matches our `wallets.ts` plan).
- **Smart Contract Accounts (SCA) on Arc Testnet work with Circle Gas Station to auto-sponsor transaction fees** — worth using for recipient wallets so brand-new recipients can withdraw before they hold any USDC for gas.
- Circle also offers pre-audited deploy templates via the Wallets API (ERC-20/721/1155/Airdrop) — not needed for us; we deploy `StreamVault` ourselves with Foundry.

---

## 8. Open Questions / To Verify While Building

- Confirm the exact Circle SDK blockchain enum for Arc (`ARC-TESTNET`) in the current `@circle-fin/user-controlled-wallets` version.
- Confirm whether Circle Payouts (offramp) can pull directly from an Arc wallet or requires a Circle Mint/business account intermediary.
- Mainnet addresses/chain ID unpublished — everything above is testnet; keep all addresses in env vars.
