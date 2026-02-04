# Deployment Guide & Configuration Cheat Sheet

This project consists of two parts that must be deployed separately but connected via environment variables.

---

## 🚀 Part 1: Deploy Backend (Railway)
**Do this FIRST** because the Frontend needs the Backend URL.

### 1. Create Service
1.  Log in to [Railway](https://railway.app/).
2.  **New Project** -> **Deploy from GitHub repo** -> Select your repo.
3.  **IMPORTANT:** Click on the card for your service to open Settings.
4.  Go to **Settings** -> **Root Directory**. Change it to: `/wallet-backend` (watch out for the leading slash).

### 2. Configure Variables (Environment Mode)
Go to the **Variables** tab and add these exactly:

| Variable Name | Value to Enter (Copy & Paste) | Notes |
| :--- | :--- | :--- |
| `PORT` | `8080` | Required by the Dockerfile. |
| `DATABASE_URL` | `sqlite:///app/data/wallet.db?mode=rwc` | **Exact value**. Points to the persistent volume. |
| `JWT_SECRET` | *(Type a long random string here)* | e.g. `super-secret-key-123456789` |
| `RUST_LOG` | `info` | Controls log verbosity. |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Use Devnet for testing. |
| `ETH_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` | Use Sepolia for testing. |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` | **Update this LATER** once you have the Vercel URL. For now, use `*` (asterisk) to allow all. |

### 3. Add Persistent Volume (CRITICAL)
**If you skip this, your users will lose their accounts every time the server restarts.**
1.  Go to the **Volumes** tab.
2.  Click **Add Volume**.
3.  Mount Path: `/app/data`
    *   *Why?* Because our `DATABASE_URL` points to `/app/data/wallet.db`.

### 4. Deploy
*   Railway usually auto-deploys. If not, click **Deploy**.
*   Once active, copy the **Public Domain** (e.g., `web3-wallet.up.railway.app`). You need this for the Frontend.

---

## 🚀 Part 2: Deploy Frontend (Vercel)

### 1. Create Project
1.  Log in to [Vercel](https://vercel.com/).
2.  **Add New...** -> **Project**.
3.  Select your git repository.

### 2. Configure Build
*   **Framework Preset:** Next.js (should be auto-detected).
*   **Root Directory:** Click "Edit" and select `wallet-frontend`.

### 3. Configure Variables
Expand **Environment Variables** and add:

| Variable Name | Value to Enter | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://<YOUR_RAILWAY_URL>/api/v1` | **Paste your Railway URL here**. IMPORTANT: Add `/api/v1` at the end! |

### 4. Deploy
*   Click **Deploy**.
*   Wait for the confetti! 🎉

---

## 🔄 Final Connection Step
1.  Copy your new Vercel Domain (e.g., `https://my-wallet.vercel.app`).
2.  Go back to **Railway** -> **Variables**.
3.  Edit `CORS_ORIGIN` and paste your Vercel URL (remove any trailing slash).
4.  Railway will restart the backend automatically.

**✅ You are now fully live!**
