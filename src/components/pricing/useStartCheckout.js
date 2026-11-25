import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';

// Returns a function that sends the visitor to pay for one standard.
//
// Carries a referral code (`?ref=`) across the hop to checkout. `ref` is only ever READ on /checkout and /signup, so
// without this a visitor who landed on a page with ?ref=CODE and pressed a buy button arrived at checkout with the code
// stripped, and the partner who sent them was credited with nothing.
// A logged-in client keeps the existing bootstrap path; everyone else goes to the public pay-first checkout (no signup
// gate before payment). Shared by the pricing card and the ISO landing pages so every buy button behaves the same.
export default function useStartCheckout(standardSlug) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  return () => {
    const params = new URLSearchParams({ iso: standardSlug });
    const ref = (searchParams.get('ref') || '').trim();
    if (ref) params.set('ref', ref);
    const qs = params.toString();
    navigate(user?.role === ROLES.CLIENT ? `/client/start-payment?${qs}` : `/checkout?${qs}`);
  };
}
