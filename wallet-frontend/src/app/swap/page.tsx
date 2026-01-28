"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpDown, Loader2, RefreshCw, ChevronDown } from "lucide-react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { useAccounts, useBalance } from "@/hooks/useWallet";
import { swapApi, type SwapQuote } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBalance, truncateAddress } from "@/lib/utils";

// Token mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function SwapPage() {
  const router = useRouter();
  const { selectedAccount, selectAccount } = useWalletStore();
  const { data: accounts } = useAccounts();
  const { data: balance } = useBalance(
    selectedAccount?.chain || "",
    selectedAccount?.address || ""
  );

  const [inputAmount, setInputAmount] = useState("");
  const [swapDirection, setSwapDirection] = useState<"sol_to_usdc" | "usdc_to_sol">(
    "sol_to_usdc"
  );
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState("");
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // Get Solana accounts only for swap
  const solanaAccounts = accounts?.filter(a => a.chain === "solana") || [];

  // Auto-select first Solana account if current selection is not Solana
  useEffect(() => {
    if (selectedAccount?.chain !== "solana" && solanaAccounts.length > 0) {
      selectAccount(solanaAccounts[0]);
    }
  }, [selectedAccount, solanaAccounts, selectAccount]);

  const inputMint = swapDirection === "sol_to_usdc" ? SOL_MINT : USDC_MINT;
  const outputMint = swapDirection === "sol_to_usdc" ? USDC_MINT : SOL_MINT;

  const inputSymbol = swapDirection === "sol_to_usdc" ? "SOL" : "USDC";
  const outputSymbol = swapDirection === "sol_to_usdc" ? "USDC" : "SOL";

  // Get quote
  const quoteQuery = useQuery({
    queryKey: ["swap-quote", inputMint, outputMint, inputAmount],
    queryFn: async () => {
      const amount = parseFloat(inputAmount);
      if (isNaN(amount) || amount <= 0) return null;

      // Convert to lamports/smallest units
      const decimals = swapDirection === "sol_to_usdc" ? 9 : 6;
      const amountInSmallest = Math.floor(amount * Math.pow(10, decimals));

      const quote = await swapApi.getQuote(inputMint, outputMint, amountInSmallest);
      setQuote(quote);
      return quote;
    },
    enabled: !!inputAmount && parseFloat(inputAmount) > 0 && selectedAccount?.chain === "solana",
    refetchInterval: 10000, // Refresh quote every 10 seconds
  });

  // Execute swap
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !selectedAccount) throw new Error("No quote available");
      return swapApi.executeSwap(selectedAccount.address, quote);
    },
    onSuccess: () => {
      setInputAmount("");
      setQuote(null);
      router.push("/");
    },
    onError: (err: any) => {
      setError(err.message || "Swap failed");
    },
  });

  const toggleDirection = () => {
    setSwapDirection((prev) =>
      prev === "sol_to_usdc" ? "usdc_to_sol" : "sol_to_usdc"
    );
    setQuote(null);
    setInputAmount("");
  };

  const outputAmount = quote
    ? formatBalance(
      parseInt(quote.outAmount) / Math.pow(10, swapDirection === "sol_to_usdc" ? 6 : 9),
      6
    )
    : "0.00";

  // Only show swap for Solana accounts
  if (solanaAccounts.length === 0) {
    return (
      <div className="min-h-screen container max-w-md mx-auto py-8">
        <Button
          variant="ghost"
          className="mb-4 -ml-2 hover:bg-transparent hover:text-primary"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Swap requires a Solana wallet. Please create one first.
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/")}
              >
                Back to Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If selected account is not Solana, show loading while we auto-switch
  if (selectedAccount?.chain !== "solana") {
    return (
      <div className="min-h-screen container max-w-md mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen container max-w-md mx-auto py-8">
      <Button
        variant="ghost"
        className="mb-4 -ml-2 hover:bg-transparent hover:text-primary"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Swap (Jupiter)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Selector */}
          {solanaAccounts.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                className="w-full p-3 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    SOL
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedAccount?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {truncateAddress(selectedAccount?.address || "")}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAccountPicker ? 'rotate-180' : ''}`} />
              </button>

              {showAccountPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                  {solanaAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        selectAccount(account);
                        setShowAccountPicker(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-secondary transition-colors flex items-center gap-3 ${
                        selectedAccount?.id === account.id ? 'bg-secondary' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        SOL
                      </div>
                      <div>
                        <p className="font-medium text-sm">{account.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {truncateAddress(account.address)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">You pay</span>
              {balance && (
                <span className="text-xs text-muted-foreground">
                  Balance: {formatBalance(balance.native_balance)} SOL
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="0.00"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background">
                <div
                  className={`w-5 h-5 rounded-full ${inputSymbol === "SOL" ? "bg-purple-500" : "bg-blue-500"
                    }`}
                />
                <span className="font-medium">{inputSymbol}</span>
              </div>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background"
              onClick={toggleDirection}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Output */}
          <div className="p-4 rounded-lg bg-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">You receive</span>
              {quoteQuery.isFetching && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold flex-1">{outputAmount}</span>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background">
                <div
                  className={`w-5 h-5 rounded-full ${outputSymbol === "SOL" ? "bg-purple-500" : "bg-blue-500"
                    }`}
                />
                <span className="font-medium">{outputSymbol}</span>
              </div>
            </div>
          </div>

          {/* Quote Details */}
          {quote && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-secondary/50 text-sm"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span>{quote.priceImpactPct}%</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Slippage</span>
                <span>{quote.slippageBps / 100}%</span>
              </div>
            </motion.div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={() => swapMutation.mutate()}
            disabled={!quote || swapMutation.isPending}
          >
            {swapMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Swapping...
              </>
            ) : (
              "Swap"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Powered by Jupiter Aggregator
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
