import { RouterProvider } from 'react-router/dom';
import { DevProjectBanner } from '../components/layout/DevProjectBanner';
import { Providers } from './providers/Providers';
import { router } from './router';

export default function App() {
  return (
    <Providers>
      {import.meta.env.DEV && <DevProjectBanner />}
      <RouterProvider router={router} />
    </Providers>
  );
}
