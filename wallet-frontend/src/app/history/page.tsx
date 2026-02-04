"use client";

import { useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
} from "lucide-react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { transactionApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress, formatBalance, formatDate, getExplorerUrl } from "@/lib/utils";

export default function HistoryPage() {
  const router = useRouter();
  const { selectedAccount } = useWalletStore();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ["transactions", selectedAccount?.chain, selectedAccount?.address],
    queryFn: ({ pageParam = 0 }) =>
      selectedAccount
        ? transactionApi.getHistory(selectedAccount.chain, selectedAccount.address, 20, pageParam as number)
        : Promise.resolve([]),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length * 20 : undefined;
    },
    enabled: !!selectedAccount,
  });

  const transactions = data?.pages.flat() || [];

  const getTxIcon = (type: string) => {
    switch (type) {
      case "send":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "receive":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen container max-w-2xl mx-auto py-8">
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
            <Clock className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading transactions...
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id || `${tx.signature}-${index}`} // Fallback key if id is missing or dup
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index % 20) * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() =>
                    window.open(
                      getExplorerUrl(tx.chain, tx.signature),
                      "_blank"
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background">
                      {getTxIcon(tx.tx_type)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{tx.tx_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx.to_address
                          ? `To: ${truncateAddress(tx.to_address)}`
                          : truncateAddress(tx.signature)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.amount && (
                      <p
                        className={`font-mono ${tx.tx_type === "send"
                          ? "text-red-500"
                          : "text-green-500"
                          }`}
                      >
                        {tx.tx_type === "send" ? "-" : "+"}
                        {formatBalance(tx.amount)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {tx.timestamp ? formatDate(tx.timestamp) : tx.status}
                    </p>
                  </div>
                </motion.div>
              ))}

              {hasNextPage && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full"
                  >
                    {isFetchingNextPage ? "Loading more..." : "Load More"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your transactions will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
