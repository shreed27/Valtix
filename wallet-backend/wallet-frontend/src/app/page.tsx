"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletStatus, useAccounts, useCreateAccount } from "@/hooks/useWallet";
import { copyToClipboard } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const router = useRouter();
  const { data: status, isLoading: statusLoading } = useWalletStatus();
  const { data: accounts } = useAccounts();
  const [showSecretPhrase, setShowSecretPhrase] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [savedMnemonic, setSavedMnemonic] = useState<string[] | null>(null);

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
    <div className="min-h-screen container max-w-3xl mx-auto px-4 py-8 space-y-8">

      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            {/* Hexagon Logo Placeholder - using Lucide Box as approx or SVG */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Valtix</h1>
            <div className="text-[10px] font-mono border border-border px-1.5 rounded-sm w-fit">v1.3</div>
          </div>
        </div>
      </header>

      {/* Navigation Links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/send">Send</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/swap">Swap</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/nfts">NFTs</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/history">History</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/contacts">Contacts</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-md">
          <Link href="/multisig">Multisig</Link>
        </Button>
      </div>

      {/* Secret Phrase Section */}
      {/* Secret Phrase Section - Pic 3 implementation */}
      <div className="border-0 bg-transparent">
        <button
          onClick={() => setShowSecretPhrase(!showSecretPhrase)}
          className="w-full flex items-center justify-between py-4 hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl font-bold tracking-tight">Your Secret Phrase</span>
          {showSecretPhrase ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <AnimatePresence>
          {showSecretPhrase && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {(savedMnemonic || ["hidden", "phrase", "for", "security", "purposes", "only", "visible", "after", "creation", "in", "this", "demo"]).map((word, i) => (
                    <div key={i} className="bg-secondary/50 p-3 rounded-md font-mono text-sm font-medium">
                      {word}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    if (savedMnemonic) copyToClipboard(savedMnemonic.join(" "));
                  }}
                >
                  <Copy className="h-4 w-4" /> Click Anywhere To Copy
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Solana Wallets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Solana Wallet</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleAddWallet("solana")}
              disabled={createAccountMutation.isPending}
            >
              {createAccountMutation.isPending ? "Adding..." : "Add Wallet"}
            </Button>
            <Button size="sm" variant="destructive" className="opacity-50 cursor-not-allowed">
              Clear Wallets
            </Button>
          </div>
        </div>

        {solanaAccounts.map((account, index) => (
          <div key={account.id} className="border border-border rounded-lg bg-card p-6 space-y-6 relative group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Wallet {index + 1}</h3>
              <button className="text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Public Key</div>
              <div className="bg-muted/50 p-3 rounded-md font-mono text-xs break-all flex items-center justify-between group/key">
                {account.address}
                <button onClick={() => handleCopy(account.address, `pub-${account.id}`)} className="opacity-0 group-hover/key:opacity-100 transition-opacity">
                  {copiedStates[`pub-${account.id}`] ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Private Key</div>
              <div className="bg-muted/50 p-3 rounded-md font-mono text-xs break-all flex items-center justify-between">
                <span>
                  {revealedKeys[account.id]
                    ? "3j2k3j4k2j3k4j2k3j4k2j3k4 (example key)"
                    : "••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
                </span>
                <button onClick={() => togglePrivateKey(account.id)}>
                  {revealedKeys[account.id] ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
          </div>
        ))}

        {solanaAccounts.length === 0 && (
          <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground">
            No Solana wallets found.
          </div>
        )}
      </div>
    </div>
  );
}
