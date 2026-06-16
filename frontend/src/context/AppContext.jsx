import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { normalizeAccount } from '../utils/formatters';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((message, severity = 'success') => {
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
      showToast('Failed to load accounts: ' + err.message, 'error');
    }
  }, [showToast]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.refreshAll();
      setAccounts((res.accounts || []).map(normalizeAccount));
      showToast('All accounts refreshed!');
    } catch (err) {
      showToast(err.message, 'error');
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

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
