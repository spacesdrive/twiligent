import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, Box, Snackbar, Alert } from '@mui/material';
import theme from './theme';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import ChannelAnalytics from './components/ChannelAnalytics';
import AccountManager from './components/AccountManager';
import Settings from './components/Settings';
import VideoExplorer from './components/VideoExplorer';
import ShortsExplorer from './components/ShortsExplorer';
import ReelsExplorer from './components/ReelsExplorer';
import InstagramAnalytics from './components/InstagramAnalytics';
import UploadContent from './components/UploadContent';
import { api } from './services/api';
import { normalizeAccount } from './utils/formatters';

export default function App() {
  const [tab, setTab] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleViewChannel = (account) => {
    setSelectedAccount(account);
    setTab(account.platform === 'instagram' ? 'ig-analytics' : 'channel');
  };

  const handleRefreshAll = async () => {
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
  };

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return <Overview accounts={accounts} onViewChannel={handleViewChannel} onRefreshAll={handleRefreshAll} loading={loading} />;
      case 'channel':
        return selectedAccount
          ? <ChannelAnalytics account={selectedAccount} showToast={showToast} onBack={() => setTab('overview')} />
          : <Overview accounts={accounts} onViewChannel={handleViewChannel} onRefreshAll={handleRefreshAll} loading={loading} />;
      case 'videos':
        return <VideoExplorer accounts={accounts} showToast={showToast} />;
      case 'shorts':
        return <ShortsExplorer accounts={accounts} showToast={showToast} />;
      case 'reels':
        return <ReelsExplorer accounts={accounts} showToast={showToast} />;
      case 'upload':
        return <UploadContent accounts={accounts} showToast={showToast} />;
      case 'accounts':
        return <AccountManager accounts={accounts} setAccounts={setAccounts} showToast={showToast} onRefresh={loadAccounts} />;
      case 'ig-analytics':
        return selectedAccount?.platform === 'instagram'
          ? <InstagramAnalytics account={selectedAccount} showToast={showToast} onBack={() => setTab('overview')} />
          : <Overview accounts={accounts} onViewChannel={handleViewChannel} onRefreshAll={handleRefreshAll} loading={loading} />;
      case 'settings':
        return <Settings showToast={showToast} onRefresh={loadAccounts} />;
      default:
        return <Overview accounts={accounts} onViewChannel={handleViewChannel} onRefreshAll={handleRefreshAll} loading={loading} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Sidebar tab={tab} setTab={setTab} accounts={accounts} onViewChannel={handleViewChannel} />
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, minWidth: 0, overflowX: 'hidden' }}>
          {renderTab()}
        </Box>
      </Box>
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast(t => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
