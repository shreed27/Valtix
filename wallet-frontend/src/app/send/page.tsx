"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useWalletStore } from "@/hooks/useWalletStore";
import { useAccounts, useBalance } from "@/hooks/useWallet";
import { transactionApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { truncateAddress, formatBalance, getExplorerUrl, isValidEthereumAddress, isValidSolanaAddress } from "@/lib/utils";

export default function SendPage() {
  const router = useRouter();
  const { selectedAccount, selectAccount } = useWalletStore();
  const { data: accounts } = useAccounts();
  const { data: balance } = useBalance(
    selectedAccount?.chain || "",
    selectedAccount?.address || ""
  );

  const [txHash, setTxHash] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // Dynamic schema based on selected chain
  const formSchema = z.object({
    recipient: z.string().min(1, "Recipient address is required").refine((val) => {
      if (!selectedAccount) return true;
      if (selectedAccount.chain === "ethereum") return isValidEthereumAddress(val);
      if (selectedAccount.chain === "solana") return isValidSolanaAddress(val);
      return true;
    }, {
      message: selectedAccount?.chain === "ethereum" ? "Invalid Ethereum address" : "Invalid Solana address"
    }),
    amount: z.string()
      .min(1, "Amount is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be a positive number")
      .refine((val) => {
        if (!balance) return true;
        return parseFloat(val) <= parseFloat(balance.native_balance);
      }, "Insufficient balance")
  });

  type FormData = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
    trigger,
    reset
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      recipient: "",
      amount: ""
    }
  });

  // Re-validate when account changes
  useEffect(() => {
    reset({ recipient: "", amount: "" });
  }, [selectedAccount, reset]);

  const sendMutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!selectedAccount) throw new Error("No account selected");
      toast.loading("Sending transaction...");
      return transactionApi.send({
        chain: selectedAccount.chain,
        from_address: selectedAccount.address,
        to_address: data.recipient,
        amount: data.amount,
      });
    },
    onSuccess: (data) => {
      toast.dismiss();
      toast.success("Transaction sent successfully!");
      setTxHash(data.tx_hash);
    },
    onError: (err: any) => {
      toast.dismiss();
      toast.error(err.message || "Transaction failed");
    },
  });

  const onSubmit = (data: FormData) => {
    sendMutation.mutate(data);
  };

  const setMaxAmount = () => {
    if (balance) {
      setValue("amount", balance.native_balance);
      trigger("amount");
    }
  };

  if (txHash) {
    return (
      <div className="min-h-screen container max-w-md mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-green-500/10 w-fit">
                <Send className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Transaction Sent!</h2>
              <p className="text-sm text-muted-foreground mb-4 font-mono">
                {truncateAddress(txHash, 12)}
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      getExplorerUrl(selectedAccount?.chain || "solana", txHash),
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Explorer
                </Button>
                <Button className="w-full" onClick={() => router.push("/")}>
                  Back to Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen container max-w-lg mx-auto py-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <Button
        variant="ghost"
        className="mb-6 -ml-2 text-muted-foreground hover:text-primary transition-colors hover:bg-transparent group"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </Button>

      <div className="glass-card rounded-2xl p-1 overflow-hidden">
        <div className="bg-card/50 p-6 sm:p-8 rounded-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-3 rounded-full ${selectedAccount?.chain === 'solana' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
              <Send className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Send {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}</h1>
              <p className="text-sm text-muted-foreground">Transfer assets to another wallet</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* From - Account Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">From Account</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAccountPicker(!showAccountPicker)}
                  className="w-full p-4 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary/80 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${selectedAccount?.chain === 'solana' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-cyan-600'}`}>
                      {selectedAccount?.chain === 'solana' ? 'SOL' : 'ETH'}
                    </div>
                    <div>
                      <p className="font-semibold">{selectedAccount?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {truncateAddress(selectedAccount?.address || "")}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:text-primary ${showAccountPicker ? 'rotate-180' : ''}`} />
                </button>

                {/* Account Dropdown */}
                {showAccountPicker && accounts && accounts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto p-1">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            selectAccount(account);
                            setShowAccountPicker(false);
                          }}
                          className={`w-full p-3 text-left hover:bg-secondary/80 rounded-lg transition-colors flex items-center gap-3 ${selectedAccount?.id === account.id ? 'bg-secondary' : ''
                            }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${account.chain === 'solana' ? 'bg-purple-500' : 'bg-blue-500'
                            }`}>
                            {account.chain === 'solana' ? 'SOL' : 'ETH'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{account.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {truncateAddress(account.address)}
                            </p>
                          </div>
                          {selectedAccount?.id === account.id && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">To Address</label>
              <Input
                className={`h-14 px-4 rounded-xl glass-input ${errors.recipient ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-primary"}`}
                placeholder={`Enter ${selectedAccount?.chain === "solana" ? "Solana" : "Ethereum"} address`}
                {...register("recipient")}
              />
              {errors.recipient && (
                <p className="text-xs text-destructive font-medium ml-1 animate-in slide-in-from-top-1">{errors.recipient.message}</p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Amount</label>
                {balance && (
                  <div className="text-xs text-muted-foreground">
                    Available: <span className="font-medium text-foreground">{formatBalance(balance.native_balance)} {balance.native_symbol}</span>
                  </div>
                )}
              </div>

              <div className="relative">
                <Input
                  className={`h-16 px-4 pr-20 text-2xl font-mono glass-input ${errors.amount ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-primary"}`}
                  type="number"
                  step="any"
                  placeholder="0.00"
                  {...register("amount")}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-bold bg-secondary hover:bg-secondary/80 text-primary px-2 py-1 rounded transition-colors"
                    onClick={setMaxAmount}
                  >
                    MAX
                  </button>
                  <span className="text-sm font-medium text-muted-foreground pointer-events-none">
                    {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}
                  </span>
                </div>
              </div>

              {errors.amount && (
                <p className="text-xs text-destructive font-medium ml-1 animate-in slide-in-from-top-1">{errors.amount.message}</p>
              )}

              {/* Estimated Fee Display */}
              <div className="flex justify-between items-center px-3 py-2 bg-secondary/30 rounded-lg text-xs mt-2">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-mono text-foreground/80">
                  ~ {selectedAccount?.chain === "solana" ? "0.000005" : "0.00042"} {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98]"
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing Transaction...
                </>
              ) : (
                <>
                  Send {selectedAccount?.chain === "solana" ? "SOL" : "ETH"} Now
                  <Send className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

}
