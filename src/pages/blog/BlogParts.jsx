import { Link } from 'react-router-dom';
import { Award, GraduationCap, ClipboardCheck, ShieldCheck, FileCheck2, Compass, Clock } from 'lucide-react';
import BrandLogo from '../../components/ui/BrandLogo';
import { CATEGORIES, formatDate } from '../../content/blog/posts';

const ICONS = { Award, GraduationCap, ClipboardCheck, ShieldCheck, FileCheck2, Compass };

/** Cover art: category colour and icon on the brand green. No image files needed. */
export function BlogCover({ post, large = false }) {
  const cat = CATEGORIES[post.category];
  const Icon = ICONS[cat.icon] || Award;
  return (
    <div className={`blog-cover${large ? ' blog-cover--large' : ''}`} style={{ '--cat': cat.color }} aria-hidden="true">
      <span className="blog-cover__ring blog-cover__ring--a" />
      <span className="blog-cover__ring blog-cover__ring--b" />
      <Icon className="blog-cover__icon" strokeWidth={1.4} />
      <span className="blog-cover__tag">{cat.label}</span>
    </div>
  );
}

export function PostMeta({ post }) {
  return (
    <div className="blog-meta">
      <span>{formatDate(post.date)}</span>
      <span className="blog-meta__dot" aria-hidden="true" />
      <span className="blog-meta__read"><Clock size={13} aria-hidden="true" /> {post.minutes} min read</span>
    </div>
  );
}

export function PostCard({ post }) {
  const cat = CATEGORIES[post.category];
  return (
    <Link to={`/blog/${post.slug}`} className="blog-card" style={{ '--cat': cat.color }}>
      <BlogCover post={post} />
      <div className="blog-card__body">
        <span className="blog-chip-label">{cat.label}</span>
        <h3 className="blog-card__title">{post.title}</h3>
        <p className="blog-card__excerpt">{post.excerpt}</p>
        <PostMeta post={post} />
      </div>
    </Link>
  );
}

export function BlogFooter() {
  return (
    <footer className="blog-footer">
      <div className="blog-wrap blog-footer__inner">
        <BrandLogo size={30} />
        <p className="blog-footer__tag">Global Compliance Marketplace</p>
        <nav className="blog-footer__links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/certifications">Get certified</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
      <p className="blog-footer__copy">&copy; Certify.cx&trade; | Operated by Certify International OPC Private Limited</p>
    </footer>
  );
}
