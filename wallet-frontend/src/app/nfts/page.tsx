"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Image as ImageIcon, ExternalLink, RefreshCw } from "lucide-react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { nftApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils";

const LazyNftImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
};

export default function NFTsPage() {
  const router = useRouter();
  const { selectedAccount } = useWalletStore();

  const { data: nfts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["nfts", selectedAccount?.chain, selectedAccount?.address],
    queryFn: () =>
      selectedAccount
        ? nftApi.list(selectedAccount.chain, selectedAccount.address)
        : Promise.resolve([]),
    enabled: !!selectedAccount,
  });

  return (
    <div className="min-h-screen container max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          className="-ml-2 hover:bg-transparent hover:text-primary"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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
                  key={nft.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer border border-border rounded-lg overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="relative aspect-square bg-secondary">
                    {nft.image_url ? (
                      <LazyNftImage
                        src={nft.image_url}
                        alt={nft.name || "NFT"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-card">
                    <p className="font-medium truncate text-sm">
                      {nft.name || "Unnamed NFT"}
                    </p>
                    {nft.collection_name && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
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
