/**
 * Service Worker - Background script for the extension
 * Handles all message passing and state management
 */

import { keyring } from './keyring';
import type { ExtensionMessage, ExtensionResponse, PendingRequest, ConnectedSite } from '../shared/types';

// Store connected sites
const connectedSites = new Map<string, ConnectedSite>();

// Pending requests waiting for user approval
const pendingRequests = new Map<string, PendingRequest>();

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Valtix Wallet extension installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        id: message.id,
        success: false,
        error: error.message,
      } as ExtensionResponse);
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  const origin = message.origin || sender.origin || '';

  switch (message.type) {
    case 'GET_STATUS':
      return handleGetStatus(message.id);

    case 'UNLOCK':
      return handleUnlock(message.id, message.payload as { password: string });

    case 'LOCK':
      return handleLock(message.id);

    case 'CONNECT':
      return handleConnect(message.id, origin);

    case 'DISCONNECT':
      return handleDisconnect(message.id, origin);

    case 'GET_ACCOUNTS':
      return handleGetAccounts(message.id, origin);

    case 'SIGN_TRANSACTION':
      return handleSignTransaction(message.id, origin, message.payload);

    case 'SIGN_MESSAGE':
      return handleSignMessage(message.id, origin, message.payload);

    default:
      return {
        id: message.id,
        success: false,
        error: `Unknown message type: ${message.type}`,
      };
  }
}

async function handleGetStatus(id: string): Promise<ExtensionResponse> {
  const isInitialized = await keyring.isInitialized();
  const isUnlocked = await keyring.isUnlocked();

  let wallet = null;
  let accounts = null;

  if (isUnlocked) {
    wallet = keyring.getCurrentWallet();
    accounts = wallet?.accounts || [];
  }

  return {
    id,
    success: true,
    data: {
      isInitialized,
      isUnlocked,
      wallet,
      accounts,
    },
  };
}

async function handleUnlock(
  id: string,
  payload: { password: string }
): Promise<ExtensionResponse> {
  const success = await keyring.unlock(payload.password);

  if (!success) {
    return {
      id,
      success: false,
      error: 'Invalid password',
    };
  }

  const wallet = keyring.getCurrentWallet();

  return {
    id,
    success: true,
    data: {
      wallet,
      accounts: wallet?.accounts || [],
    },
  };
}

async function handleLock(id: string): Promise<ExtensionResponse> {
  keyring.lock();
  return {
    id,
    success: true,
    data: { locked: true },
  };
}

async function handleConnect(id: string, origin: string): Promise<ExtensionResponse> {
  const isUnlocked = await keyring.isUnlocked();

  if (!isUnlocked) {
    // Store pending request and open popup
    pendingRequests.set(id, {
      id,
      type: 'CONNECT',
      origin,
      data: {},
    });

    await openPopup();

    return {
      id,
      success: false,
      error: 'Wallet is locked. Please unlock to connect.',
    };
  }

  // Check if already connected
  if (connectedSites.has(origin)) {
    const site = connectedSites.get(origin)!;
    const wallet = keyring.getCurrentWallet();
    const account = wallet?.accounts.find((a) => a.index === site.accountIndex);

    return {
      id,
      success: true,
      data: {
        publicKey: account?.publicKey,
        address: account?.address,
      },
    };
  }

  // Store pending request and open popup for approval
  pendingRequests.set(id, {
    id,
    type: 'CONNECT',
    origin,
    data: {},
  });

  await openPopup();

  // Return pending - the popup will handle the actual response
  return {
    id,
    success: false,
    error: 'PENDING_APPROVAL',
  };
}

async function handleDisconnect(id: string, origin: string): Promise<ExtensionResponse> {
  connectedSites.delete(origin);

  return {
    id,
    success: true,
    data: { disconnected: true },
  };
}

async function handleGetAccounts(id: string, origin: string): Promise<ExtensionResponse> {
  const isUnlocked = await keyring.isUnlocked();

  if (!isUnlocked) {
    return {
      id,
      success: false,
      error: 'Wallet is locked',
    };
  }

  const site = connectedSites.get(origin);
  if (!site) {
    return {
      id,
      success: false,
      error: 'Site not connected',
    };
  }

  const wallet = keyring.getCurrentWallet();
  const account = wallet?.accounts.find((a) => a.index === site.accountIndex);

  return {
    id,
    success: true,
    data: {
      accounts: account ? [account] : [],
    },
  };
}

async function handleSignTransaction(
  id: string,
  origin: string,
  payload: unknown
): Promise<ExtensionResponse> {
  const isUnlocked = await keyring.isUnlocked();

  if (!isUnlocked) {
    return {
      id,
      success: false,
      error: 'Wallet is locked',
    };
  }

  const site = connectedSites.get(origin);
  if (!site) {
    return {
      id,
      success: false,
      error: 'Site not connected',
    };
  }

  // Store pending request and open popup for approval
  pendingRequests.set(id, {
    id,
    type: 'SIGN_TRANSACTION',
    origin,
    data: payload,
  });

  await openPopup();

  return {
    id,
    success: false,
    error: 'PENDING_APPROVAL',
  };
}

async function handleSignMessage(
  id: string,
  origin: string,
  payload: unknown
): Promise<ExtensionResponse> {
  const isUnlocked = await keyring.isUnlocked();

  if (!isUnlocked) {
    return {
      id,
      success: false,
      error: 'Wallet is locked',
    };
  }

  const site = connectedSites.get(origin);
  if (!site) {
    return {
      id,
      success: false,
      error: 'Site not connected',
    };
  }

  // Store pending request and open popup for approval
  pendingRequests.set(id, {
    id,
    type: 'SIGN_MESSAGE',
    origin,
    data: payload,
  });

  await openPopup();

  return {
    id,
    success: false,
    error: 'PENDING_APPROVAL',
  };
}

async function openPopup(): Promise<void> {
  await chrome.action.openPopup();
}

// Exported functions for popup to call
export function getPendingRequests(): PendingRequest[] {
  return Array.from(pendingRequests.values());
}

export function approveConnection(requestId: string, walletId: string, accountIndex: number): void {
  const request = pendingRequests.get(requestId);
  if (!request) return;

  connectedSites.set(request.origin, {
    origin: request.origin,
    connectedAt: new Date().toISOString(),
    walletId,
    accountIndex,
  });

  pendingRequests.delete(requestId);
}

export function rejectRequest(requestId: string): void {
  pendingRequests.delete(requestId);
}

export async function approveSignTransaction(requestId: string): Promise<Uint8Array | null> {
  const request = pendingRequests.get(requestId);
  if (!request) return null;

  const site = connectedSites.get(request.origin);
  if (!site) return null;

  const { transaction } = request.data as { transaction: Uint8Array };

  const signature = await keyring.signSolanaTransaction(
    site.walletId,
    site.accountIndex,
    transaction
  );

  pendingRequests.delete(requestId);
  return signature;
}

export { keyring };
