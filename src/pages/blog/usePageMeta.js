import { useEffect } from 'react';

/** Sets the browser tab title and meta description while a blog page is open. */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    let tag = document.querySelector('meta[name="description"]');
    const created = !tag;
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', 'description'); document.head.appendChild(tag); }
    const prevDesc = tag.getAttribute('content');
    document.title = title;
    if (description) tag.setAttribute('content', description);
    return () => {
      document.title = prevTitle;
      if (created) tag.remove(); else if (prevDesc != null) tag.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}
