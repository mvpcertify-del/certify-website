import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './Legal.css';

// Public Privacy Policy page. The copy below is a sensible baseline for an ISO
// certification platform — the client should have it reviewed by their own
// counsel and adjust the company name / address / jurisdiction as needed.
export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-page__inner">
        <Link to="/" className="legal-page__back">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <h1>Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: 29 June 2026</p>

        <p>
          This Privacy Policy explains how Certify.cx (&quot;Certify.cx&quot;, &quot;we&quot;,
          &quot;us&quot;) collects, uses, and protects your information when you use our
          certification management platform and related services (the &quot;Service&quot;).
          By using the Service you agree to the practices described here.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Account information</strong> — your name, email address, password, phone number, role, and organisation details provided at registration.</li>
          <li><strong>Certification data</strong> — company profiles, applications, documents, audit records, and certificates you create or upload.</li>
          <li><strong>Payment information</strong> — billing details processed securely by our payment provider; we do not store full card numbers.</li>
          <li><strong>Usage data</strong> — log data, device and browser information, and actions taken within the Service for security and product improvement.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To create and manage your account and provide the Service.</li>
          <li>To process certification applications, audits, payments, and renewals.</li>
          <li>To send transactional and service notifications (for example email verification, password reset, and status updates).</li>
          <li>To maintain security, prevent fraud, and comply with legal obligations.</li>
          <li>To improve and develop the Service.</li>
        </ul>

        <h2>3. Sharing of Information</h2>
        <p>
          We share information only as needed to operate the Service — for example
          with certification bodies and auditors assigned to your application, and
          with trusted service providers who help us run the platform (such as
          hosting, database, email, and payment processors). We do not sell your
          personal information.
        </p>

        <h2>4. Data Retention</h2>
        <p>
          We retain your information for as long as your account is active and as
          required to provide the Service, comply with legal and certification
          recordkeeping obligations, resolve disputes, and enforce our agreements.
        </p>

        <h2>5. Security</h2>
        <p>
          We use industry-standard safeguards including encryption in transit,
          access controls, and role-based permissions to protect your information.
          No method of transmission or storage is completely secure, and we cannot
          guarantee absolute security.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          Depending on your location, you may have the right to access, correct,
          export, or delete your personal information, and to object to or restrict
          certain processing. To exercise these rights, contact us using the
          details below.
        </p>

        <h2>7. Cookies</h2>
        <p>
          We use essential cookies and similar technologies to keep you signed in
          and to remember your preferences. You can control cookies through your
          browser settings, though some features may not work without them.
        </p>

        <h2>8. International Transfers</h2>
        <p>
          Your information may be processed in countries other than your own. Where
          required, we put appropriate safeguards in place for such transfers.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be posted on this page with a revised &quot;Last updated&quot; date.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or your data, contact
          us at <a href="mailto:privacy@certify.cx">privacy@certify.cx</a>.
        </p>
      </div>
    </div>
  );
}
