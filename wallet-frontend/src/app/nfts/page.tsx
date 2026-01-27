"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Image as ImageIcon, ExternalLink } from "lucide-react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { nftApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils";

export default function NFTsPage() {
  const router = useRouter();
  const { selectedAccount } = useWalletStore();

  const { data: nfts, isLoading } = useQuery({
    queryKey: ["nfts", selectedAccount?.chain, selectedAccount?.address],
    queryFn: () =>
      selectedAccount
        ? nftApi.list(selectedAccount.chain, selectedAccount.address)
        : Promise.resolve([]),
    enabled: !!selectedAccount,
  });

  return (
    <div className="min-h-screen container max-w-4xl mx-auto py-8">
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
            <ImageIcon className="h-5 w-5" />
            NFT Gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading NFTs...
            </div>
          ) : nfts && nfts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {nfts.map((nft, index) => (
                <motion.div
                  key={nft.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                    {nft.image_url ? (
                      <img
                        src={nft.image_url}
                        alt={nft.name || "NFT"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-medium truncate">
                      {nft.name || "Unnamed NFT"}
                    </p>
                    {nft.collection_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {nft.collection_name}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No NFTs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                NFTs you own will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
