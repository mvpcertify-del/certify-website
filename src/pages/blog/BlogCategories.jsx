import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import { CATEGORIES, sortedPosts } from '../../content/blog/posts';
import { BlogFooter, TopicIcon } from './BlogParts';
import usePageMeta from './usePageMeta';
import './Blog.css';

// /blog/categories: every category in one place, in two groups (the ISO standards and the other
// topics), each with its latest articles. A category opens the article list filtered to it.
export default function BlogCategories() {
  usePageMeta('Blog categories | Certify.cx™', 'Browse Certify.cx articles by ISO standard and topic.');

  const groups = useMemo(() => {
    const posts = sortedPosts();
    const byCat = {};
    for (const p of posts) (byCat[p.category] ||= []).push(p);
    const keys = Object.keys(CATEGORIES).filter((k) => byCat[k]);
    const card = (k) => ({ key: k, ...CATEGORIES[k], posts: byCat[k] });
    return [
      { title: 'ISO standards', note: 'Guides organised by the standard they cover.', items: keys.filter((k) => CATEGORIES[k].badge).map(card) },
      { title: 'Topics', note: 'Audits, risk, compliance, certification bodies and practical guides.', items: keys.filter((k) => !CATEGORIES[k].badge).map(card) },
    ].filter((g) => g.items.length);
  }, []);

  return (
    <div className="blog-page">
      <PublicNav />

      <header className="blog-post-hero">
        <div className="blog-wrap">
          <Link to="/blog" className="blog-back"><ArrowLeft size={15} /> All articles</Link>
          <h1 className="blog-post-hero__title">Categories</h1>
          <p className="blog-post-hero__excerpt">Browse every article by ISO standard or topic.</p>
        </div>
      </header>

      <main className="blog-wrap blog-cats-page">
        {groups.map((g) => (
          <section key={g.title} className="blog-cats-group">
            <div className="blog-cats-group__head">
              <h2>{g.title}</h2>
              <p>{g.note}</p>
            </div>
            <div className="blog-cats-grid">
              {g.items.map((c) => (
                <article key={c.key} className="blog-catcard" style={{ '--cat': c.color }}>
                  <Link to={`/blog?topic=${c.key}`} className="blog-catcard__head">
                    <span className="blog-tile__icon"><TopicIcon topic={c.key} /></span>
                    <span className="blog-catcard__name">
                      <strong>{c.label}</strong>
                      {c.sub && <small>{c.sub}</small>}
                    </span>
                    <em>{c.posts.length}</em>
                  </Link>
                  <ul>
                    {c.posts.slice(0, 3).map((p) => <li key={p.slug}><Link to={`/blog/${p.slug}`}>{p.title}</Link></li>)}
                  </ul>
                  <Link to={`/blog?topic=${c.key}`} className="blog-catcard__more">View all {c.posts.length} <ArrowRight size={14} /></Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      <BlogFooter />
    </div>
  );
}
