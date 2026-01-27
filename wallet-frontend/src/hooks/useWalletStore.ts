import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account, WalletStatus } from "@/lib/api";

interface WalletState {
  // Status
  status: WalletStatus | null;
  isLoading: boolean;
  error: string | null;

  // Accounts
  accounts: Account[];
  selectedAccount: Account | null;

  // Actions
  setStatus: (status: WalletStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAccounts: (accounts: Account[]) => void;
  selectAccount: (account: Account | null) => void;
  reset: () => void;
}

const initialState = {
  status: null,
  isLoading: false,
  error: null,
  accounts: [],
  selectedAccount: null,
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      ...initialState,

      setStatus: (status) => set({ status }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setAccounts: (accounts) => set({ accounts }),
      selectAccount: (selectedAccount) => set({ selectedAccount }),
      reset: () => set(initialState),
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        selectedAccount: state.selectedAccount,
      }),
    }
  )
);
