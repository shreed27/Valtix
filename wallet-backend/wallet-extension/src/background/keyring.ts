/**
 * Keyring - Secure key management for the extension
 * Uses WebCrypto API for encryption and key derivation
 */

import type { EncryptedVault, VaultContents, Wallet, WalletAccount } from '../shared/types';

const VAULT_KEY = 'valtix_vault';
const PBKDF2_ITERATIONS = 600000; // OWASP recommendation

export class Keyring {
  private vault: VaultContents | null = null;
  private encryptionKey: CryptoKey | null = null;
  private lockTimeout: NodeJS.Timeout | null = null;
  private autoLockMinutes = 15;

  async isInitialized(): Promise<boolean> {
    const stored = await chrome.storage.local.get(VAULT_KEY);
    return !!stored[VAULT_KEY];
  }

  async isUnlocked(): Promise<boolean> {
    return this.vault !== null && this.encryptionKey !== null;
  }

  async createVault(password: string, mnemonic?: string): Promise<string[]> {
    // Generate or use provided mnemonic
    const seedPhrase = mnemonic || this.generateMnemonic();
    const seedWords = seedPhrase.split(' ');

    // Create initial vault contents
    const vaultContents: VaultContents = {
      wallets: [],
      settings: {
        autoLockMinutes: 15,
        defaultChain: 'solana',
      },
    };

    // Create first wallet from seed
    const wallet: Wallet = {
      id: crypto.randomUUID(),
      name: 'My Wallet',
      type: 'software',
      encryptedSeed: await this.encryptSeed(seedPhrase, password),
      accounts: [],
      createdAt: new Date().toISOString(),
    };

    // Derive initial accounts
    const solanaAccount = await this.deriveSolanaAccount(seedPhrase, 0);
    const ethereumAccount = await this.deriveEthereumAccount(seedPhrase, 0);

    wallet.accounts.push(solanaAccount, ethereumAccount);
    vaultContents.wallets.push(wallet);

    // Encrypt and store vault
    await this.encryptAndStoreVault(vaultContents, password);

    // Keep vault unlocked
    this.vault = vaultContents;
    this.setAutoLockTimer();

    return seedWords;
  }

  async unlock(password: string): Promise<boolean> {
    const stored = await chrome.storage.local.get(VAULT_KEY);
    if (!stored[VAULT_KEY]) {
      throw new Error('No vault found');
    }

    const encryptedVault: EncryptedVault = stored[VAULT_KEY];

    try {
      // Derive key from password
      this.encryptionKey = await this.deriveKey(password, encryptedVault.salt);

      // Decrypt vault
      const decrypted = await this.decryptVault(encryptedVault);
      this.vault = JSON.parse(decrypted);
      this.autoLockMinutes = this.vault?.settings?.autoLockMinutes || 15;
      this.setAutoLockTimer();

      return true;
    } catch {
      this.encryptionKey = null;
      return false;
    }
  }

  lock(): void {
    this.vault = null;
    this.encryptionKey = null;
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
  }

  getWallets(): Wallet[] {
    if (!this.vault) throw new Error('Vault is locked');
    // Return wallets without encrypted seeds
    return this.vault.wallets.map((w) => ({
      ...w,
      encryptedSeed: undefined,
    }));
  }

  getCurrentWallet(): Wallet | null {
    if (!this.vault || this.vault.wallets.length === 0) return null;
    const wallet = this.vault.wallets[0];
    return { ...wallet, encryptedSeed: undefined };
  }

  async signSolanaTransaction(
    walletId: string,
    accountIndex: number,
    transaction: Uint8Array
  ): Promise<Uint8Array> {
    if (!this.vault) throw new Error('Vault is locked');

    const wallet = this.vault.wallets.find((w) => w.id === walletId);
    if (!wallet) throw new Error('Wallet not found');

    if (wallet.type === 'ledger') {
      // TODO: Implement Ledger signing
      throw new Error('Ledger signing not yet implemented');
    }

    // Get seed and derive keypair
    const seed = await this.decryptSeed(wallet.encryptedSeed!);
    const keypair = await this.deriveSolanaKeypair(seed, accountIndex);

    // Sign transaction using tweetnacl
    const nacl = await import('tweetnacl');
    const signature = nacl.sign.detached(transaction, keypair.secretKey);

    return signature;
  }

