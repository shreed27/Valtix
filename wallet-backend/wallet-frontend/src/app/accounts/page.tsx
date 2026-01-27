"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Wallet, Plus, Copy, Check } from "lucide-react";

import { useAccounts, useCreateAccount } from "@/hooks/useWallet";
import { useWalletStore } from "@/hooks/useWalletStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncateAddress, copyToClipboard } from "@/lib/utils";

export default function AccountsPage() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();
  const { selectAccount, selectedAccount } = useWalletStore();
  const createAccountMutation = useCreateAccount();

  const [showAdd, setShowAdd] = useState(false);
  const [newChain, setNewChain] = useState("solana");
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (address: string) => {
    await copyToClipboard(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async () => {
    await createAccountMutation.mutateAsync({
      chain: newChain,
      name: newName || undefined,
    });
    setShowAdd(false);
    setNewName("");
  };

  const solanaAccounts = accounts?.filter((a) => a.chain === "solana") || [];
  const ethereumAccounts = accounts?.filter((a) => a.chain === "ethereum") || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container max-w-2xl mx-auto py-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Accounts
              </CardTitle>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Account Form */}
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6 p-4 rounded-lg bg-secondary/50 space-y-3"
              >
                <Select value={newChain} onValueChange={setNewChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Account name (optional)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreate}
                    disabled={createAccountMutation.isPending}
                  >
                    {createAccountMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </motion.div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading accounts...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Solana Accounts */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Solana
                  </h3>
                  <div className="space-y-2">
                    {solanaAccounts.map((account, index) => (
                      <motion.div
                        key={account.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                          selectedAccount?.id === account.id
                            ? "bg-primary/10 border border-primary"
                            : "bg-secondary/50 hover:bg-secondary"
                        }`}
                        onClick={() => {
                          selectAccount(account);
                          router.push("/");
                        }}
                      >
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {truncateAddress(account.address)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(account.address);
                          }}
                        >
                          {copied === account.address ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </motion.div>
                    ))}
                    {solanaAccounts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No Solana accounts
                      </p>
                    )}
                  </div>
                </div>

                {/* Ethereum Accounts */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Ethereum
                  </h3>
                  <div className="space-y-2">
                    {ethereumAccounts.map((account, index) => (
                      <motion.div
                        key={account.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                          selectedAccount?.id === account.id
                            ? "bg-primary/10 border border-primary"
                            : "bg-secondary/50 hover:bg-secondary"
                        }`}
                        onClick={() => {
                          selectAccount(account);
                          router.push("/");
                        }}
                      >
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {truncateAddress(account.address)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(account.address);
                          }}
                        >
                          {copied === account.address ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </motion.div>
                    ))}
                    {ethereumAccounts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No Ethereum accounts
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
