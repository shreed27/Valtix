# Multi-Chain Cryptocurrency Wallet

A production-grade multi-chain cryptocurrency wallet featuring a **Rust backend API** with a **React/Next.js frontend**. Supports Solana and Ethereum with advanced features including transaction history, NFT gallery, address book with QR codes, and multi-signature wallets.

## Features

- **Multi-Chain Support**: Solana and Ethereum
- **HD Wallet**: BIP39 mnemonic generation and BIP44 key derivation
- **Secure Encryption**: Argon2id + ChaCha20-Poly1305 for seed encryption
- **Transaction History**: Track all your transactions
- **NFT Gallery**: View your NFTs on both chains
- **Address Book**: Save contacts with QR code generation
- **Multi-Sig Wallets**: Create and manage multi-signature wallets
- **Token Swaps**: Jupiter integration for Solana swaps

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React/Next.js Frontend                      │
│               (TypeScript, Tailwind, shadcn/ui)                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/JSON API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Rust Backend (Axum)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   Auth   │  │ Wallets  │  │  Chains  │  │     Services     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Cryptography (Argon2 + ChaCha20)               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌───────────┐   ┌───────────┐
        │  SQLite  │   │  Solana   │   │ Ethereum  │
        │    DB    │   │  Devnet   │   │  Sepolia  │
        └──────────┘   └───────────┘   └───────────┘
```

## Tech Stack

### Backend (Rust)
- **Framework**: Axum
- **Database**: SQLite + SQLx
- **Solana**: solana-sdk v2, solana-client, spl-token, mpl-token-metadata
- **Ethereum**: Alloy v1.0
- **HD Wallet**: bip39, ed25519-dalek, k256
- **Encryption**: argon2, chacha20poly1305
- **QR Codes**: qrcode crate

### Frontend (React/Next.js)
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (state) + React Query (server state)
- framer-motion (animations)

## Getting Started

### Prerequisites

- Rust 1.70+
- Node.js 18+
- pnpm/npm/yarn

### Backend Setup

```bash
cd wallet-backend

# Copy environment file
cp .env.example .env

# Build and run
cargo run
```

The backend will start at `http://localhost:8080`.

### Frontend Setup

```bash
cd wallet-frontend

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Start development server
npm run dev
```

The frontend will start at `http://localhost:3000`.

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/status` | Check wallet/unlock status |
| POST | `/api/v1/auth/unlock` | Unlock wallet with password |
| POST | `/api/v1/auth/lock` | Lock wallet |
| POST | `/api/v1/wallet/create` | Create new wallet |
| POST | `/api/v1/wallet/import` | Import existing wallet |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/accounts` | List all accounts |
| POST | `/api/v1/accounts` | Create new account |

### Balances & Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/balances/:chain/:address` | Get balance |
| GET | `/api/v1/tokens/:chain/:address` | Get token balances |
| POST | `/api/v1/transactions/send` | Send transaction |
| GET | `/api/v1/transactions/:chain/:address` | Get history |

### Swaps (Jupiter)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/swap/quote` | Get swap quote |
| POST | `/api/v1/swap/execute` | Execute swap |

### NFTs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/nfts/:chain/:address` | List NFTs |
| GET | `/api/v1/nfts/:chain/:address/:id` | Get NFT details |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/contacts` | List contacts |
| POST | `/api/v1/contacts` | Create contact |
| GET | `/api/v1/qr/:chain/:address` | Generate QR code |

### Multi-Sig
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/multisig` | List multi-sig wallets |
| POST | `/api/v1/multisig/create` | Create multi-sig |
| POST | `/api/v1/multisig/:id/propose` | Propose transaction |
| POST | `/api/v1/multisig/:id/approve/:txId` | Approve transaction |
| POST | `/api/v1/multisig/:id/execute/:txId` | Execute transaction |

## Security

- **Private keys never leave the backend** - Frontend only sends unsigned requests
- **Password never stored** - Only used to derive encryption key in memory
- **Seed encrypted at rest** - Argon2id + ChaCha20-Poly1305
- **Auto-lock after inactivity** - Session expires, requires re-unlock
- **Zeroize sensitive memory** - Uses `zeroize` crate for secure cleanup

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=sqlite:./wallet.db?mode=rwc
SOLANA_RPC_URL=https://api.devnet.solana.com
ETH_RPC_URL=https://rpc.sepolia.org
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

## Testing

### Get Testnet Tokens

**Solana (Devnet)**:
- Faucet: https://solfaucet.com or `solana airdrop 1 <address> --url devnet`

**Ethereum (Sepolia)**:
- Faucet: https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia

## License

MIT
