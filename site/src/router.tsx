import { createBrowserRouter } from 'react-router';
import { MarketingLayout } from './components/MarketingLayout';
import Home from './pages/Home';

const docPage = async () => ({ Component: (await import('./docs/DocPage')).default });

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
    // a splat child never matches /docs itself, so the docs home needs its own index route
    children: [
      { index: true, lazy: docPage },
      { path: '*', lazy: docPage },
    ],
  },
]);
