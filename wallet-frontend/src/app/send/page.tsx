"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, ExternalLink } from "lucide-react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { useSelectedAccountBalance } from "@/hooks/useWallet";
import { transactionApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { truncateAddress, formatBalance, getExplorerUrl } from "@/lib/utils";

export default function SendPage() {
  const router = useRouter();
  const { selectedAccount } = useWalletStore();
  const { data: balance } = useSelectedAccountBalance();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!selectedAccount) throw new Error("No account selected");
      return transactionApi.send({
        chain: selectedAccount.chain,
        from_address: selectedAccount.address,
        to_address: recipient,
        amount,
      });
    },
    onSuccess: (data) => {
      setTxHash(data.tx_hash);
    },
    onError: (err: any) => {
      setError(err.message || "Transaction failed");
    },
  });

  const handleSend = () => {
    setError("");
    if (!recipient) {
      setError("Please enter a recipient address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    sendMutation.mutate();
  };

  const setMaxAmount = () => {
    if (balance) {
      setAmount(balance.native_balance);
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
        <CardContent className="space-y-6">
          {/* From */}
          <div>
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">From</label>
            <div className="p-4 rounded-lg bg-secondary mt-2 border border-border">
              <p className="font-medium">{selectedAccount?.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                {truncateAddress(selectedAccount?.address || "")}
              </p>
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
              className="mt-2"
              placeholder="Recipient address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Amount</label>
              <button
                className="text-xs text-primary hover:text-primary/80 transition-colors uppercase font-bold tracking-wide"
                onClick={setMaxAmount}
              >
                Max
              </button>
            </div>
            <Input
              className="font-mono"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg text-center">{error}</p>}

          <Button
            className="w-full"
            onClick={handleSend}
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
        </CardContent>
      </Card>
    </div>
  );
}
