/**
 * Injected Script - Provides window.solana API for dApps
 * Compatible with Phantom wallet interface
 */

interface PublicKey {
  toBase58(): string;
  toBytes(): Uint8Array;
  toString(): string;
}

interface Transaction {
  serialize(): Uint8Array;
  serializeMessage(): Uint8Array;
  addSignature(publicKey: PublicKey, signature: Uint8Array): void;
}

interface ConnectOptions {
  onlyIfTrusted?: boolean;
}

type PhantomEvent = 'connect' | 'disconnect' | 'accountChanged';

class ValtixSolanaProvider {
  public isValtix = true;
  public isPhantom = true; // For compatibility
  public isConnected = false;
  public publicKey: PublicKey | null = null;

  private listeners: Map<PhantomEvent, Set<(args: unknown) => void>> = new Map();
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();

  constructor() {
    // Listen for responses from content script
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    if (event.data?.source !== 'valtix-content-script') return;

    const { id, success, data, error, type } = event.data;

    // Handle events
    if (type === 'disconnect') {
      this.handleDisconnect();
      return;
    }

    // Handle responses to pending requests
    const pending = this.pendingRequests.get(id);
    if (pending) {
      this.pendingRequests.delete(id);
      if (success) {
        pending.resolve(data);
      } else if (error === 'PENDING_APPROVAL') {
        // Keep waiting - popup will send another response
      } else {
        pending.reject(new Error(error || 'Request failed'));
      }
    }
  }

  private sendMessage(type: string, payload?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, { resolve, reject });

      window.postMessage(
        {
          id,
          source: 'valtix-provider',
          type,
          payload,
        },
        '*'
      );

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  async connect(options?: ConnectOptions): Promise<{ publicKey: PublicKey }> {
    if (this.isConnected && this.publicKey) {
      return { publicKey: this.publicKey };
    }

    try {
      const response = await this.sendMessage('CONNECT', options) as { publicKey: string; address: string };

      this.publicKey = this.createPublicKey(response.publicKey);
      this.isConnected = true;
      this.emit('connect', { publicKey: this.publicKey });

      return { publicKey: this.publicKey };
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.sendMessage('DISCONNECT');
    this.handleDisconnect();
  }

  private handleDisconnect() {
    this.isConnected = false;
    this.publicKey = null;
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction>(transaction: T): Promise<T> {
    if (!this.isConnected || !this.publicKey) {
      throw new Error('Wallet not connected');
    }

    const serialized = transaction.serializeMessage();
    const response = await this.sendMessage('SIGN_TRANSACTION', {
      transaction: Array.from(serialized),
    }) as { signature: number[] };

    const signature = new Uint8Array(response.signature);
    transaction.addSignature(this.publicKey, signature);

    return transaction;
  }

  async signAllTransactions<T extends Transaction>(transactions: T[]): Promise<T[]> {
    // Sign each transaction sequentially
    const signed: T[] = [];
    for (const tx of transactions) {
      signed.push(await this.signTransaction(tx));
    }
    return signed;
  }

  async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const response = await this.sendMessage('SIGN_MESSAGE', {
      message: Array.from(message),
    }) as { signature: number[] };

    return {
      signature: new Uint8Array(response.signature),
    };
  }

  async signAndSendTransaction<T extends Transaction>(
    transaction: T,
    options?: { skipPreflight?: boolean }
  ): Promise<{ signature: string }> {
    // Sign the transaction
    const signed = await this.signTransaction(transaction);

    // Send to network
    const response = await this.sendMessage('SIGN_AND_SEND_TRANSACTION', {
      transaction: Array.from(signed.serialize()),
      options,
    }) as { signature: string };

    return response;
  }

  // Event handling
  on(event: PhantomEvent, callback: (args: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: PhantomEvent, callback: (args: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: PhantomEvent, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Error in event listener:', e);
      }
    });
  }

  private createPublicKey(base58: string): PublicKey {
    // Decode base58 to bytes
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let decoded = BigInt(0);
    for (const char of base58) {
      decoded = decoded * BigInt(58) + BigInt(ALPHABET.indexOf(char));
    }

    const bytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(decoded & BigInt(255));
      decoded = decoded >> BigInt(8);
    }

    return {
      toBase58: () => base58,
      toBytes: () => bytes,
      toString: () => base58,
    };
  }
}

// Inject the provider
if (typeof window !== 'undefined') {
  const provider = new ValtixSolanaProvider();

  // Set as window.solana for Phantom compatibility
  Object.defineProperty(window, 'solana', {
    value: provider,
    writable: false,
    configurable: false,
  });

  // Also set as window.valtix
  Object.defineProperty(window, 'valtix', {
    value: provider,
    writable: false,
    configurable: false,
  });

  // Dispatch event to notify dApps
  window.dispatchEvent(new Event('solana#initialized'));
}
