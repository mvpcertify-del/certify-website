import { useEffect } from 'react';

const DEFAULT_TITLE = 'Certify.cx™ - ISO Certification Platform';
const DEFAULT_DESCRIPTION =
  'Certify.cx™ — ISO Certification Marketplace. Apply for ISO certifications, manage audits, and streamline your compliance workflow.';
const SITE_URL = 'https://certify.cx';

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(
    `meta[${attribute}="${key}"]`
  );

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  noindex = false,
}) {
  useEffect(() => {
    const safePath = path.startsWith('/') ? path : `/${path}`;
    const canonicalUrl = new URL(safePath, SITE_URL).href;

    document.title = title;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'Certify.cx™');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);

    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    upsertLink('canonical', canonicalUrl);
  }, [title, description, path, noindex]);

  return null;
}
