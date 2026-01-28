"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, ChevronDown, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { useWalletStore } from "@/hooks/useWalletStore";
import { useAccounts } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncateAddress, copyToClipboard } from "@/lib/utils";

export default function ReceivePage() {
  const router = useRouter();
  const { selectedAccount, selectAccount } = useWalletStore();
  const { data: accounts } = useAccounts();

  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (selectedAccount?.address) {
      await copyToClipboard(selectedAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            <QrCode className="h-5 w-5 text-primary" />
            <CardTitle>Receive {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Selector */}
          <div>
            <label className="text-sm font-medium leading-none">Select Wallet</label>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                className="w-full p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    selectedAccount?.chain === 'solana' ? 'bg-purple-500' : 'bg-blue-500'
                  }`}>
                    {selectedAccount?.chain === 'solana' ? 'SOL' : 'ETH'}
                  </div>
                  <div>
                    <p className="font-medium">{selectedAccount?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {truncateAddress(selectedAccount?.address || "")}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAccountPicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Dropdown */}
              {showAccountPicker && accounts && accounts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-60 overflow-y-auto">
                  {accounts.map((account) => (
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        account.chain === 'solana' ? 'bg-purple-500' : 'bg-blue-500'
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

          {/* QR Code */}
          <div className="flex flex-col items-center py-6">
            <div className="bg-white p-4 rounded-xl">
              {selectedAccount?.address && (
                <QRCodeSVG
                  value={selectedAccount.address}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Scan this QR code to receive {selectedAccount?.chain === "solana" ? "SOL" : "ETH"}
            </p>
          </div>

          {/* Address Display */}
          <div>
            <label className="text-sm font-medium leading-none">Your Address</label>
            <div className="mt-2 p-4 rounded-lg bg-secondary border border-border">
              <p className="font-mono text-sm break-all text-center">
                {selectedAccount?.address}
              </p>
            </div>
          </div>

          {/* Copy Button */}
          <Button
            className="w-full"
            variant="outline"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Address
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Only send {selectedAccount?.chain === "solana" ? "Solana (SOL) and SPL tokens" : "Ethereum (ETH) and ERC-20 tokens"} to this address
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
