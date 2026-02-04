# Deployment Guide

This project consists of a **Rust Backend** (using `sqlx` and SQLite) and a **Next.js Frontend**.

## 1. Backend Deployment (Railway Recommended)

Since the backend uses SQLite, it requires a **Persistent Volume** to store the database file (`wallet.db`). Most serverless platforms (like Vercel functions or AWS Lambda) have ephemeral filesystems, meaning your data would be wiped on every restart. **Railway** is recommended because it supports persistent volumes easily.

### Prerequisites
- Install the `sqlx-cli` to generate offline metadata (required for building the Docker image without a live DB connection).
  ```bash
  cargo install sqlx-cli
  ```
- Run the preparation command in `wallet-backend`:
  ```bash
  cd wallet-backend
  cargo sqlx prepare
  ```
  Check that `sqlx-data.json` is created. **Commit this file to git.**

### Steps for Railway
1.  **Push your code** to GitHub.
2.  Log in to [Railway](https://railway.app/).
3.  Click **New Project** -> **Deploy from GitHub repo**.
4.  Select your repository.
5.  **Configure Service**: Railway might detect the root directory. You need to configure it to look at `wallet-backend`.
    -   Go to **Settings** -> **Root Directory** and set it to `/wallet-backend`.
6.  **Variables**: Add the following Environment Variables:
    -   `DATABASE_URL`: `sqlite:///app/data/wallet.db?mode=rwc` (Note the `/app/data/` path).
    -   `JWT_SECRET`: A long random string.
    -   `SOLANA_RPC_URL`: https://api.mainnet-beta.solana.com (or devnet).
    -   `ETH_RPC_URL`: Your Ethereum RPC URL (e.g., from Alchemy/Infura).
    -   `CORS_ORIGIN`: The URL of your frontend (e.g., `https://your-frontend.vercel.app`).
    -   `PORT`: `8080`.
7.  **Volumes** (Crucial!):
    -   Go to **Volumes**.
    -   Add a volume.
    -   Mount path: `/app/data`.
    -   This ensures `wallet.db` is stored here and persists across restarts.

## 2. Frontend Deployment (Vercel Recommended)

Vercel is the creators of Next.js and offers the best hosting experience.

### Steps for Vercel
1.  Go to [Vercel](https://vercel.com/) and create a **New Project**.
2.  Import your GitHub repository.
3.  **Root Directory**: Select `wallet-frontend`.
4.  **Environment Variables**:
    -   `NEXT_PUBLIC_API_URL`: The URL of your deployed backend (e.g., `https://web3-wallet-backend.up.railway.app/api/v1`).
5.  Click **Deploy**.

## 3. Post-Deployment Verification
1.  Open your Vercel URL.
2.  Try to create a wallet. This should send a request to your Railway backend.
3.  The backend will create the SQLite DB file in the persistent volume on the first run (handled by the Rust code logic).

## Docker Local Testing
You can build the backend image locally to verify it:
```bash
cd wallet-backend
docker build -t wallet-backend .
docker run -p 8080:8080 -v $(pwd)/wallet.db:/app/wallet.db -e DATABASE_URL=sqlite:wallet.db?mode=rwc -e JWT_SECRET=test wallet-backend
```
