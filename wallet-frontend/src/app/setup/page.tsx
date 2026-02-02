"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Key, Download, Eye, EyeOff, ArrowLeft, Copy, Check, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import * as z from "zod";

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
    toast.success(`${chain.charAt(0).toUpperCase() + chain.slice(1)} selected`);
    setStep("setup-wallet");
  };

  const handleSubmit = async () => {
    setError("");

    // Validate password
    const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
    const passwordResult = passwordSchema.safeParse(password);

    if (!passwordResult.success) {
      setError(passwordResult.error.issues[0].message);
      return;
    }

    try {
      // If input is empty, CREATE new wallet
      if (!mnemonicInput.trim()) {
        toast.loading("Generating wallet...");
        const result = await createWalletMutation.mutateAsync(password);

        // Fix Race Condition: Wait for wallet creation to fully propagate and auth state to settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // AUTO-CREATE ACCOUNT so dashboard isn't empty
        try {
          await createAccountMutation.mutateAsync({ chain: selectedChain });
        } catch (e) {
          console.error("Failed to auto-create account", e);
          // Don't block flow, user can create account later
        }

        toast.dismiss();
        toast.success("Wallet generated successfully!");
        router.push("/");
      } else {
        // IMPORT existing wallet

        // Validate mnemonic word count
        const mnemonicSchema = z.string().trim().refine((val) => {
          const wordCount = val.split(/\s+/).length;
          return [12, 15, 18, 21, 24].includes(wordCount);
        }, "Secret phrase must be 12, 15, 18, 21, or 24 words");

        const mnemonicResult = mnemonicSchema.safeParse(mnemonicInput);
        if (!mnemonicResult.success) {
          setError(mnemonicResult.error.issues[0].message);
          return;
        }

        toast.loading("Importing wallet...");
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

        toast.dismiss();
        toast.success("Wallet imported successfully!");
        router.push("/");
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to setup wallet");
      setError(err.message || "Failed to setup wallet");
    }
  };

  const handleUnlock = async () => {
    try {
      toast.loading("Unlocking wallet...");
      await unlockMutation.mutateAsync(password);
      toast.dismiss();
      toast.success("Wallet unlocked!");
      router.push("/");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Invalid password");
      setError("Invalid password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans bg-background text-foreground">

      <div className="absolute top-0 left-0 w-full p-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              {/* Hexagon Logo */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Valtix</span>
              <span className="text-xs font-mono border border-border px-1.5 py-0.5 rounded-sm text-muted-foreground">v1.3</span>
            </div>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
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

              <div className="md:mt-12 flex items-center gap-4">
                <p className="text-sm text-muted-foreground">Designed and Developed by <span className="text-foreground font-medium">shreed</span></p>
                <div className="flex items-center gap-3">
                  {/* LinkedIn */}
                  <a href="https://www.linkedin.com/in/shreedshrivastava/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                  </a>
                  {/* GitHub */}
                  <a href="https://github.com/shreed27" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                  </a>
                  {/* Codeforces */}
                  <a href="https://codeforces.com/profile/shreed27" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9-4.5c.828 0 1.5.672 1.5 1.5v15c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5v-15c0-.828.672-1.5 1.5-1.5h3zm9 7.5c.828 0 1.5.672 1.5 1.5v7.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V12c0-.828.672-1.5 1.5-1.5h3z" /></svg>
                  </a>
                  {/* LeetCode */}
                  <a href="https://leetcode.com/u/iamshreedshrivastava/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" /></svg>
                  </a>
                </div>
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
                  aria-label="Secret phrase"
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
                    aria-label="Wallet password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a secure password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 p-4 rounded-lg border border-input bg-background text-lg shadow-sm"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
              <div className="mt-20 flex items-center gap-4">
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
          )}

          {step === "unlock" && (
            <div className="bg-card rounded-xl p-8 max-w-md mx-auto border border-border">
              <div className="text-center mb-8">
                <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Key className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
                <p className="text-muted-foreground">
                  Enter your password to unlock Valtix.
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
