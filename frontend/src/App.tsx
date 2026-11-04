import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layout/index';
import Login from './pages/Login';
import DocsRedirect from './components/DocsRedirect';
import { LoadingState } from './components/StateViews';
import RedirectWithQuery from './layout/RedirectWithQuery';

const Overview           = lazy(() => import('./features/analytics/overview/Overview'));
const ChannelAnalytics   = lazy(() => import('./features/analytics/channel/ChannelAnalytics'));
const InstagramAnalytics = lazy(() => import('./features/analytics/instagram/InstagramAnalytics'));
const VideoExplorer      = lazy(() => import('./features/analytics/videos/VideoExplorer'));
const ShortsExplorer     = lazy(() => import('./features/analytics/shorts/ShortsExplorer'));
const ReelsExplorer      = lazy(() => import('./features/analytics/reels/ReelsExplorer'));
const UploadContent      = lazy(() => import('./features/publishing/UploadContent'));
const Automations        = lazy(() => import('./features/automations/Automations'));
const RuleEditorPage     = lazy(() => import('./features/automations/RuleEditorPage'));
const AccountManager     = lazy(() => import('./features/accounts/AccountManager'));
const Settings           = lazy(() => import('./features/settings/Settings'));
const TrackedContent     = lazy(() => import('./features/analytics/tracked/TrackedContent'));
const TrackedCategory    = lazy(() => import('./features/analytics/tracked/TrackedCategory'));
const NotFound           = lazy(() => import('./pages/NotFound'));

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/docs/*',
    element: <DocsRedirect />,
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
      { path: 'instagram',     element: <ReelsExplorer /> },
      { path: 'reels',         element: <RedirectWithQuery to="/instagram" /> },
      { path: 'publish',       element: <UploadContent /> },
      { path: 'upload',        element: <RedirectWithQuery to="/publish" /> },
      { path: 'automations',   element: <Automations /> },
      { path: 'automations/rules/new', element: <RuleEditorPage /> },
      { path: 'automations/rules/:id', element: <RuleEditorPage /> },
      { path: 'accounts',           element: <AccountManager /> },
      { path: 'settings',           element: <Settings /> },
      { path: 'tracked-content',                  element: <TrackedContent /> },
      { path: 'tracked-content/category/:name', element: <TrackedCategory /> },
      { path: '*',             element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AuthProvider>
          <Suspense fallback={<LoadingState label="Loading Twiligent" className="min-h-dvh" />}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster position="bottom-right" richColors closeButton duration={6000} />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
