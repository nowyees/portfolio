import { RouterProvider } from 'react-router';
import { router } from './routes';
import { trackVisit } from '../lib/visitService';

// every page view goes to the admin's Visitors page
trackVisit(router.state.location.pathname);
router.subscribe(state => trackVisit(state.location.pathname));

export default function App() {
  return <RouterProvider router={router} />;
}
