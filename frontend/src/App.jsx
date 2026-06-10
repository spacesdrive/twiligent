import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './themes/index';
import { AppProvider } from './context/AppContext';
import MainLayout from './layout/index';
import Overview from './features/analytics/overview/Overview';
import ChannelAnalytics from './features/analytics/channel/ChannelAnalytics';
import InstagramAnalytics from './features/analytics/instagram/InstagramAnalytics';
import VideoExplorer from './features/analytics/videos/VideoExplorer';
import ShortsExplorer from './features/analytics/shorts/ShortsExplorer';
import ReelsExplorer from './features/analytics/reels/ReelsExplorer';
import UploadContent from './features/publishing/UploadContent';
import AccountManager from './features/accounts/AccountManager';
import Settings from './features/settings/Settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true,              element: <Overview /> },
      { path: 'channel/:id',      element: <ChannelAnalytics /> },
      { path: 'instagram/:id',    element: <InstagramAnalytics /> },
      { path: 'videos',           element: <VideoExplorer /> },
      { path: 'shorts',           element: <ShortsExplorer /> },
      { path: 'reels',            element: <ReelsExplorer /> },
      { path: 'upload',           element: <UploadContent /> },
      { path: 'accounts',         element: <AccountManager /> },
      { path: 'settings',         element: <Settings /> },
      { path: '*',                element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </ThemeProvider>
  );
}
