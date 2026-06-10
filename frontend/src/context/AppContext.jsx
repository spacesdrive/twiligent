import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { api } from '../services/api';
import { normalizeAccount } from '../utils/formatters';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity });
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
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast(t => ({ ...t, open: false }))}
          sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
