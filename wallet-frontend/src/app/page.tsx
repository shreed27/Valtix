"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Menu,
  X
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWalletStatus, useAccounts, useCreateAccount, useDeleteAccount, useResetWallet } from "@/hooks/useWallet";
import { copyToClipboard } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Valtix",
  description: "A simple and secure crypto wallet",
};

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: "deleteAccount" | "resetWallet" | null;
    accountId?: string;
  }>({ isOpen: false, title: "", message: "", action: null });

  useEffect(() => {
    // Check if we have any lingering insecure data and clear it
    if (localStorage.getItem("demo_mnemonic")) {
      localStorage.removeItem("demo_mnemonic");
    }
  }, []);

  const createAccountMutation = useCreateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const resetWalletMutation = useResetWallet();

  const handleAddWallet = (chain: string) => {
    toast.promise(createAccountMutation.mutateAsync({ chain }), {
      loading: "Creating wallet...",
      success: `${chain.charAt(0).toUpperCase() + chain.slice(1)} wallet created!`,
      error: "Failed to create wallet",
    });
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
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Handle confirmation dialog actions
  const handleConfirmAction = useCallback(async () => {
    if (confirmDialog.action === "deleteAccount" && confirmDialog.accountId) {
      try {
        toast.loading("Deleting wallet...");
        await deleteAccountMutation.mutateAsync(confirmDialog.accountId);
        toast.dismiss();
        toast.success("Wallet deleted successfully!");
      } catch (err) {
        toast.dismiss();
        toast.error("Failed to delete wallet");
        console.error("Error deleting account:", err);
      }
    } else if (confirmDialog.action === "resetWallet") {
      try {
        toast.loading("Clearing all wallets...");
        await resetWalletMutation.mutateAsync();
        localStorage.removeItem("demo_mnemonic");
        toast.dismiss();
        toast.success("All wallets cleared!");
        router.push("/setup");
      } catch (err) {
        toast.dismiss();
        toast.error("Failed to clear wallets");
        console.error("Error resetting wallet:", err);
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

      <header className="relative z-50">
        <div className="flex items-center justify-between">
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

          {/* Desktop Navigation */}
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

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 left-0 right-0 bg-card border border-border rounded-lg shadow-lg p-4 md:hidden flex flex-col gap-4"
            >
              <Link href="/send" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Send</Link>
              <Link href="/receive" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Receive</Link>
              <Link href="/swap" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Swap</Link>
              <Link href="/nfts" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>NFTs</Link>
              <Link href="/contacts" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Contacts</Link>
              <Link href="/multisig" className="text-base font-medium p-2 hover:bg-secondary rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Multisig</Link>
            </motion.div>
          )}
        </AnimatePresence>
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
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Designed and Developed by <span className="text-foreground font-medium">shreed</span></p>
          <div className="flex items-center gap-3">
            <a href="https://www.linkedin.com/in/shreedshrivastava/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a href="https://github.com/shreed27" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            </a>
            <a href="https://codeforces.com/profile/shreed27" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9-4.5c.828 0 1.5.672 1.5 1.5v15c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5v-15c0-.828.672-1.5 1.5-1.5h3zm9 7.5c.828 0 1.5.672 1.5 1.5v7.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V12c0-.828.672-1.5 1.5-1.5h3z" /></svg>
            </a>
            <a href="https://leetcode.com/u/iamshreedshrivastava/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" /></svg>
            </a>
          </div>
        </div>
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
