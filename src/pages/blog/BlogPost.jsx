import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import { AUTHOR, CATEGORIES, formatDate, getPost, sortedPosts } from '../../content/blog/posts';
import { BlogCover, PostCard, BlogFooter } from './BlogParts';
import usePageMeta from './usePageMeta';
import './Blog.css';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// One article (/blog/:slug): headline, cover, readable body with a table of contents,
// a call to action and related articles.
export default function BlogPost() {
  const { slug } = useParams();
  const post = getPost(slug);

  usePageMeta(post ? `${post.title} | Certify.cx™ — Global Compliance Marketplace` : 'Blog | Certify.cx™ — Global Compliance Marketplace', post?.excerpt);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

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
              {headings.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}
            </ul>
          </aside>

          <div className="blog-prose">
            <BlogCover post={post} large />
            {post.body.map((b, i) => {
              if (b.t === 'h2') return <h2 key={i} id={slugify(b.x)}>{b.x}</h2>;
              if (b.t === 'ul') return <ul key={i}>{b.items.map((it) => <li key={it}>{it}</li>)}</ul>;
              if (b.t === 'ol') return <ol key={i}>{b.items.map((it) => <li key={it}>{it}</li>)}</ol>;
              if (b.t === 'note') return <aside key={i} className="blog-note"><Lightbulb size={18} aria-hidden="true" /><p>{b.x}</p></aside>;
              return <p key={i}>{b.x}</p>;
            })}

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

