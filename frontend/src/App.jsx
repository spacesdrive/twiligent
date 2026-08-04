import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layout/index';
import Login from './pages/Login';

const Overview           = lazy(() => import('./features/analytics/overview/Overview'));
const ChannelAnalytics   = lazy(() => import('./features/analytics/channel/ChannelAnalytics'));
const InstagramAnalytics = lazy(() => import('./features/analytics/instagram/InstagramAnalytics'));
const VideoExplorer      = lazy(() => import('./features/analytics/videos/VideoExplorer'));
const ShortsExplorer     = lazy(() => import('./features/analytics/shorts/ShortsExplorer'));
const ReelsExplorer      = lazy(() => import('./features/analytics/reels/ReelsExplorer'));
const UploadContent      = lazy(() => import('./features/publishing/UploadContent'));
const AccountManager     = lazy(() => import('./features/accounts/AccountManager'));
const Settings           = lazy(() => import('./features/settings/Settings'));
const RedditAnalytics    = lazy(() => import('./features/analytics/reddit/RedditAnalytics'));
const RedditPosts        = lazy(() => import('./features/analytics/reddit/RedditPosts'));
const RedditPostsAll     = lazy(() => import('./features/analytics/reddit/RedditPostsAll'));
const RedditTracked      = lazy(() => import('./features/analytics/reddit/RedditTracked'));

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppProvider>
          <MainLayout />
        </AppProvider>
      </ProtectedRoute>
    ),
    children: [
      { index: true,           element: <Overview /> },
      { path: 'channel/:id',   element: <ChannelAnalytics /> },
      { path: 'instagram/:id', element: <InstagramAnalytics /> },
      { path: 'videos',        element: <VideoExplorer /> },
      { path: 'shorts',        element: <ShortsExplorer /> },
      { path: 'reels',         element: <ReelsExplorer /> },
      { path: 'upload',        element: <UploadContent /> },
      { path: 'accounts',           element: <AccountManager /> },
      { path: 'settings',           element: <Settings /> },
      { path: 'reddit/:id',         element: <RedditAnalytics /> },
      { path: 'reddit-posts',         element: <RedditPostsAll /> },
      { path: 'reddit-posts/:id',   element: <RedditPosts /> },
      { path: 'reddit-tracked',     element: <RedditTracked /> },
      { path: '*',             element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
