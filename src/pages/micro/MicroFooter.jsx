import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Linkedin, Twitter, Youtube, Mail } from 'lucide-react';
import BrandLogo from '../../components/ui/BrandLogo';
import './MicroLanding.css';

// The footer shared by the MICRO pages (/micro and /micro/budget).
export default function MicroFooter() {
  const { t } = useTranslation();
  return (
    <footer className="micro-footer">
        <div className="micro-container">
          <div className="micro-footer__cols">
            <div className="micro-footer__brand">
              <BrandLogo size={26} />
              <p>{t('micro.footerTagline')}</p>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footPlatform')}</h4>
              <Link to="/#how-it-works">{t('nav.howItWorks')}</Link>
              <Link to="/#standards">{t('nav.standards')}</Link>
              <Link to="/#benefits">{t('nav.benefits')}</Link>
              <Link to="/micro">{t('nav.micro')}</Link>
              <Link to="/qms">Certify.cx QMS</Link>
              <Link to="/erp">Certify.cx ERP</Link>
              <Link to="/micro/budget">{t('nav.microOffer', "What's your budget? (MICRO offer)")}</Link>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footResources')}</h4>
              <a href="https://certify.cx/blog">{t('micro.blog')}</a>
              <a href="https://certify.cx/guides">{t('micro.guides')}</a>
              <a href="https://certify.cx/help">{t('micro.helpCenter')}</a>
              <a href="https://certify.cx/faq">{t('micro.faqs')}</a>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footCompany')}</h4>
              <a href="https://certify.cx/about">{t('micro.aboutUs')}</a>
              <a href="mailto:support@certify.cx">{t('micro.contactUs')}</a>
              <a href="https://certify.cx/careers">{t('micro.careers')}</a>
              <Link to="/register/referral">{t('micro.partners')}</Link>
            </div>
            <div className="micro-footer__col micro-footer__col--social">
              <h4>{t('micro.footFollow')}</h4>
              <div className="micro-social">
                <a href="https://www.linkedin.com/company/certifycx" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><Linkedin size={16} /></a>
                <a href="https://twitter.com/certifycx" aria-label="Twitter" target="_blank" rel="noopener noreferrer"><Twitter size={16} /></a>
                <a href="https://www.youtube.com/@certifycx" aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube size={16} /></a>
                <a href="mailto:support@certify.cx" aria-label="Email"><Mail size={16} /></a>
              </div>
            </div>
          </div>
          <div className="micro-footer__bottom">
            <span>{t('micro.copyright')}</span>
            <span className="micro-footer__legal">
              <Link to="/privacy">{t('micro.privacy')}</Link>
              <Link to="/terms">{t('micro.terms')}</Link>
              <Link to="/privacy">{t('micro.cookies')}</Link>
            </span>
          </div>
        </div>
      </footer>
  );
}
