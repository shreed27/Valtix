"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useWalletStatus, useAccounts, useCreateAccount, useDeleteAccount, useResetWallet } from "@/hooks/useWallet";
import { copyToClipboard } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Confirmation Dialog Component
function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { data: status, isLoading: statusLoading } = useWalletStatus();
  const { data: accounts } = useAccounts();
  const [showSecretPhrase, setShowSecretPhrase] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [savedMnemonic, setSavedMnemonic] = useState<string[] | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: "deleteAccount" | "resetWallet" | null;
    accountId?: string;
  }>({ isOpen: false, title: "", message: "", action: null });

  useEffect(() => {
    const saved = localStorage.getItem("demo_mnemonic");
    if (saved) {
      try {
        setSavedMnemonic(JSON.parse(saved));
        setShowSecretPhrase(true); // Auto-open if we just created it (Pic 3 style)
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const createAccountMutation = useCreateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const resetWalletMutation = useResetWallet();

  const handleAddWallet = (chain: string) => {
    createAccountMutation.mutate({ chain });
  };

  useEffect(() => {
    if (!statusLoading && status) {
      if (!status.has_wallet) {
        router.push("/setup");
      } else if (!status.is_unlocked) {
        router.push("/setup?unlock=true");
      }
    }
  }, [status, statusLoading, router]);

  const togglePrivateKey = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Handle confirmation dialog actions
  const handleConfirmAction = useCallback(async () => {
    if (confirmDialog.action === "deleteAccount" && confirmDialog.accountId) {
      try {
        console.log("Deleting account:", confirmDialog.accountId);
        await deleteAccountMutation.mutateAsync(confirmDialog.accountId);
        console.log("Account deleted successfully");
      } catch (err) {
        console.error("Error deleting account:", err);
        alert("Failed to delete wallet: " + (err instanceof Error ? err.message : String(err)));
      }
    } else if (confirmDialog.action === "resetWallet") {
      try {
        console.log("Resetting wallet...");
        await resetWalletMutation.mutateAsync();
        console.log("Wallet reset completed");
        localStorage.removeItem("demo_mnemonic");
        router.push("/setup");
      } catch (err) {
        console.error("Error resetting wallet:", err);
        alert("Failed to clear wallets: " + (err instanceof Error ? err.message : String(err)));
      }
    }
    setConfirmDialog({ isOpen: false, title: "", message: "", action: null });
  }, [confirmDialog, deleteAccountMutation, resetWalletMutation, router]);

  const openDeleteAccountDialog = (accountId: string, accountName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Wallet",
      message: `Are you sure you want to delete "${accountName}"? This action cannot be undone.`,
      action: "deleteAccount",
      accountId
    });
  };

  const openResetWalletDialog = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Clear All Wallets",
      message: "Are you sure you want to clear all wallets? This will delete everything and cannot be undone.",
      action: "resetWallet"
    });
  };

  console.log("Dashboard Render Check:", { statusLoading, hasWallet: status?.has_wallet, isUnlocked: status?.is_unlocked });

  if (statusLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!status?.is_unlocked) {
    // If we are here and not redirected yet, render nothing to avoid flicker
    return null;
  }

  // Group accounts by chain
  const solanaAccounts = accounts?.filter(a => a.chain === "solana") || [];
  const ethAccounts = accounts?.filter(a => a.chain === "ethereum") || [];

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-12 space-y-12 font-sans text-foreground">

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            {/* Hexagon Logo - Matches Pic */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Valtix</h1>
            <span className="text-xs font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">v1.3</span>
          </div>
        </div>
        {/* Navigation - Restored for feature visibility */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/send" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Send</Link>
          <Link href="/receive" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Receive</Link>
          <Link href="/swap" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Swap</Link>
          <Link href="/nfts" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">NFTs</Link>
          <Link href="/contacts" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contacts</Link>
          <Link href="/multisig" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Multisig</Link>
        </nav>

        <div className="flex items-center gap-4">
          {/* Dark/Light Mode Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Secret Phrase Section - Exactly matching Screenshot */}
      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <button
          onClick={() => setShowSecretPhrase(!showSecretPhrase)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity outline-none"
        >
          <span className="text-xl font-bold tracking-tight">Your Secret Phrase</span>
          {showSecretPhrase ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showSecretPhrase && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 24 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {(savedMnemonic || ["demo", "phrase", "shown", "here", "just", "for", "preview", "purposes", "only", "wallet", "test", "mode"]).map((word, i) => (
                  <div key={i} className="bg-secondary/30 p-3 rounded-md font-mono text-sm text-center relative group hover:bg-secondary/50 transition-colors cursor-pointer">
                    <span className="absolute top-1 left-2 text-[10px] text-muted-foreground opacity-50">{i + 1}</span>
                    {word}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-fit"
                onClick={() => {
                  if (savedMnemonic) copyToClipboard(savedMnemonic.join(" "));
                }}
              >
                Click here to copy to clipboard
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Solana Wallets Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Solana Wallet</h2>
          <div className="flex gap-3">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium px-6"
              onClick={() => handleAddWallet("solana")}
              disabled={createAccountMutation.isPending}
            >
              Add Wallet
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive hover:bg-destructive/90 text-white rounded-md font-medium px-6"
              onClick={() => openResetWalletDialog()}
              disabled={resetWalletMutation.isPending}
            >
              {resetWalletMutation.isPending ? "Clearing..." : "Clear Wallets"}
            </Button>
          </div>
        </div>

        {solanaAccounts.map((account, index) => (
          <div key={account.id} className="border border-border rounded-lg bg-card p-8 relative flex flex-col gap-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">Wallet {index + 1}</h3>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive transition-colors p-2"
                onClick={() => openDeleteAccountDialog(account.id, account.name)}
                disabled={deleteAccountMutation.isPending}
              >
                {deleteAccountMutation.isPending && deleteAccountMutation.variables === account.id ? (
                  <span className="h-5 w-5 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-base font-bold">Public Key</div>
              <div className="font-mono text-sm text-muted-foreground break-all">
                {account.address}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-base font-bold">Private Key</div>
              <div className="flex items-center justify-between font-mono text-sm tracking-widest text-muted-foreground">
                <span>
                  {revealedKeys[account.id]
                    ? "PREVIEW_MODE_PRIVATE_KEY_HIDDEN" // In a real app we'd need to decrypt this
                    : "• • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • •"}
                </span>
                <button onClick={() => togglePrivateKey(account.id)} className="ml-4 hover:text-foreground">
                  {revealedKeys[account.id] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
        {solanaAccounts.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground">
            No wallets created yet. Click "Add Wallet" to create one.
          </div>
        )}
      </div>

      <div className="pt-20 pb-8 border-t border-border mt-12">
        <p className="text-sm text-muted-foreground">Designed and Developed by Keshav</p>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", action: null })}
        isLoading={deleteAccountMutation.isPending || resetWalletMutation.isPending}
      />
    </div>
  );
}
