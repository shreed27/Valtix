"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Key, Download, Eye, EyeOff, ArrowLeft, Copy, Check, ChevronRight } from "lucide-react";

import { useWalletStatus, useCreateWallet, useImportWallet, useUnlockWallet, useCreateAccount } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/utils";

type Step = "chain-selection" | "method-selection" | "create-password" | "show-mnemonic" | "import" | "unlock";

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: status } = useWalletStatus();
  // Reverting to Chain Selection first as requested
  const [step, setStep] = useState<"chain-selection" | "setup-wallet" | "unlock">("chain-selection");
  const [selectedChain, setSelectedChain] = useState<"solana" | "ethereum">("solana");

  // Setup Form State
  const [mnemonicInput, setMnemonicInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const createWalletMutation = useCreateWallet();
  const importWalletMutation = useImportWallet();
  const unlockMutation = useUnlockWallet();
  const createAccountMutation = useCreateAccount();

  useEffect(() => {
    if (searchParams.get("unlock") === "true" && status?.has_wallet) {
      setStep("unlock");
    } else {
      // Clear any stale demo state if we are setting up a new wallet
      localStorage.removeItem("demo_mnemonic");
    }
  }, [searchParams, status]);

  const handleChainSelect = (chain: "solana" | "ethereum") => {
    setSelectedChain(chain);
    // Save preference and proceed to wallet setup
    localStorage.setItem("selected_chain", chain);
    setStep("setup-wallet");
  };

  const handleSubmit = async () => {
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      // If input is empty, CREATE new wallet
      if (!mnemonicInput.trim()) {
        const result = await createWalletMutation.mutateAsync(password);

        // AUTO-CREATE ACCOUNT so dashboard isn't empty
        try {
          await createAccountMutation.mutateAsync({ chain: selectedChain });
        } catch (e) {
          console.error("Failed to auto-create account", e);
        }

        localStorage.setItem("demo_mnemonic", JSON.stringify(result.mnemonic));
        router.push("/");
      } else {
        // IMPORT existing wallet
        await importWalletMutation.mutateAsync({
          mnemonic: mnemonicInput.trim(),
          password,
        });

        // AUTO-CREATE ACCOUNT so dashboard isn't empty
        try {
          await createAccountMutation.mutateAsync({ chain: selectedChain });
        } catch (e) {
          console.error("Failed to auto-create account", e);
        }

        localStorage.setItem("demo_mnemonic", JSON.stringify(mnemonicInput.trim().split(" ")));
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Failed to setup wallet");
    }
  };

  const handleUnlock = async () => {
    try {
      await unlockMutation.mutateAsync(password);
      router.push("/");
    } catch (err: any) {
      setError("Invalid password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans bg-background text-foreground">

      <div className="absolute top-0 left-0 w-full p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            {/* Simple Box Logo - Matches Kosh Site */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Kosh</span>
            <span className="text-xs font-mono border border-border px-1.5 py-0.5 rounded-sm text-muted-foreground">v1.3</span>
          </div>
        </div>

        {/* Theme Toggle Placeholder */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-4 w-4 rounded-full border border-current opacity-50"></span>
          <div className="w-8 h-4 bg-muted rounded-full relative"><div className="absolute left-0.5 top-0.5 h-3 w-3 bg-background rounded-full shadow-sm"></div></div>
          <span className="h-4 w-4 rounded-full border border-current opacity-50"></span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-5xl relative z-10"
        >
          {step === "chain-selection" && (
            <div className="flex flex-col min-h-[60vh] justify-center text-left max-w-2xl mx-auto px-4">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight text-foreground">
                Valtix supports<br />multiple blockchains
              </h1>
              <p className="text-2xl text-muted-foreground mb-12 font-medium">
                Choose a blockchain to get started.
              </p>

              <div className="flex flex-row gap-4 mb-20">
                <Button
                  className="h-14 px-10 text-lg font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md"
                  onClick={() => handleChainSelect("solana")}
                >
                  Solana
                </Button>
                <Button
                  className="h-14 px-10 text-lg font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md"
                  onClick={() => handleChainSelect("ethereum")}
                >
                  Ethereum
                </Button>
              </div>

              <div className="md:mt-12">
                <p className="text-sm text-foreground font-medium">Designed and Developed by Keshav</p>
              </div>
            </div>
          )}

          {step === "setup-wallet" && (
            <div className="max-w-2xl mx-auto px-4">
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Secret Recovery Phrase</h1>
              <p className="text-xl text-muted-foreground mb-8">
                Save these words in a safe place.
              </p>

              <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
                <Input
                  name="mnemonic_field_unique_id_valtix"
                  id="mnemonic_field"
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-full h-14 p-4 rounded-lg border border-input bg-background text-lg placeholder:text-muted-foreground/70 shadow-sm"
                  placeholder="Enter your secret phrase (or leave blank to generate)"
                  value={mnemonicInput}
                  onChange={(e) => setMnemonicInput(e.target.value)}
                />

                <div className="relative">
                  <Input
                    name="new_wallet_password_unique_valtix"
                    id="wallet_password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a secure password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 p-4 rounded-lg border border-input bg-background text-lg shadow-sm"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 p-4 rounded-lg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {error}
                  </p>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    className="h-14 px-8 text-lg font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md min-w-[200px]"
                    disabled={createWalletMutation.isPending || importWalletMutation.isPending}
                  >
                    {(createWalletMutation.isPending || importWalletMutation.isPending) ? (
                      "Processing..."
                    ) : mnemonicInput.trim() ? (
                      "Import Wallet"
                    ) : (
                      "Generate Wallet"
                    )}
                  </Button>
                </div>
              </form>
              <div className="mt-20">
                <p className="text-sm text-foreground font-medium">Designed and Developed by Keshav</p>
              </div>
            </div>
          )}

          {step === "unlock" && (
            <div className="bg-card rounded-xl p-8 max-w-md mx-auto border border-border">
              <div className="text-center mb-8">
                <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Key className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
                <p className="text-muted-foreground">
                  Enter your password to unlock Kosh.
                </p>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    className="h-14 text-center text-lg"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg text-center">{error}</p>
                )}
                <Button
                  className="w-full h-14 rounded-lg text-lg font-medium"
                  onClick={handleUnlock}
                  disabled={unlockMutation.isPending}
                >
                  {unlockMutation.isPending ? "Unlocking..." : "Unlock Wallet"}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div >
  );
}
