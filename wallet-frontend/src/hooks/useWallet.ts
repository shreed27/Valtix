"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, accountsApi, balanceApi, type Account } from "@/lib/api";
import { useWalletStore } from "./useWalletStore";

export function useWalletStatus() {
  const { setStatus } = useWalletStore();

  return useQuery({
    queryKey: ["wallet", "status"],
    queryFn: async () => {
      const status = await authApi.getStatus();
      setStatus(status);
      return status;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useUnlockWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => authApi.unlock(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useLockWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.lock(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => authApi.createWallet(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useImportWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mnemonic, password }: { mnemonic: string; password: string }) =>
      authApi.importWallet(mnemonic, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useAccounts() {
  const { setAccounts, selectAccount, selectedAccount } = useWalletStore();

  return useQuery({
    queryKey: ["wallet", "accounts"],
    queryFn: async () => {
      const accounts = await accountsApi.list();
      setAccounts(accounts);
      // Auto-select first account if none selected
      if (!selectedAccount && accounts.length > 0) {
        selectAccount(accounts[0]);
      }
      return accounts;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chain, name }: { chain: string; name?: string }) =>
      accountsApi.create(chain, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "accounts"] });
    },
  });
}

export function useBalance(chain: string, address: string) {
  return useQuery({
    queryKey: ["balance", chain, address],
    queryFn: () => balanceApi.getBalance(chain, address),
    enabled: !!chain && !!address,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useSelectedAccountBalance() {
  const { selectedAccount } = useWalletStore();

  return useQuery({
    queryKey: ["balance", selectedAccount?.chain, selectedAccount?.address],
    queryFn: () =>
      selectedAccount
        ? balanceApi.getBalance(selectedAccount.chain, selectedAccount.address)
        : null,
    enabled: !!selectedAccount,
    refetchInterval: 60000,
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("Deleting account:", id);
      await accountsApi.delete(id);
      console.log("Account deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("Delete mutation success, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["wallet", "accounts"] });
    },
    onError: (error) => {
      console.error("Delete account mutation error:", error);
    },
  });
}

export function useResetWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log("Resetting wallet...");
      const result = await authApi.reset();
      console.log("Wallet reset result:", result);
      return result;
    },
    onSuccess: () => {
      console.log("Reset mutation success, invalidating all queries");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
    onError: (error) => {
      console.error("Reset wallet mutation error:", error);
    },
  });
}
