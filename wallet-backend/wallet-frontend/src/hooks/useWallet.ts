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
