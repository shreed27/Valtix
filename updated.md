# Valtix Wallet - Comprehensive Review & Enhancement Plan

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Critical Issues (Must Fix)](#critical-issues-must-fix)
3. [Backend Issues & Solutions](#backend-issues--solutions)
4. [Frontend Issues & Solutions](#frontend-issues--solutions)
5. [Security Concerns](#security-concerns)
6. [Enhancements](#enhancements)
7. [New Features](#new-features)
8. [Meme Coins Feature (DexScreener Integration)](#meme-coins-feature-dexscreener-integration)
9. [Implementation Priority & Timeline](#implementation-priority--timeline)

---

## Executive Summary

### Current State
| Component | Completeness | Quality |
|-----------|--------------|---------|
| Solana Backend | ~80% | Good |
| Ethereum Backend | ~40% | Needs Work |
| Frontend UI | ~75% | Good |
| Mobile Support | ~30% | Poor |
| Security | ~60% | Needs Hardening |

### Key Findings
- **5 CRITICAL bugs** that break core functionality
- **12 HIGH priority** issues affecting security/UX
- **20+ MEDIUM** improvements needed
- **Ethereum transactions don't actually work** (returns fake hashes)
- **Mobile navigation completely broken**
- **No address validation** before sending

---

## Critical Issues (Must Fix)

### 1. `is_unlocked()` Always Returns False
**File:** `wallet-backend/src/main.rs:45-48`
```rust
// BROKEN - Always returns false
pub fn is_unlocked(&self) -> bool {
    self.unlocked_seed.try_read().map(|guard| guard.is_some()).unwrap_or(false)
}
```
**Impact:** Wallet state checking is completely broken
**Solution:**
```rust
pub async fn is_unlocked(&self) -> bool {
    self.unlocked_seed.read().await.is_some()
}
```

### 2. Ethereum Transactions Return Fake Hashes
**File:** `wallet-backend/src/chains/ethereum/transaction.rs:62-102`
**Impact:** Users think transactions succeeded but nothing happened
**Solution:** Implement real transaction signing and broadcasting:
```rust
// Need to implement:
// 1. Build transaction with proper nonce, gas, etc.
// 2. Sign with wallet private key
// 3. RLP encode transaction
// 4. Send via eth_sendRawTransaction RPC
// 5. Return actual transaction hash
```

### 3. Mobile Navigation Hidden
**File:** `wallet-frontend/src/app/page.tsx:207`
```tsx
<div className="hidden md:flex items-center gap-2">
```
**Impact:** Mobile users cannot access Send, Receive, Swap, NFTs, etc.
**Solution:** Add hamburger menu for mobile:
```tsx
// Add mobile menu component with Sheet/Drawer
<Sheet>
  <SheetTrigger className="md:hidden">
    <Menu className="h-6 w-6" />
  </SheetTrigger>
  <SheetContent>
    {/* Navigation links */}
  </SheetContent>
</Sheet>
```

### 4. No Address Validation Before Send
**File:** `wallet-frontend/src/app/send/page.tsx:56-60`
**Impact:** Users can send to invalid addresses, losing funds
**Solution:**
```typescript
const validateAddress = (chain: string, address: string): boolean => {
  if (chain === 'solana') {
    try {
      new PublicKey(address);
      return true;
    } catch { return false; }
  }
  if (chain === 'ethereum') {
    return /^0x[a-fA-F0-9]{40}$/.test(address) && isValidChecksum(address);
  }
  return false;
};
```

### 5. Default JWT Secret in Code
**File:** `wallet-backend/src/main.rs:74`
```rust
let jwt_secret = std::env::var("JWT_SECRET")
    .unwrap_or_else(|_| "your-super-secret-jwt-key-change-in-production".to_string());
```
**Impact:** Anyone can forge authentication tokens
**Solution:** Require JWT_SECRET env var, fail if not set:
```rust
let jwt_secret = std::env::var("JWT_SECRET")
    .expect("JWT_SECRET environment variable must be set");
```

---

## Backend Issues & Solutions

### Error Handling (HIGH)

| File | Lines | Issue | Solution |
|------|-------|-------|----------|
| `core/derivation.rs` | 149-150, 173-174, 242-243, 272 | `.try_into().unwrap()` panics | Use `?` operator with proper error types |
| `chains/solana/nft.rs` | 53, 174, 182, 190 | `.unwrap()` on network data | Use `.ok()` or `?` with default fallbacks |
| `main.rs` | 102 | `.unwrap()` on CORS header | Validate before parsing |
| `api/handlers/user_auth.rs` | 101, 158 | `.unwrap()` on cookies | Use `.ok_or()` error handling |

**Global Fix:** Create custom error type:
```rust
#[derive(Debug, thiserror::Error)]
pub enum WalletError {
    #[error("Derivation error: {0}")]
    Derivation(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("Parse error: {0}")]
    Parse(String),
}
```

### Incomplete Implementations (HIGH)

#### Ethereum Transaction History
**File:** `wallet-backend/src/chains/ethereum/transaction.rs:220-230`
```rust
// Currently returns empty vec
pub async fn get_transaction_history(...) -> Result<Vec<Transaction>, Error> {
    Ok(vec![]) // TODO: Implement
}
```
**Solution:** Integrate Etherscan API or Alchemy:
```rust
// Option 1: Etherscan API
let url = format!(
    "https://api.etherscan.io/api?module=account&action=txlist&address={}&apikey={}",
    address, api_key
);

// Option 2: Alchemy
let url = format!(
    "https://eth-mainnet.g.alchemy.com/v2/{}/getAssetTransfers",
    api_key
);
```

#### Ethereum NFT Support
**Current:** Not implemented at all
**Solution:** Add ERC-721/1155 support:
```rust
// wallet-backend/src/chains/ethereum/nft.rs
pub async fn get_nfts(address: &str) -> Result<Vec<Nft>, Error> {
    // Use Alchemy NFT API or Moralis
    let url = format!(
        "https://eth-mainnet.g.alchemy.com/nft/v3/{}/getNFTsForOwner?owner={}",
        api_key, address
    );
    // Parse response and return NFTs
}
```

### Database Issues (MEDIUM)

1. **Missing Migration Backfill**
   - File: `migrations/002_multi_user.sql:28-31`
   - Issue: Existing wallets won't have `name` or `wallet_type`
   - Solution: Add `UPDATE wallets SET name = 'Default', wallet_type = 'software' WHERE name IS NULL`

2. **No Index on Frequently Queried Columns**
   - Add: `CREATE INDEX idx_accounts_address ON accounts(address)`
   - Add: `CREATE INDEX idx_transactions_account ON transaction_history(account_id)`

3. **Race Condition in Reset**
   - File: `storage/database.rs:492-522`
   - Issue: Errors ignored during reset
   - Solution: Use database transaction with rollback

---

## Frontend Issues & Solutions

### State Management (HIGH)

#### Race Condition in Account Creation
**File:** `wallet-frontend/src/app/page.tsx:74-96`
```typescript
// Current: Two separate mutations that can fail independently
const result = await createWalletMutation.mutateAsync(password);
await createAccountMutation.mutateAsync({ chain: selectedChain });
```
**Solution:**
```typescript
// Use Promise.all with proper error handling
try {
  const result = await createWalletMutation.mutateAsync(password);
  await createAccountMutation.mutateAsync({ chain: selectedChain });
} catch (err) {
  // Rollback or show specific error
  if (err.message.includes('wallet')) {
    toast.error('Failed to create wallet');
  } else {
    toast.error('Wallet created but account creation failed');
  }
}
```

#### Mnemonic in localStorage (SECURITY)
**Files:** `page.tsx:82`, `setup/page.tsx:74,93`
```typescript
localStorage.setItem("demo_mnemonic", JSON.stringify(result.mnemonic));
```
**Solution:** Use sessionStorage or encrypted storage:
```typescript
// Option 1: Session storage (cleared on tab close)
sessionStorage.setItem("temp_mnemonic", encrypt(mnemonic, sessionKey));

// Option 2: Remove after user confirms backup
useEffect(() => {
  const timer = setTimeout(() => {
    localStorage.removeItem("demo_mnemonic");
  }, 300000); // 5 minutes
  return () => clearTimeout(timer);
}, []);
```

### API Error Handling (HIGH)

**File:** `wallet-frontend/src/lib/api.ts:156-157`
```typescript
// Current: Throws raw error text
if (!response.ok) {
  const error = await response.text();
  throw new ApiError(response.status, error);
}
```
**Solution:**
```typescript
if (!response.ok) {
  const error = await response.json().catch(() => ({ message: 'Unknown error' }));
  const userMessage = getErrorMessage(response.status, error);
  throw new ApiError(response.status, userMessage);
}

function getErrorMessage(status: number, error: any): string {
  switch (status) {
    case 400: return error.message || 'Invalid request';
    case 401: return 'Please unlock your wallet';
    case 404: return 'Resource not found';
    case 500: return 'Server error. Please try again.';
    default: return 'Something went wrong';
  }
}
```

### Accessibility (HIGH)

| Issue | Files | Solution |
|-------|-------|----------|
| Missing ARIA labels | All button icons | Add `aria-label` to all icon buttons |
| Color-only indicators | contacts, accounts | Add text labels: `SOL` / `ETH` |
| No focus management | Modals | Use `useFocusTrap` or Radix Dialog |
| Missing form labels | contacts/page.tsx | Add `<label htmlFor="">` elements |
| No skip navigation | layout.tsx | Add "Skip to main content" link |

**Example Fix:**
```tsx
// Before
<button onClick={togglePrivateKey}>
  <Eye className="h-4 w-4" />
</button>

// After
<button
  onClick={togglePrivateKey}
  aria-label={revealed ? "Hide private key" : "Show private key"}
>
  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

### Validation (MEDIUM)

#### Amount Validation
**File:** `send/page.tsx`
```typescript
// Add comprehensive validation
const validateAmount = (amount: string, balance: string, decimals: number) => {
  const amountNum = parseFloat(amount);
  const balanceNum = parseFloat(balance);

  if (isNaN(amountNum) || amountNum <= 0) {
    return { valid: false, error: 'Enter a valid amount' };
  }
  if (amountNum > balanceNum) {
    return { valid: false, error: 'Insufficient balance' };
  }
  // Check decimal places
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return { valid: false, error: `Max ${decimals} decimal places` };
  }
  return { valid: true };
};
```

#### Mnemonic Validation
**File:** `setup/page.tsx`
```typescript
import { validateMnemonic } from 'bip39';

const handleImport = async () => {
  const words = mnemonicInput.trim().split(/\s+/);

  if (words.length !== 12 && words.length !== 24) {
    setError('Mnemonic must be 12 or 24 words');
    return;
  }

  if (!validateMnemonic(mnemonicInput.trim())) {
    setError('Invalid mnemonic phrase');
    return;
  }

  // Proceed with import
};
```

---

## Security Concerns

### Critical Security Issues

| Issue | Risk | Solution |
|-------|------|----------|
| Default JWT secret | Token forgery | Require env var |
| Mnemonic in localStorage | Key theft | Use sessionStorage + encryption |
| No CSRF protection | Cross-site attacks | Add CSRF tokens |
| No rate limiting | Brute force | Implement rate limiter middleware |
| Unencrypted seed in memory | Memory dump attack | Additional encryption layer |

### Security Enhancements Needed

1. **Add Transaction Confirmation Modal**
```tsx
<ConfirmTransactionModal
  recipient={recipient}
  amount={amount}
  fee={estimatedFee}
  onConfirm={handleSend}
  onCancel={() => setShowConfirm(false)}
/>
```

2. **Add Spending Limits**
```rust
// Backend: Check spending limits before transaction
pub async fn check_spending_limit(
    user_id: &str,
    amount: u64,
    period: Duration
) -> Result<bool, Error> {
    let spent = get_spent_in_period(user_id, period).await?;
    let limit = get_user_limit(user_id).await?;
    Ok(spent + amount <= limit)
}
```

3. **Add Audit Logging**
```rust
pub async fn log_sensitive_action(
    user_id: &str,
    action: &str,
    details: &str,
    ip: &str
) {
    sqlx::query!(
        "INSERT INTO audit_log (user_id, action, details, ip, timestamp) VALUES (?, ?, ?, ?, ?)",
        user_id, action, details, ip, Utc::now()
    ).execute(&pool).await;
}
```

---

## Enhancements

### Performance Improvements

1. **Add API Response Caching**
```typescript
// useWallet.ts - Add staleTime
export function useBalance(chain: string, address: string) {
  return useQuery({
    queryKey: ['balance', chain, address],
    queryFn: () => balanceApi.getBalance(chain, address),
    staleTime: 10000, // 10 seconds
    cacheTime: 60000, // 1 minute
  });
}
```

2. **Add Transaction History Pagination**
```tsx
// history/page.tsx
const [page, setPage] = useState(0);
const LIMIT = 20;

const { data: transactions } = useTransactionHistory(
  account.chain,
  account.address,
  LIMIT,
  page * LIMIT
);

<Pagination
  page={page}
  onPageChange={setPage}
  hasMore={transactions?.length === LIMIT}
/>
```

3. **Optimize NFT Images**
```tsx
// nfts/page.tsx - Use Next.js Image
import Image from 'next/image';

<Image
  src={nft.image_url}
  alt={nft.name}
  width={200}
  height={200}
  placeholder="blur"
  blurDataURL="/nft-placeholder.png"
/>
```

### UX Improvements

1. **Add Transaction Fee Display**
```tsx
const { data: fee } = useEstimatedFee(chain, recipient, amount);

<div className="flex justify-between text-sm">
  <span className="text-muted-foreground">Network Fee</span>
  <span>{fee?.formatted || 'Calculating...'}</span>
</div>
```

2. **Add Balance Display on Dashboard**
```tsx
{accounts?.map((account) => (
  <WalletCard key={account.id} account={account}>
    <Balance chain={account.chain} address={account.address} />
  </WalletCard>
))}
```

3. **Add Settings Page**
- Change password
- Export wallet
- Security settings (spending limits, 2FA)
- Display preferences (currency, theme)
- Network selection (mainnet/testnet)

---

## New Features

### 1. Token Portfolio View
Display all tokens with values in one place:
```
/portfolio
├── Total Value: $X,XXX.XX
├── Tokens
│   ├── SOL: 10.5 ($2,100)
│   ├── USDC: 500 ($500)
│   └── ... more tokens
└── 24h Change: +5.2%
```

### 2. Price Alerts
```typescript
interface PriceAlert {
  tokenAddress: string;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
}

// Backend endpoint
POST /api/v1/alerts
GET /api/v1/alerts
DELETE /api/v1/alerts/:id
```

### 3. Address Labels/Tags
Save frequently used addresses with custom labels:
```typescript
interface AddressLabel {
  address: string;
  chain: string;
  label: string;
  color?: string;
}
```

### 4. Transaction Notes
Add notes to transactions for record-keeping:
```sql
ALTER TABLE transaction_history ADD COLUMN note TEXT;
```

---

## Meme Coins Feature (DexScreener Integration)

### Overview
Add a "Trending" or "Meme Coins" section showing hot tokens from DexScreener API.

### API Integration

**Base URL:** `https://api.dexscreener.com`
**Auth:** None required (free API)
**Rate Limit:** 60 req/min (profiles), 300 req/min (pairs)

### Backend Implementation

#### 1. Create DexScreener Service
**File:** `wallet-backend/src/services/dexscreener_service.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPair {
    pub chain_id: String,
    pub dex_id: String,
    pub pair_address: String,
    pub base_token: Token,
    pub quote_token: Token,
    pub price_usd: String,
    pub price_change: PriceChange,
    pub volume: Volume,
    pub liquidity: Liquidity,
    pub fdv: Option<String>,
    pub market_cap: Option<String>,
    pub pair_created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Token {
    pub address: String,
    pub name: String,
    pub symbol: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PriceChange {
    pub m5: Option<f64>,
    pub h1: Option<f64>,
    pub h6: Option<f64>,
    pub h24: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Volume {
    pub h24: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Liquidity {
    pub usd: Option<f64>,
}

pub struct DexScreenerService {
    client: Client,
    base_url: String,
}

impl DexScreenerService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: "https://api.dexscreener.com".to_string(),
        }
    }

    /// Get trending/new pairs for a chain
    pub async fn get_trending_pairs(&self, chain: &str) -> Result<Vec<TokenPair>, Error> {
        let url = format!("{}/latest/dex/pairs/{}", self.base_url, chain);
        let response = self.client.get(&url).send().await?;
        let data: DexScreenerResponse = response.json().await?;
        Ok(data.pairs)
    }

    /// Search for tokens
    pub async fn search_tokens(&self, query: &str) -> Result<Vec<TokenPair>, Error> {
        let url = format!("{}/latest/dex/search?q={}", self.base_url, query);
        let response = self.client.get(&url).send().await?;
        let data: DexScreenerResponse = response.json().await?;
        Ok(data.pairs)
    }

    /// Get token boosted profiles (hot tokens)
    pub async fn get_boosted_tokens(&self) -> Result<Vec<TokenPair>, Error> {
        let url = format!("{}/token-boosts/top/v1", self.base_url);
        let response = self.client.get(&url).send().await?;
        let data: DexScreenerResponse = response.json().await?;
        Ok(data.pairs)
    }

    /// Filter for meme coin candidates
    pub fn filter_meme_coins(&self, pairs: Vec<TokenPair>) -> Vec<TokenPair> {
        pairs.into_iter().filter(|pair| {
            let market_cap = pair.market_cap.as_ref()
                .and_then(|mc| mc.parse::<f64>().ok())
                .unwrap_or(0.0);

            let liquidity = pair.liquidity.usd.unwrap_or(0.0);
            let volume_24h = pair.volume.h24.as_ref()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);

            let age_hours = (chrono::Utc::now().timestamp_millis() - pair.pair_created_at)
                / (1000 * 60 * 60);

            // Meme coin criteria
            market_cap >= 100_000.0 &&      // Min $100K market cap
            market_cap <= 10_000_000.0 &&   // Max $10M market cap
            liquidity >= 50_000.0 &&        // Min $50K liquidity
            volume_24h >= 100_000.0 &&      // Min $100K volume
            age_hours >= 1 &&               // At least 1 hour old
            age_hours <= 168                // Max 7 days old
        }).collect()
    }
}
```

#### 2. Create API Handlers
**File:** `wallet-backend/src/api/handlers/trending.rs`

```rust
use axum::{extract::Query, Json};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct TrendingQuery {
    chain: Option<String>,
    filter: Option<String>, // "meme", "new", "hot"
}

pub async fn get_trending(
    Query(params): Query<TrendingQuery>,
) -> Result<Json<Vec<TokenPair>>, ApiError> {
    let service = DexScreenerService::new();
    let chain = params.chain.unwrap_or("solana".to_string());

    let pairs = service.get_trending_pairs(&chain).await?;

    let filtered = match params.filter.as_deref() {
        Some("meme") => service.filter_meme_coins(pairs),
        Some("new") => pairs.into_iter()
            .filter(|p| {
                let age = chrono::Utc::now().timestamp_millis() - p.pair_created_at;
                age < 24 * 60 * 60 * 1000 // Last 24 hours
            })
            .collect(),
        _ => pairs,
    };

    Ok(Json(filtered))
}

pub async fn search_tokens(
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<TokenPair>>, ApiError> {
    let service = DexScreenerService::new();
    let results = service.search_tokens(&params.q).await?;
    Ok(Json(results))
}
```

#### 3. Add Routes
**File:** `wallet-backend/src/api/routes.rs`

```rust
// Add to router
.route("/trending", get(handlers::trending::get_trending))
.route("/trending/search", get(handlers::trending::search_tokens))
.route("/trending/boosted", get(handlers::trending::get_boosted))
```

### Frontend Implementation

#### 1. Create Trending Page
**File:** `wallet-frontend/src/app/trending/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Flame, Sparkles, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TokenPair {
  chainId: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { symbol: string };
  priceUsd: string;
  priceChange: { h1?: number; h24?: number };
  volume: { h24?: string };
  liquidity: { usd?: number };
  marketCap?: string;
  fdv?: string;
  pairCreatedAt: number;
}

export default function TrendingPage() {
  const [chain, setChain] = useState<"solana" | "ethereum">("solana");
  const [filter, setFilter] = useState<"hot" | "new" | "meme">("hot");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["trending", chain, filter],
    queryFn: () => fetch(`/api/v1/trending?chain=${chain}&filter=${filter}`)
      .then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: searchResults } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => fetch(`/api/v1/trending/search?q=${searchQuery}`)
      .then(res => res.json()),
    enabled: searchQuery.length > 2,
  });

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num < 0.00001) return `$${num.toExponential(2)}`;
    if (num < 1) return `$${num.toFixed(6)}`;
    return `$${num.toFixed(2)}`;
  };

  const formatChange = (change?: number) => {
    if (!change) return null;
    const isPositive = change >= 0;
    return (
      <span className={isPositive ? "text-green-500" : "text-red-500"}>
        {isPositive ? "+" : ""}{change.toFixed(2)}%
      </span>
    );
  };

  const formatVolume = (volume?: string) => {
    if (!volume) return "-";
    const num = parseFloat(volume);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const getAgeLabel = (createdAt: number) => {
    const hours = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60));
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="min-h-screen container max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Flame className="h-8 w-8 text-orange-500" />
          Trending Tokens
        </h1>
        <p className="text-muted-foreground mt-2">
          Discover hot meme coins and new tokens
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Chain Selector */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={chain === "solana" ? "default" : "outline"}
          onClick={() => setChain("solana")}
          size="sm"
        >
          Solana
        </Button>
        <Button
          variant={chain === "ethereum" ? "default" : "outline"}
          onClick={() => setChain("ethereum")}
          size="sm"
        >
          Ethereum
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="hot" className="flex items-center gap-1">
            <Flame className="h-4 w-4" /> Hot
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" /> New
          </TabsTrigger>
          <TabsTrigger value="meme" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> Meme
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading tokens...
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {(searchQuery.length > 2 ? searchResults : tokens)?.map((token: TokenPair, index: number) => (
                  <motion.div
                    key={token.pairAddress}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => window.open(
                      `https://dexscreener.com/${token.chainId}/${token.pairAddress}`,
                      '_blank'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {token.baseToken.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {token.baseToken.symbol}
                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                              {getAgeLabel(token.pairCreatedAt)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {token.baseToken.name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-semibold">
                          {formatPrice(token.priceUsd)}
                        </div>
                        <div className="text-sm">
                          {formatChange(token.priceChange.h24)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between text-sm text-muted-foreground">
                      <span>Vol 24h: {formatVolume(token.volume.h24)}</span>
                      <span>Liq: {formatVolume(token.liquidity.usd?.toString())}</span>
                      <span>MC: {formatVolume(token.marketCap)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 2. Add to Navigation
**File:** `wallet-frontend/src/app/page.tsx`

```tsx
// Add to navigation links
<Button asChild variant="outline" size="sm">
  <Link href="/trending">
    <Flame className="h-4 w-4 mr-1" />
    Trending
  </Link>
</Button>
```

#### 3. Add API Client
**File:** `wallet-frontend/src/lib/api.ts`

```typescript
// Trending API
export const trendingApi = {
  getTrending: (chain: string, filter?: string) =>
    fetchApi<TokenPair[]>(`/trending?chain=${chain}${filter ? `&filter=${filter}` : ''}`),

  search: (query: string) =>
    fetchApi<TokenPair[]>(`/trending/search?q=${encodeURIComponent(query)}`),

  getBoosted: () =>
    fetchApi<TokenPair[]>('/trending/boosted'),
};
```

### Caching Strategy

```rust
// Add Redis or in-memory cache
use cached::proc_macro::cached;

#[cached(time = 30, key = "String", convert = r#"{ format!("{}-{}", chain, filter) }"#)]
pub async fn get_trending_cached(chain: &str, filter: &str) -> Vec<TokenPair> {
    let service = DexScreenerService::new();
    let pairs = service.get_trending_pairs(chain).await.unwrap_or_default();
    // Apply filter...
    pairs
}
```

---

## Implementation Priority & Timeline

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix `is_unlocked()` function
- [ ] Implement real Ethereum transactions
- [ ] Add mobile navigation menu
- [ ] Add address validation
- [ ] Remove default JWT secret

### Phase 2: Security & Stability (Week 2)
- [ ] Replace all `.unwrap()` with proper error handling
- [ ] Move mnemonic from localStorage
- [ ] Add CSRF protection
- [ ] Add rate limiting
- [ ] Add audit logging

### Phase 3: UX Improvements (Week 3)
- [ ] Add balance display on dashboard
- [ ] Add transaction fee estimates
- [ ] Implement Ethereum transaction history
- [ ] Add pagination to history
- [ ] Improve accessibility (ARIA labels, focus management)

### Phase 4: New Features (Week 4)
- [ ] Implement Meme Coins / Trending page
- [ ] Add Settings page
- [ ] Add Price Alerts
- [ ] Add Token Portfolio view

### Phase 5: Polish (Week 5)
- [ ] Add NFT support for Ethereum
- [ ] Implement real multisig contracts
- [ ] Add 2FA support
- [ ] Performance optimizations
- [ ] Comprehensive testing

---

## Summary

This document outlines 50+ improvements across:
- **5 Critical bugs** that must be fixed immediately
- **12 High-priority** security and UX issues
- **20+ Medium** enhancements
- **4 New features** including the Meme Coins page

The Meme Coins feature using DexScreener API is fully specified with:
- Backend service implementation
- API endpoints
- Frontend page with search, filtering, and real-time updates
- Caching strategy

Total estimated effort: **4-5 weeks** for full implementation.
