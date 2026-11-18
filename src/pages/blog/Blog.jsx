import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowRight, X } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import { CATEGORIES, POSTS, sortedPosts } from '../../content/blog/posts';
import { BlogCover, PostCard, PostMeta, BlogFooter } from './BlogParts';
import usePageMeta from './usePageMeta';
import './Blog.css';

const SLIDE_MS = 6000;

// /blog: a featured banner that slides by itself, a search box, category filters and the article grid.
// Articles are plain data in src/content/blog/posts.js.
export default function Blog() {
  usePageMeta('Blog | Certify.cx™ - Global Compliance Marketplace', 'Guides on ISO standards, certification, audits and accreditation from the Certify.cx editorial team.');

  const all = useMemo(() => sortedPosts(), []);
  const featured = useMemo(() => all.filter((p) => p.featured), [all]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

  // Lower-cased text per article, so search covers title, summary, category and the article itself.
  const index = useMemo(() => Object.fromEntries(POSTS.map((p) => [
    p.slug,
    [p.title, p.excerpt, CATEGORIES[p.category].label, ...p.body.map((b) => b.x || (b.items || []).join(' '))].join(' ').toLowerCase(),
  ])), []);

  const counts = useMemo(() => {
    const c = { all: all.length };
    for (const p of all) c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => (cat === 'all' || p.category === cat) && (!q || index[p.slug].includes(q)));
  }, [all, cat, query, index]);

  // ---- auto-sliding banner ----
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const go = (i) => setSlide((i + featured.length) % featured.length);
  useEffect(() => {
    if (paused || reduced.current || featured.length < 2) return undefined;
    const id = setInterval(() => setSlide((s) => (s + 1) % featured.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, featured.length]);

  const searching = query.trim() !== '' || cat !== 'all';

  return (
    <div className="blog-page">
      <PublicNav />

      {/* ---- Hero ---- */}
      <header className="blog-hero">
        <div className="blog-wrap">
          <p className="blog-hero__kicker">Certify.cx Blog</p>
          <h1 className="blog-hero__title">Insights on ISO standards, audits and certification</h1>
          <p className="blog-hero__sub">Practical guides from the Certify.cx editorial team, for organisations preparing to get certified.</p>
          <form className="blog-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <Search size={18} aria-hidden="true" className="blog-search__icon" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, for example ISO 9001, audit, accreditation"
              aria-label="Search articles"
            />
            {query && (
              <button type="button" className="blog-search__clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>
            )}
          </form>
        </div>
      </header>

      <main className="blog-wrap blog-main">
        {/* ---- Featured slider ---- */}
        {!searching && featured.length > 0 && (
          <section
            className="blog-slider"
            aria-roledescription="carousel"
            aria-label="Featured articles"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className="blog-slider__viewport">
              <div className="blog-slider__track" style={{ transform: `translateX(-${slide * 100}%)` }}>
                {featured.map((p, i) => {
                  const c = CATEGORIES[p.category];
                  return (
                    <article
                      key={p.slug}
                      className="blog-slide"
                      style={{ '--cat': c.color }}
                      aria-roledescription="slide"
                      aria-label={`${i + 1} of ${featured.length}`}
                      aria-hidden={i !== slide}
                    >
                      <BlogCover post={p} large />
                      <div className="blog-slide__body">
                        <span className="blog-chip-label">Featured · {c.label}</span>
                        <h2 className="blog-slide__title">{p.title}</h2>
                        <p className="blog-slide__excerpt">{p.excerpt}</p>
                        <PostMeta post={p} />
                        <Link to={`/blog/${p.slug}`} className="blog-btn" tabIndex={i === slide ? 0 : -1}>Read article <ArrowRight size={16} /></Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
            {featured.length > 1 && (
              <div className="blog-slider__controls">
                <button type="button" className="blog-slider__arrow" onClick={() => go(slide - 1)} aria-label="Previous article"><ChevronLeft size={18} /></button>
                <div className="blog-slider__dots" role="tablist" aria-label="Choose a featured article">
                  {featured.map((p, i) => (
                    <button key={p.slug} type="button" role="tab" aria-selected={i === slide} aria-label={`Show article ${i + 1}`} className={`blog-slider__dot${i === slide ? ' blog-slider__dot--on' : ''}`} onClick={() => go(i)} />
                  ))}
                </div>
                <button type="button" className="blog-slider__arrow" onClick={() => go(slide + 1)} aria-label="Next article"><ChevronRight size={18} /></button>
              </div>
            )}
          </section>
        )}

        {/* ---- Category filters ---- */}
        <nav className="blog-cats" aria-label="Categories">
          {['all', ...Object.keys(CATEGORIES)].map((k) => (
            <button
              key={k}
              type="button"
              className={`blog-cat${cat === k ? ' blog-cat--on' : ''}`}
              style={k !== 'all' ? { '--cat': CATEGORIES[k].color } : undefined}
              aria-pressed={cat === k}
              onClick={() => setCat(k)}
            >
              {k !== 'all' && <span className="blog-cat__dot" aria-hidden="true" />}
              {k === 'all' ? 'All articles' : CATEGORIES[k].label}
              <span className="blog-cat__count">{counts[k] || 0}</span>
            </button>
          ))}
        </nav>

        <p className="blog-result" aria-live="polite">
          {searching ? `${shown.length} article${shown.length === 1 ? '' : 's'} found` : 'Latest articles'}
          {searching && (
            <button type="button" className="blog-result__reset" onClick={() => { setQuery(''); setCat('all'); }}>Clear filters</button>
          )}
        </p>

        {/* ---- Grid ---- */}
        {shown.length === 0 ? (
          <div className="blog-empty">
            <h3>No articles match your search</h3>
            <p>Try a different word, or clear the filters to see everything.</p>
          </div>
        ) : (
          <div className="blog-grid">
            {shown.map((p) => <PostCard key={p.slug} post={p} />)}
          </div>
        )}

        {/* ---- Call to action ---- */}
        <section className="blog-cta">
          <div>
            <h2>Ready to find out where you stand?</h2>
            <p>Take the free gap analysis, then compare certification options in one place.</p>
          </div>
          <div className="blog-cta__actions">
            <Link to="/gap-analysis" className="blog-btn">Start the gap analysis <ArrowRight size={16} /></Link>
            <Link to="/certifications" className="blog-btn blog-btn--ghost">Browse certifications</Link>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
