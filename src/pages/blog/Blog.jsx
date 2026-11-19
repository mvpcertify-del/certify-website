import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ArrowRight, X, BookOpen, ClipboardCheck } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import { CATEGORIES, POSTS, featuredPosts, sortedPosts } from '../../content/blog/posts';
import { BlogCover, PostCard, PostMeta, BlogFooter, SocialLinks, TopicIcon } from './BlogParts';
import usePageMeta from './usePageMeta';
import './Blog.css';

const SLIDE_MS = 6000;
const PAGE = 6;
const TILE_TOPICS = ['about-certify', 'iso-certification', 'micro-companies', 'compliance-audits'];

// /blog: hero slider (text left, cover right), topic tiles, latest articles with a sidebar (popular
// topics, free gap analysis, follow us), a call to action and the footer.
// Articles are plain data in src/content/blog/posts.js.
export default function Blog() {
  usePageMeta('Blog | Certify.cx™ — Global Compliance Marketplace', 'Guides on ISO standards, certification, audits and accreditation from the Certify.cx editorial team.');

  const [params, setParams] = useSearchParams();
  const topic = CATEGORIES[params.get('topic')] ? params.get('topic') : 'all';
  const setTopic = (k) => {
    setParams(k === 'all' ? {} : { topic: k }, { replace: true });
    setLimit(PAGE);
  };

  const all = useMemo(() => sortedPosts(), []);
  const featured = useMemo(() => featuredPosts(), []);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  // Lower-cased text per article, so search covers title, summary, topic and the article itself.
  const index = useMemo(() => Object.fromEntries(POSTS.map((p) => [
    p.slug,
    [p.title, p.excerpt, CATEGORIES[p.category].label, ...p.body.map((b) => b.x || (b.items || []).join(' '))].join(' ').toLowerCase(),
  ])), []);

  const counts = useMemo(() => {
    const c = {};
    for (const p of all) c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => (topic === 'all' || p.category === topic) && (!q || index[p.slug].includes(q)));
  }, [all, topic, query, index]);

  // ---- auto-sliding hero ----
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const go = (i) => setSlide((i + featured.length) % featured.length);
  useEffect(() => {
    if (paused || reduced.current || featured.length < 2) return undefined;
    const id = setInterval(() => setSlide((s) => (s + 1) % featured.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, featured.length]);

  const filtered = topic !== 'all' || query.trim() !== '';
  const visible = shown.slice(0, limit);

  return (
    <div className="blog-page">
      <PublicNav />

      {/* ---- Hero slider ---- */}
      <section
        className="blog-hero"
        aria-roledescription="carousel"
        aria-label="Featured articles"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="blog-wrap">
          <div className="blog-hero__viewport">
            <div className="blog-hero__track" style={{ transform: `translateX(-${slide * 100}%)` }}>
              {featured.map((p, i) => {
                const c = CATEGORIES[p.category];
                return (
                  <article key={p.slug} className="blog-hero__slide" style={{ '--cat': c.color }} aria-roledescription="slide" aria-label={`${i + 1} of ${featured.length}`} aria-hidden={i !== slide}>
                    <div className="blog-hero__text">
                      <span className="blog-pill blog-pill--outline">Featured article</span>
                      <h1 className="blog-hero__title">{p.title}</h1>
                      <p className="blog-hero__excerpt">{p.excerpt}</p>
                      <div className="blog-hero__row">
                        <PostMeta post={p} calendar />
                        <Link to={`/blog/${p.slug}`} className="blog-btn" tabIndex={i === slide ? 0 : -1}>Read article <ArrowRight size={16} /></Link>
                      </div>
                    </div>
                    <div className="blog-hero__art"><BlogCover post={p} large /></div>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="blog-hero__controls">
            <button type="button" className="blog-arrow" onClick={() => go(slide - 1)} aria-label="Previous article"><ChevronLeft size={16} /></button>
            <div className="blog-dots" role="tablist" aria-label="Choose a featured article">
              {featured.map((p, i) => (
                <button key={p.slug} type="button" role="tab" aria-selected={i === slide} aria-label={`Show article ${i + 1}`} className={`blog-dot${i === slide ? ' blog-dot--on' : ''}`} onClick={() => go(i)} />
              ))}
            </div>
            <button type="button" className="blog-arrow" onClick={() => go(slide + 1)} aria-label="Next article"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      <div className="blog-wrap">
        {/* ---- Standards tiles ---- */}
        <nav className="blog-tiles" aria-label="Browse by standard">
          {TILE_TOPICS.map((k) => {
            const c = CATEGORIES[k];
            return (
              <button key={k} type="button" className={`blog-tile${topic === k ? ' blog-tile--on' : ''}`} style={{ '--cat': c.color }} onClick={() => setTopic(topic === k ? 'all' : k)} aria-pressed={topic === k}>
                <span className="blog-tile__icon"><TopicIcon topic={k} /></span>
                <span>
                  <strong>{c.label}</strong>
                  <small>{c.sub}</small>
                </span>
              </button>
            );
          })}
          <Link to="/blog/categories" className="blog-tile blog-tile--all">
            <span><strong>View all</strong><small>Categories</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </nav>

        <div className="blog-layout">
          {/* ---- Articles ---- */}
          <main className="blog-main" id="latest">
            <div className="blog-main__head">
              <h2>{topic === 'all' ? 'Latest articles' : CATEGORIES[topic].label}</h2>
              <form className="blog-search" role="search" onSubmit={(e) => e.preventDefault()}>
                <Search size={16} aria-hidden="true" className="blog-search__icon" />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search articles" aria-label="Search articles" />
                {query && <button type="button" className="blog-search__clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
              </form>
            </div>

            {/* Topic filter for phones, where the sidebar sits below the articles. */}
            <div className="blog-chips" aria-label="Topics">
              <button type="button" className={`blog-chip${topic === 'all' ? ' blog-chip--on' : ''}`} onClick={() => setTopic('all')}>All</button>
              {Object.keys(CATEGORIES).filter((k) => counts[k]).map((k) => (
                <button key={k} type="button" className={`blog-chip${topic === k ? ' blog-chip--on' : ''}`} onClick={() => setTopic(k)}>{CATEGORIES[k].label}</button>
              ))}
            </div>

            <p className="blog-result" aria-live="polite">
              {filtered ? `${shown.length} article${shown.length === 1 ? '' : 's'} found` : `${all.length} articles`}
              {filtered && <button type="button" className="blog-result__reset" onClick={() => { setQuery(''); setTopic('all'); }}>Clear filters</button>}
            </p>

            {shown.length === 0 ? (
              <div className="blog-empty">
                <h3>No articles match your search</h3>
                <p>Try a different word, or clear the filters to see everything.</p>
              </div>
            ) : (
              <div className="blog-grid">
                {visible.map((p) => <PostCard key={p.slug} post={p} />)}
              </div>
            )}

            {shown.length > limit && (
              <div className="blog-more">
                <button type="button" className="blog-btn blog-btn--ghost" onClick={() => setLimit((n) => n + PAGE)}>Load more articles <ChevronDown size={16} /></button>
              </div>
            )}
          </main>

          {/* ---- Sidebar ---- */}
          <aside className="blog-side">
            <section className="blog-box blog-box--offer">
              <span className="blog-pill blog-pill--outline">New &middot; Limited time offer</span>
              <h3>What&apos;s your budget?</h3>
              <p>ISO 9001 for MICRO companies, from $500 to $1,500. Valid up to 31.12.2026.</p>
              <Link to="/micro/budget" className="blog-btn">See the offer <ArrowRight size={16} /></Link>
            </section>

            <section className="blog-box blog-box--accent">
              <ClipboardCheck size={30} aria-hidden="true" className="blog-box__icon" />
              <h3>Free gap analysis</h3>
              <p>Find out how close your organisation is to the standard, before you commit to certification.</p>
              <Link to="/gap-analysis" className="blog-btn">Start now <ArrowRight size={16} /></Link>
            </section>

            <section className="blog-box">
              <h3>Follow Certify.cx</h3>
              <p>Get new guides and updates on our channels.</p>
              <SocialLinks />
            </section>
          </aside>
        </div>

        {/* ---- Call to action ---- */}
        <section className="blog-cta">
          <BookOpen size={34} aria-hidden="true" className="blog-cta__icon" />
          <div>
            <h2>New to ISO standards?</h2>
            <p>Start your learning journey with our beginner-friendly guides, then compare certification options in one place.</p>
          </div>
          <Link to="/certifications" className="blog-btn blog-btn--light">Explore standards <ArrowRight size={16} /></Link>
        </section>
      </div>

      <BlogFooter />
    </div>
  );
}
