import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './Legal.css';

// Public Terms of Service page. The signup form links to both /privacy and
// /terms, so this exists to avoid a dead link. Baseline copy — the client
// should have it reviewed by their own counsel.
export default function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-page__inner">
        <Link to="/" className="legal-page__back">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <h1>Terms of Service</h1>
        <p className="legal-page__updated">Last updated: 29 June 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the
          Certify.cx platform and related services (the &quot;Service&quot;). By creating
          an account or using the Service, you agree to these Terms.
        </p>

        <h2>1. Eligibility &amp; Accounts</h2>
        <p>
          You must provide accurate registration information and keep it up to
          date. You are responsible for safeguarding your account credentials and
          for all activity under your account.
        </p>

        <h2>2. Use of the Service</h2>
        <ul>
          <li>Use the Service only for lawful certification-related purposes.</li>
          <li>Do not upload false, misleading, or infringing content.</li>
          <li>Do not attempt to disrupt, reverse-engineer, or gain unauthorised access to the Service.</li>
        </ul>

        <h2>3. Certification Process</h2>
        <p>
          The Service facilitates communication between clients, certification
          bodies, and auditors. Certification decisions are made by the relevant
          accredited certification bodies. Certify.cx provides the platform and
          does not itself issue accreditation.
        </p>

        <h2>4. Payments</h2>
        <p>
          Fees for certification and related services are shown before purchase and
          processed by our payment provider. Unless required by law or stated
          otherwise, payments are non-refundable once the related service has begun.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          The Service and its content (excluding your own data) are owned by
          Certify.cx and its licensors. You retain ownership of the data and
          documents you upload, and grant us the rights needed to operate the
          Service.
        </p>

        <h2>6. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind to the
          extent permitted by law. We do not guarantee that the Service will be
          uninterrupted or error-free.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Certify.cx will not be liable for
          any indirect, incidental, or consequential damages arising from your use
          of the Service.
        </p>

        <h2>8. Termination</h2>
        <p>
          We may suspend or terminate access to the Service if these Terms are
          violated. You may stop using the Service at any time.
        </p>

        <h2>9. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Service
          after changes take effect constitutes acceptance of the revised Terms.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:support@certify.cx">support@certify.cx</a>.
        </p>
      </div>
    </div>
  );
}
