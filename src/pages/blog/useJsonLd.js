import { useEffect } from 'react';

/** Adds a schema.org JSON-LD block to the page while it is open, so search engines and AI assistants can read it. */
export default function useJsonLd(id, data) {
  const json = data ? JSON.stringify(data) : '';
  useEffect(() => {
    if (!json) return undefined;
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.dataset.blogLd = id;
    tag.textContent = json;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [id, json]);
}
