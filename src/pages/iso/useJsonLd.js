import { useEffect } from 'react';

// Adds a JSON-LD structured-data block to <head> while the page is shown (what the page is, its FAQ, where it sits).
// Search engines and AI answer engines read it. Removed again when the page unmounts.
export default function useJsonLd(id, data) {
  useEffect(() => {
    if (!data) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.isol = id;
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => { el.remove(); };
    // `data` is rebuilt each render; the page it describes only changes with `id`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
