import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Wallet, WalletAccount, PendingRequest } from '../shared/types';

// Styles
const styles = {
  container: {
    padding: '20px',
    minHeight: '600px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  logo: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    fontSize: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '14px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    marginBottom: '12px',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
  },
  buttonSecondary: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'transparent',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
  },
  accountCard: {
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(139, 92, 246, 0.3)',
  },
  accountChain: {
    fontSize: '12px',
    color: '#A78BFA',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  },
  accountAddress: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#E5E7EB',
    wordBreak: 'break-all' as const,
  },
  error: {
    color: '#F87171',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center' as const,
  },
  balance: {
    fontSize: '32px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  balanceLabel: {
    fontSize: '14px',
    color: '#9CA3AF',
    textAlign: 'center' as const,
  },
};

interface AppState {
  isInitialized: boolean;
  isUnlocked: boolean;
  wallet: Wallet | null;
  accounts: WalletAccount[];
  pendingRequest: PendingRequest | null;
  view: 'loading' | 'setup' | 'unlock' | 'main' | 'approve';
}

function App() {
  const [state, setState] = useState<AppState>({
    isInitialized: false,
    isUnlocked: false,
    wallet: null,
    accounts: [],
    pendingRequest: null,
    view: 'loading',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [showMnemonic, setShowMnemonic] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        type: 'GET_STATUS',
      });

      if (response.success) {
        const { isInitialized, isUnlocked, wallet, accounts } = response.data;
        setState((prev) => ({
          ...prev,
          isInitialized,
          isUnlocked,
          wallet,
          accounts: accounts || [],
          view: !isInitialized ? 'setup' : !isUnlocked ? 'unlock' : 'main',
        }));
      }
    } catch (err) {
      setError('Failed to connect to extension');
    }
  };

  const handleCreateWallet = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    try {
      // Create vault via service worker
      const response = await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        type: 'CREATE_VAULT',
        payload: { password },
      });

      if (response.success) {
        setMnemonic(response.data.mnemonic);
        setShowMnemonic(true);
      } else {
        setError(response.error || 'Failed to create wallet');
      }
    } catch (err) {
      setError('Failed to create wallet');
    }
  };

  const handleConfirmMnemonic = () => {
    setShowMnemonic(false);
    checkStatus();
  };

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setError('');
    try {
      const response = await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        type: 'UNLOCK',
        payload: { password },
      });

      if (response.success) {
        setState((prev) => ({
          ...prev,
          isUnlocked: true,
          wallet: response.data.wallet,
          accounts: response.data.accounts,
          view: 'main',
        }));
        setPassword('');
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Failed to unlock wallet');
    }
  };

  const handleLock = async () => {
    await chrome.runtime.sendMessage({
      id: crypto.randomUUID(),
      type: 'LOCK',
    });
    setState((prev) => ({
      ...prev,
      isUnlocked: false,
      view: 'unlock',
    }));
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Render loading
  if (state.view === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>V</div>
          <div style={{ color: '#9CA3AF' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Render setup (create wallet)
  if (state.view === 'setup') {
    if (showMnemonic) {
      return (
        <div style={styles.container}>
          <div style={styles.header}>
            <div style={styles.logo}>V</div>
            <h1 style={styles.title}>Recovery Phrase</h1>
            <p style={styles.subtitle}>Write these words down and keep them safe</p>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {mnemonic.map((word, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ color: '#6B7280' }}>{i + 1}. </span>
                  {word}
                </div>
              ))}
            </div>
          </div>

          <button style={styles.button} onClick={handleConfirmMnemonic}>
            I&apos;ve Saved My Recovery Phrase
          </button>
        </div>
      );
    }

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>V</div>
          <h1 style={styles.title}>Valtix Wallet</h1>
          <p style={styles.subtitle}>Create a new wallet</p>
        </div>

        <div style={styles.card}>
          <input
            type="password"
            placeholder="Create password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button style={styles.button} onClick={handleCreateWallet}>
            Create Wallet
          </button>
        </div>
      </div>
    );
  }

  // Render unlock
  if (state.view === 'unlock') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>V</div>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.subtitle}>Enter your password to unlock</p>
        </div>

        <div style={styles.card}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button style={styles.button} onClick={handleUnlock}>
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // Render main wallet view
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>V</div>
        <h1 style={styles.title}>{state.wallet?.name || 'Valtix Wallet'}</h1>
      </div>

      <div style={styles.card}>
        <div style={styles.balance}>0.00 SOL</div>
        <div style={styles.balanceLabel}>Total Balance</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '12px' }}>Accounts</h3>
        {state.accounts.map((account, i) => (
          <div key={i} style={styles.accountCard}>
            <div style={styles.accountChain}>{account.chain}</div>
            <div style={styles.accountAddress}>{truncateAddress(account.address)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button style={styles.buttonSecondary} onClick={handleLock}>
          Lock Wallet
        </button>
      </div>
    </div>
  );
}

// Render
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
