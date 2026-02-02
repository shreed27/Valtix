/**
 * API client for the Rust wallet backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

// CSRF Token Management
let csrfToken: string | null = null;
export const setCsrfToken = (token: string) => { csrfToken = token; };

// Types
export interface WalletStatus {
  has_wallet: boolean;
  is_unlocked: boolean;
}

export interface Account {
  id: string;
  name: string;
  chain: string;
  derivation_path: string;
  derivation_index: number;
  public_key: string;
  address: string;
  created_at: string;
}

export interface Balance {
  chain: string;
  address: string;
  native_balance: string;
  native_symbol: string;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  address: string;
  symbol?: string;
  name?: string;
  balance: string;
  decimals: number;
  ui_amount: number;
}

export interface Transaction {
  id: string;
  chain: string;
  signature: string;
  tx_type: string;
  from_address?: string;
  to_address?: string;
  amount?: string;
  token_address?: string;
  status: string;
  block_number?: number;
  timestamp?: string;
}

export interface NFT {
  id: string;
  chain: string;
  token_address: string;
  token_id: string;
  name?: string;
  description?: string;
  image_url?: string;
  collection_name?: string;
  metadata?: Record<string, unknown>;
}

export interface Contact {
  id: string;
  name: string;
  chain: string;
  address: string;
  notes?: string;
  created_at: string;
}

export interface MultisigWallet {
  id: string;
  name: string;
  chain: string;
  address: string;
  threshold: number;
  owner_count: number;
  owners: MultisigOwner[];
  created_at: string;
}

export interface MultisigOwner {
  address: string;
  name?: string;
}

export interface MultisigTransaction {
  id: string;
  multisig_id: string;
  to_address: string;
  amount?: string;
  data?: string;
  approvals: string[];
  status: string;
  created_at: string;
  executed_at?: string;
}

export interface SwapQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
}

export interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface QRCode {
  chain: string;
  address: string;
  qr_svg: string;
  qr_data_url: string;
}

// API Error
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Helper function
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...options?.headers,
  } as Record<string, string>;

  // Inject CSRF token for mutating requests
  if (csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(options?.method?.toUpperCase() || "")) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = await response.text();
    try {
      const json = JSON.parse(errorMessage);
      // Try to extract meaningful message
      errorMessage = json.message || json.error || (typeof json === 'string' ? json : errorMessage);
    } catch {
      // Use raw text if not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  getStatus: () => fetchApi<WalletStatus>("/auth/status"),

  getCsrfToken: () => fetchApi<{ token: string }>("/auth/csrf"),

  unlock: (password: string) =>
    fetchApi<WalletStatus>("/auth/unlock", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  lock: () =>
    fetchApi<WalletStatus>("/auth/lock", {
      method: "POST",
    }),

  createWallet: (password: string) =>
    fetchApi<{ wallet_id: string; mnemonic: string[] }>("/wallet/create", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  importWallet: (mnemonic: string, password: string) =>
    fetchApi<{ wallet_id: string }>("/wallet/import", {
      method: "POST",
      body: JSON.stringify({ mnemonic, password }),
    }),

  reset: () =>
    fetchApi<WalletStatus>("/auth/reset", {
      method: "POST",
    }),
};

// Accounts API
export const accountsApi = {
  list: () => fetchApi<Account[]>("/accounts"),

  create: (chain: string, name?: string) =>
    fetchApi<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify({ chain, name }),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/accounts/${id}`, {
      method: "DELETE",
    }),
};

// Balance API
export const balanceApi = {
  getBalance: (chain: string, address: string) =>
    fetchApi<Balance>(`/balances/${chain}/${address}`),

  getTokens: (chain: string, address: string) =>
    fetchApi<TokenBalance[]>(`/tokens/${chain}/${address}`),
};

// Transaction API
export const transactionApi = {
  send: (data: {
    chain: string;
    from_address: string;
    to_address: string;
    amount: string;
    token_address?: string;
  }) =>
    fetchApi<{ tx_hash: string; status: string }>("/transactions/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getHistory: (chain: string, address: string, limit = 50, offset = 0) =>
    fetchApi<Transaction[]>(
      `/transactions/${chain}/${address}?limit=${limit}&offset=${offset}`
    ),
};

// Swap API
export const swapApi = {
  getQuote: (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps = 50
  ) =>
    fetchApi<SwapQuote>(
      `/swap/quote?input_mint=${inputMint}&output_mint=${outputMint}&amount=${amount}&slippage_bps=${slippageBps}`
    ),

  executeSwap: (fromAddress: string, quote: SwapQuote) =>
    fetchApi<{ signature: string; input_amount: string; output_amount: string }>(
      "/swap/execute",
      {
        method: "POST",
        body: JSON.stringify({ from_address: fromAddress, quote }),
      }
    ),
};

// NFT API
export const nftApi = {
  list: (chain: string, address: string) =>
    fetchApi<NFT[]>(`/nfts/${chain}/${address}`),

  get: (chain: string, tokenAddress: string, tokenId: string) =>
    fetchApi<NFT>(`/nfts/${chain}/${tokenAddress}/${tokenId}`),
};

// Contacts API
export const contactsApi = {
  list: () => fetchApi<Contact[]>("/contacts"),

  create: (data: {
    name: string;
    chain: string;
    address: string;
    notes?: string;
  }) =>
    fetchApi<Contact>("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: string) => fetchApi<Contact>(`/contacts/${id}`),

  update: (id: string, data: { name: string; notes?: string }) =>
    fetchApi<Contact>(`/contacts/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/contacts/${id}/delete`, {
      method: "POST",
    }),

  generateQR: (chain: string, address: string) =>
    fetchApi<QRCode>(`/qr/${chain}/${address}`),
};

// Multisig API
export const multisigApi = {
  list: () => fetchApi<MultisigWallet[]>("/multisig"),

  create: (data: {
    chain: string;
    name: string;
    threshold: number;
    owners: string[];
  }) =>
    fetchApi<MultisigWallet>("/multisig/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: string) => fetchApi<MultisigWallet>(`/multisig/${id}`),

  proposeTransaction: (
    multisigId: string,
    data: { to_address: string; amount?: string; data?: string }
  ) =>
    fetchApi<MultisigTransaction>(`/multisig/${multisigId}/propose`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveTransaction: (multisigId: string, txId: string, approverAddress: string) =>
    fetchApi<MultisigTransaction>(`/multisig/${multisigId}/approve/${txId}`, {
      method: "POST",
      body: JSON.stringify({ approver_address: approverAddress }),
    }),

  executeTransaction: (multisigId: string, txId: string) =>
    fetchApi<{ signature: string }>(`/multisig/${multisigId}/execute/${txId}`, {
      method: "POST",
    }),

  getTransactions: (multisigId: string) =>
    fetchApi<MultisigTransaction[]>(`/multisig/${multisigId}/transactions`),
};
