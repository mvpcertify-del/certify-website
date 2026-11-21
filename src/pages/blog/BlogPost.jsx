import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import { AUTHOR, BRAND, CATEGORIES, formatDate, getPost, sortedPosts } from '../../content/blog/posts';
import { BlogCover, PostCard, BlogFooter, RichText } from './BlogParts';
import usePageMeta from './usePageMeta';
import useJsonLd from './useJsonLd';
import './Blog.css';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// One article (/blog/:slug): headline, cover, readable body with a table of contents,
// a call to action and related articles.
export default function BlogPost() {
  const { slug } = useParams();
  const post = getPost(slug);

  usePageMeta(post ? `${post.title} | Certify.cx™ — Global Compliance Marketplace` : 'Blog | Certify.cx™ — Global Compliance Marketplace', post?.excerpt);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  // Structured data: the article, and its questions and answers, for search engines and AI assistants.
  const url = post ? `https://certify.cx/blog/${post.slug}` : '';
  useJsonLd('article', post && {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'en',
    mainEntityOfPage: url,
    image: 'https://certify.cx/og-image.png',
    author: { '@type': 'Organization', name: 'Certify.cx', url: 'https://certify.cx/' },
    publisher: { '@type': 'Organization', name: BRAND, url: 'https://certify.cx/', logo: { '@type': 'ImageObject', url: 'https://certify.cx/logo-square.png' } },
  });
  useJsonLd('faq', post?.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })),
  } : null);

  // Reading progress bar.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [slug]);

  // Highlight the section being read in "In this article".
  const [activeId, setActiveId] = useState('');
  useEffect(() => {
    if (!post) return undefined;
    const ids = post.body.filter((b) => b.t === 'h2').map((b) => slugify(b.x));
    const onScroll = () => {
      let cur = ids[0] || '';
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 140) cur = id; }
      setActiveId(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [post]);

  const headings = useMemo(() => (post ? post.body.filter((b) => b.t === 'h2').map((b) => ({ id: slugify(b.x), text: b.x })) : []), [post]);
  const related = useMemo(() => {
    if (!post) return [];
    const others = sortedPosts().filter((p) => p.slug !== post.slug);
    return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 3);
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const cat = CATEGORIES[post.category];
  const ordered = sortedPosts();
  const at = ordered.findIndex((p) => p.slug === post.slug);
  const newer = ordered[at - 1];
  const older = ordered[at + 1];

  return (
    <div className="blog-page" style={{ '--cat': cat.color }}>
      <div className="blog-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      <PublicNav />

      <article>
        <header className="blog-post-hero">
          <div className="blog-wrap blog-wrap--narrow">
            <Link to="/blog" className="blog-back"><ArrowLeft size={15} /> All articles</Link>
            <span className="blog-chip-label">{cat.label}</span>
            <h1 className="blog-post-hero__title">{post.title}</h1>
            <p className="blog-post-hero__excerpt">{post.excerpt}</p>
            <p className="blog-post-hero__by">
              <span>By {AUTHOR}</span>
              <span className="blog-meta__dot" aria-hidden="true" />
              <span>{formatDate(post.date)}</span>
              <span className="blog-meta__dot" aria-hidden="true" />
              <span>{post.minutes} min read</span>
            </p>
          </div>
        </header>

        <div className="blog-wrap blog-post-grid">
          <aside className="blog-toc" aria-label="In this article">
            <p className="blog-toc__title">In this article</p>
            <ul>
              {headings.map((h) => <li key={h.id}><a href={`#${h.id}`} className={activeId === h.id ? 'is-active' : undefined}>{h.text}</a></li>)}
            </ul>
          </aside>

          <div className="blog-prose">
            <BlogCover post={post} large />
            {post.keyFacts?.length > 0 && (
              <aside className="blog-facts" aria-label="Key facts">
                <p className="blog-facts__title">Key facts</p>
                <ul>{post.keyFacts.map((f) => <li key={f}>{f}</li>)}</ul>
              </aside>
            )}
            {post.body.map((b, i) => {
              if (b.t === 'h2') return <h2 key={i} id={slugify(b.x)}>{b.x}</h2>;
              if (b.t === 'h3') return <h3 key={i}>{b.x}</h3>;
              if (b.t === 'ul') return <ul key={i}>{b.items.map((it) => <li key={it}><RichText text={it} /></li>)}</ul>;
              if (b.t === 'ol') return <ol key={i}>{b.items.map((it) => <li key={it}><RichText text={it} /></li>)}</ol>;
              if (b.t === 'table') {
                return (
                  <div key={i} className="blog-table-wrap">
                    <table className="blog-table">
                      <thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>{b.rows.map((row) => <tr key={row[0]}>{row.map((c, ci) => <td key={ci}><RichText text={c} /></td>)}</tr>)}</tbody>
                    </table>
                  </div>
                );
              }
              if (b.t === 'figure') {
                return (
                  <figure key={i} className="blog-fig">
                    {b.title && <p className="blog-fig__title">{b.title}</p>}
                    {b.variant === 'cards' ? (
                      <div className="blog-fig__cards">
                        {b.items.map((it) => <div key={it.label} className="blog-fig__card" style={it.color ? { '--c': it.color } : undefined}><span className="blog-fig__big">{it.big}</span><span className="blog-fig__label">{it.label}</span><span className="blog-fig__sub">{it.sub}</span></div>)}
                      </div>
                    ) : (
                      <ol className="blog-fig__steps" style={{ '--cols': b.cols || 3 }}>
                        {b.items.map((it, n) => <li key={`${it.label}-${n}`}><strong>{it.label}</strong>{it.sub}</li>)}
                      </ol>
                    )}
                    {b.caption && <figcaption className="blog-fig__cap">{b.caption}</figcaption>}
                  </figure>
                );
              }
              if (b.t === 'note') return <aside key={i} className="blog-note"><Lightbulb size={18} aria-hidden="true" /><p><RichText text={b.x} /></p></aside>;
              return <p key={i}><RichText text={b.x} /></p>;
            })}

            {post.faq?.length > 0 && (
              <section className="blog-faq" aria-labelledby="blog-faq-h">
                <h2 id="blog-faq-h">Frequently asked questions</h2>
                {post.faq.map((f) => (
                  <div key={f.q} className="blog-faq__item">
                    <h3>{f.q}</h3>
                    <p><RichText text={f.a} /></p>
                  </div>
                ))}
              </section>
            )}

            <section className="blog-cta blog-cta--inline">
              <div>
                <h3>Not sure where to begin?</h3>
                <p>The free gap analysis shows how close you are to the standard.</p>
              </div>
              <Link to="/gap-analysis" className="blog-btn">Start the gap analysis <ArrowRight size={16} /></Link>
            </section>

            <nav className="blog-pager" aria-label="More articles">
              {newer ? <Link to={`/blog/${newer.slug}`} className="blog-pager__item"><small>Newer</small><span>{newer.title}</span></Link> : <span />}
              {older ? <Link to={`/blog/${older.slug}`} className="blog-pager__item blog-pager__item--next"><small>Older</small><span>{older.title}</span></Link> : <span />}
            </nav>
          </div>
        </div>
      </article>

      <section className="blog-wrap blog-related">
        <h2>Keep reading</h2>
        <div className="blog-grid">
          {related.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      </section>

      <BlogFooter />
    </div>
  );
}

