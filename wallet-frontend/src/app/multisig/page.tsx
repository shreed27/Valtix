"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Plus,
  ChevronRight,
  Check,
  Clock,
  X,
} from "lucide-react";

import { multisigApi, type MultisigWallet, type MultisigTransaction } from "@/lib/api";
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
import { truncateAddress, formatBalance } from "@/lib/utils";

export default function MultisigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedMultisig, setSelectedMultisig] = useState<MultisigWallet | null>(
    null
  );
  const [showPropose, setShowPropose] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [chain, setChain] = useState("solana");
  const [threshold, setThreshold] = useState("2");
  const [owners, setOwners] = useState<string[]>(["", ""]);

  // Propose form state
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const { data: multisigs, isLoading } = useQuery({
    queryKey: ["multisigs"],
    queryFn: multisigApi.list,
  });

  const { data: transactions } = useQuery({
    queryKey: ["multisig-transactions", selectedMultisig?.id],
    queryFn: () =>
      selectedMultisig
        ? multisigApi.getTransactions(selectedMultisig.id)
        : Promise.resolve([]),
    enabled: !!selectedMultisig,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      multisigApi.create({
        chain,
        name,
        threshold: parseInt(threshold),
        owners: owners.filter((o) => o.trim()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multisigs"] });
      setShowCreate(false);
      setName("");
      setOwners(["", ""]);
    },
  });

  const proposeMutation = useMutation({
    mutationFn: () => {
      if (!selectedMultisig) throw new Error("No multisig selected");
      return multisigApi.proposeTransaction(selectedMultisig.id, {
        to_address: toAddress,
        amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["multisig-transactions", selectedMultisig?.id],
      });
      setShowPropose(false);
      setToAddress("");
      setAmount("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({
      txId,
      approverAddress,
    }: {
      txId: string;
      approverAddress: string;
    }) => {
      if (!selectedMultisig) throw new Error("No multisig selected");
      return multisigApi.approveTransaction(
        selectedMultisig.id,
        txId,
        approverAddress
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["multisig-transactions", selectedMultisig?.id],
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (txId: string) => {
      if (!selectedMultisig) throw new Error("No multisig selected");
      return multisigApi.executeTransaction(selectedMultisig.id, txId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["multisig-transactions", selectedMultisig?.id],
      });
    },
  });

  const addOwner = () => setOwners([...owners, ""]);
  const removeOwner = (index: number) => {
    if (owners.length > 2) {
      setOwners(owners.filter((_, i) => i !== index));
    }
  };
  const updateOwner = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "executed":
        return <Check className="h-4 w-4 text-green-500" />;
      case "ready":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "cancelled":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen container max-w-2xl mx-auto py-8">
      <Button
        variant="ghost"
        className="mb-4 -ml-2 hover:bg-transparent hover:text-primary"
        onClick={() =>
          selectedMultisig
            ? setSelectedMultisig(null)
            : router.push("/")
        }
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {!selectedMultisig ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Multi-sig Wallets
              </CardTitle>
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Create Form */}
            {showCreate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6 p-4 rounded-lg bg-secondary/50 space-y-3"
              >
                <Input
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                  </SelectContent>
                </Select>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Threshold
                  </label>
                  <Select value={threshold} onValueChange={setThreshold}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1} of {owners.length}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Owners
                  </label>
                  {owners.map((owner, i) => (
                    <div key={i} className="flex gap-2 mt-2">
                      <Input
                        placeholder={`Owner ${i + 1} address`}
                        value={owner}
                        onChange={(e) => updateOwner(i, e.target.value)}
                      />
                      {owners.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOwner(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={addOwner}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Owner
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Multisig List */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : multisigs && multisigs.length > 0 ? (
              <div className="space-y-3">
                {multisigs.map((ms, index) => (
                  <motion.div
                    key={ms.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer"
                    onClick={() => setSelectedMultisig(ms)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${ms.chain === "solana"
                          ? "bg-purple-500"
                          : "bg-blue-500"
                          }`}
                      />
                      <div>
                        <p className="font-medium">{ms.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {ms.threshold} of {ms.owner_count} &bull;{" "}
                          {truncateAddress(ms.address)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No multi-sig wallets yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Selected Multisig Detail */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedMultisig.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedMultisig.threshold} of {selectedMultisig.owner_count}{" "}
                  signatures required
                </p>
              </div>
              <Button size="sm" onClick={() => setShowPropose(!showPropose)}>
                <Plus className="h-4 w-4 mr-1" />
                Propose
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Propose Form */}
            {showPropose && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6 p-4 rounded-lg bg-secondary/50 space-y-3"
              >
                <Input
                  placeholder="To address"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
                <Input
                  placeholder="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPropose(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => proposeMutation.mutate()}
                    disabled={proposeMutation.isPending}
                  >
                    {proposeMutation.isPending ? "Proposing..." : "Propose"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Owners */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Owners
              </h3>
              <div className="space-y-2">
                {selectedMultisig.owners.map((owner, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-secondary/50 text-sm"
                  >
                    <p className="font-medium">
                      {owner.name || `Owner ${i + 1}`}
                    </p>
                    <p className="text-muted-foreground">
                      {truncateAddress(owner.address)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Transactions
              </h3>
              {transactions && transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(tx.status)}
                          <span className="capitalize">{tx.status}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {tx.approvals.length}/{selectedMultisig.threshold}{" "}
                          approvals
                        </span>
                      </div>
                      <p className="text-sm">
                        To: {truncateAddress(tx.to_address)}
                      </p>
                      {tx.amount && (
                        <p className="text-sm">
                          Amount: {formatBalance(tx.amount)}
                        </p>
                      )}
                      {tx.status === "pending" && (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            approveMutation.mutate({
                              txId: tx.id,
                              approverAddress:
                                selectedMultisig.owners[0]?.address || "",
                            })
                          }
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </Button>
                      )}
                      {tx.status === "ready" && (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => executeMutation.mutate(tx.id)}
                          disabled={executeMutation.isPending}
                        >
                          Execute
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No transactions yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
