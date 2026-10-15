import { createBrowserRouter } from 'react-router';
import { MarketingLayout } from './components/MarketingLayout';
import Home from './pages/Home';

// the home page ships with the first load; everything else loads when visited
export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).default }) },
    ],
  },
  {
    path: 'docs',
    lazy: async () => ({ Component: (await import('./docs/DocsLayout')).default }),
    children: [{ path: '*', lazy: async () => ({ Component: (await import('./docs/DocPage')).default }) }],
  },
]);
