import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { normalizeAccount } from '../utils/formatters';
import type { AppAccount } from '../utils/formatters';

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface AppContextValue {
  accounts: AppAccount[];
  setAccounts: Dispatch<SetStateAction<AppAccount[]>>;
  loading: boolean;
  showToast: (message: string, severity?: ToastSeverity) => void;
  loadAccounts: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((message: string, severity: ToastSeverity = 'success') => {
    if (severity === 'error') toast.error(message);
    else if (severity === 'warning') toast.warning(message);
    else if (severity === 'info') toast.info(message);
    else toast.success(message);
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data.map(normalizeAccount));
    } catch (err) {
      showToast(`Couldn't load your accounts. ${(err as Error).message}`, 'error');
    }
  }, [showToast]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.refreshAll();
      setAccounts((res.accounts || []).map(normalizeAccount));
      showToast('All accounts refreshed');
    } catch (err) {
      showToast(`Refresh failed. ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  return (
    <AppContext.Provider value={{ accounts, setAccounts, loading, showToast, loadAccounts, refreshAll }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