  async signMessage(
    walletId: string,
    accountIndex: number,
    message: Uint8Array
  ): Promise<Uint8Array> {
    return this.signSolanaTransaction(walletId, accountIndex, message);
  }

  // Private methods

  private generateMnemonic(): string {
    // Generate 24 random words (256 bits of entropy)
    const entropy = new Uint8Array(32);
    crypto.getRandomValues(entropy);

    // Simple BIP39 wordlist subset for demo
    // In production, use full BIP39 wordlist
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
      'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
      'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
      'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
    ];

    const mnemonic: string[] = [];
    for (let i = 0; i < 24; i++) {
      const index = entropy[i] % words.length;
      mnemonic.push(words[index]);
    }

    return mnemonic.join(' ');
  }

  private async deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptAndStoreVault(vault: VaultContents, password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await this.deriveKey(password, btoa(String.fromCharCode(...salt)));
    this.encryptionKey = key;

    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(vault))
    );

    const encryptedVault: EncryptedVault = {
      encryptedData: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      version: 1,
    };

    await chrome.storage.local.set({ [VAULT_KEY]: encryptedVault });
  }

  private async decryptVault(encryptedVault: EncryptedVault): Promise<string> {
    if (!this.encryptionKey) throw new Error('No encryption key');

    const encrypted = Uint8Array.from(atob(encryptedVault.encryptedData), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedVault.iv), (c) => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  private async encryptSeed(seed: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, btoa(String.fromCharCode(...salt)));

    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(seed)
    );

    return JSON.stringify({
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
    });
  }

  private async decryptSeed(encryptedSeed: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Vault is locked');

    const { data, iv } = JSON.parse(encryptedSeed);
    const encrypted = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const ivArray = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      this.encryptionKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  private async deriveSolanaAccount(seed: string, index: number): Promise<WalletAccount> {
    const keypair = await this.deriveSolanaKeypair(seed, index);
    const bs58 = await import('bs58');

    return {
      chain: 'solana',
      index,
      address: bs58.default.encode(keypair.publicKey),
      publicKey: bs58.default.encode(keypair.publicKey),
    };
  }

  private async deriveSolanaKeypair(seed: string, index: number): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> {
    // Derive seed using PBKDF2 from mnemonic
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(`solana-${index}`),
        iterations: 2048,
        hash: 'SHA-512',
      },
      keyMaterial,
      512
    );

    const seedBytes = new Uint8Array(derivedBits).slice(0, 32);
    const nacl = await import('tweetnacl');
    return nacl.sign.keyPair.fromSeed(seedBytes);
  }

  private async deriveEthereumAccount(seed: string, index: number): Promise<WalletAccount> {
    // Simplified Ethereum derivation for demo
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(`ethereum-${index}`),
        iterations: 2048,
        hash: 'SHA-512',
      },
      keyMaterial,
      256
    );

    // Create address from derived key (simplified)
    const hashBuffer = await crypto.subtle.digest('SHA-256', derivedBits);
    const addressBytes = new Uint8Array(hashBuffer).slice(12);
    const address = '0x' + Array.from(addressBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    return {
      chain: 'ethereum',
      index,
      address: address.toLowerCase(),
      publicKey: Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join(''),
    };
  }

  private setAutoLockTimer(): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
    }

    this.lockTimeout = setTimeout(() => {
      this.lock();
    }, this.autoLockMinutes * 60 * 1000);
  }

  resetAutoLockTimer(): void {
    if (this.vault) {
      this.setAutoLockTimer();
    }
  }
}

export const keyring = new Keyring();
