import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatBalance(balance: string | number, decimals = 4): string {
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function getChainIcon(chain: string): string {
  switch (chain.toLowerCase()) {
    case "solana":
      return "/solana.svg";
    case "ethereum":
      return "/ethereum.svg";
    default:
      return "/generic-chain.svg";
  }
}

export function getExplorerUrl(chain: string, hash: string, type: "tx" | "address" = "tx"): string {
  switch (chain.toLowerCase()) {
    case "solana":
      return `https://explorer.solana.com/${type === "tx" ? "tx" : "address"}/${hash}?cluster=devnet`;
    case "ethereum":
      return `https://sepolia.etherscan.io/${type === "tx" ? "tx" : "address"}/${hash}`;
    default:
      return "#";
  }
}
