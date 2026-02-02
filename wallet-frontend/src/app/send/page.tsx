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
    <div className="min-h-screen container max-w-md mx-auto py-8 relative z-10">
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
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle>Send {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* From - Account Selector */}
            <div>
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">From</label>
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountPicker(!showAccountPicker)}
                  className="w-full p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{selectedAccount?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {truncateAddress(selectedAccount?.address || "")}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAccountPicker ? 'rotate-180' : ''}`} />
                </button>

                {/* Account Dropdown */}
                {showAccountPicker && accounts && accounts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          selectAccount(account);
                          setShowAccountPicker(false);
                        }}
                        className={`w-full p-3 text-left hover:bg-secondary transition-colors flex items-center gap-3 ${selectedAccount?.id === account.id ? 'bg-secondary' : ''
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${account.chain === 'solana' ? 'bg-purple-500' : 'bg-blue-500'
                          }`}>
                          {account.chain === 'solana' ? 'SOL' : 'ETH'}
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
            </div>

            {/* Balance */}
            {balance && (
              <div className="text-sm text-right text-muted-foreground">
                Available: <span className="text-foreground font-medium">{formatBalance(balance.native_balance)} {balance.native_symbol}</span>
              </div>
            )}

            {/* Recipient */}
            <div>
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">To</label>
              <Input
                className={`mt-2 ${errors.recipient ? "border-destructive" : ""}`}
                placeholder="Recipient address"
                {...register("recipient")}
              />
              {errors.recipient && (
                <p className="text-sm text-destructive mt-1">{errors.recipient.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Amount</label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors uppercase font-bold tracking-wide"
                  onClick={setMaxAmount}
                >
                  Max
                </button>
              </div>
              <Input
                className={`font-mono ${errors.amount ? "border-destructive" : ""}`}
                type="number"
                step="any"
                placeholder="0.00"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
