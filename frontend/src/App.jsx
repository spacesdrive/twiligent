import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppProvider } from './context/AppContext';
import MainLayout from './layout/index';

const Overview           = lazy(() => import('./features/analytics/overview/Overview'));
const ChannelAnalytics   = lazy(() => import('./features/analytics/channel/ChannelAnalytics'));
const InstagramAnalytics = lazy(() => import('./features/analytics/instagram/InstagramAnalytics'));
const VideoExplorer      = lazy(() => import('./features/analytics/videos/VideoExplorer'));
const ShortsExplorer     = lazy(() => import('./features/analytics/shorts/ShortsExplorer'));
const ReelsExplorer      = lazy(() => import('./features/analytics/reels/ReelsExplorer'));
const UploadContent      = lazy(() => import('./features/publishing/UploadContent'));
const AccountManager     = lazy(() => import('./features/accounts/AccountManager'));
const Settings           = lazy(() => import('./features/settings/Settings'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true,           element: <Overview /> },
      { path: 'channel/:id',   element: <ChannelAnalytics /> },
      { path: 'instagram/:id', element: <InstagramAnalytics /> },
      { path: 'videos',        element: <VideoExplorer /> },
      { path: 'shorts',        element: <ShortsExplorer /> },
      { path: 'reels',         element: <ReelsExplorer /> },
      { path: 'upload',        element: <UploadContent /> },
      { path: 'accounts',      element: <AccountManager /> },
      { path: 'settings',      element: <Settings /> },
      { path: '*',             element: <Navigate to="/" replace /> },
    ],
  },
]);

function PageFallback() {
  return (
    <div className="flex-1 p-4 sm:p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AppProvider>
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster position="bottom-right" richColors />
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
