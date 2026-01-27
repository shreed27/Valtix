// Shared types for the extension

export interface Wallet {
  id: string;
  name: string;
  type: 'software' | 'ledger';
  encryptedSeed?: string;
  accounts: WalletAccount[];
  createdAt: string;
}

export interface WalletAccount {
  chain: 'solana' | 'ethereum';
  index: number;
  address: string;
  publicKey: string;
  name?: string;
}

export interface EncryptedVault {
  encryptedData: string;
  salt: string;
  iv: string;
  version: number;
}

export interface VaultContents {
  wallets: Wallet[];
  settings: VaultSettings;
}

export interface VaultSettings {
  autoLockMinutes: number;
  defaultChain: 'solana' | 'ethereum';
}

export interface ConnectedSite {
  origin: string;
  name?: string;
  iconUrl?: string;
  connectedAt: string;
  walletId: string;
  accountIndex: number;
}

// Message types for extension communication
export type ExtensionMessageType =
  | 'CONNECT'
  | 'DISCONNECT'
  | 'SIGN_TRANSACTION'
  | 'SIGN_MESSAGE'
  | 'GET_ACCOUNTS'
  | 'UNLOCK'
  | 'LOCK'
  | 'GET_STATUS';

export interface ExtensionMessage {
  id: string;
  type: ExtensionMessageType;
  payload?: unknown;
  origin?: string;
}

export interface ExtensionResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Popup state
export interface PopupState {
  isLocked: boolean;
  hasVault: boolean;
  currentWallet: Wallet | null;
  currentAccount: WalletAccount | null;
  pendingRequest: PendingRequest | null;
}

export interface PendingRequest {
  id: string;
  type: ExtensionMessageType;
  origin: string;
  data: unknown;
}
