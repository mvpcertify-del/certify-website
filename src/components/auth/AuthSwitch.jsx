import { Link } from 'react-router-dom';

// The sign-up / log-in switch shown at the bottom of both pages, so a visitor on the wrong one is one
// obvious tap from the right one: a question and an outlined button, not a line of small grey text.
export default function AuthSwitch({ to, prompt, label }) {
  return (
    <div className="auth-switch">
      <span className="auth-switch__prompt">{prompt}</span>
      <Link to={to} className="auth-switch__btn">{label}</Link>
    </div>
  );
}
