import { Link } from 'react-router-dom';
import {
  Award, GraduationCap, ClipboardCheck, ShieldCheck, FileCheck2, Compass, Leaf, Lock, Wheat, TriangleAlert,
  Clock, CalendarDays, Linkedin, Youtube, Twitter, Facebook,
} from 'lucide-react';
import BrandLogo from '../../components/ui/BrandLogo';
import { CATEGORIES, formatDate } from '../../content/blog/posts';

const ICONS = { Award, GraduationCap, ClipboardCheck, ShieldCheck, FileCheck2, Compass, Leaf, Lock, Wheat, TriangleAlert };

/** A topic's icon, used on the topic tiles. */
export function TopicIcon({ topic, size = 20 }) {
  const Icon = ICONS[CATEGORIES[topic].icon] || Award;
  return <Icon size={size} aria-hidden="true" />;
}

/** Cover art: topic colour and icon on the brand green. The large version also shows the ISO name. */
export function BlogCover({ post, large = false }) {
  const cat = CATEGORIES[post.category];
  const Icon = ICONS[cat.icon] || Award;
  return (
    <div className={`blog-cover${large ? ' blog-cover--large' : ''}`} style={{ '--cat': cat.color }} aria-hidden="true">
      <span className="blog-cover__ring blog-cover__ring--a" />
      <span className="blog-cover__ring blog-cover__ring--b" />
      <div className="blog-cover__mark">
        <Icon className="blog-cover__icon" strokeWidth={1.4} />
        {large && cat.badge && <span className="blog-cover__badge">{cat.badge}</span>}
      </div>
    </div>
  );
}

export function PostMeta({ post, calendar = false }) {
  return (
    <div className="blog-meta">
      <span className="blog-meta__item">{calendar && <CalendarDays size={14} aria-hidden="true" />} {formatDate(post.date)}</span>
      <span className="blog-meta__dot" aria-hidden="true" />
      <span className="blog-meta__item"><Clock size={14} aria-hidden="true" /> {post.minutes} min read</span>
    </div>
  );
}

export function PostCard({ post }) {
  const cat = CATEGORIES[post.category];
  return (
    <Link to={`/blog/${post.slug}`} className="blog-card" style={{ '--cat': cat.color }}>
      <BlogCover post={post} />
      <div className="blog-card__body">
        <span className="blog-pill">{cat.label}</span>
        <h3 className="blog-card__title">{post.title}</h3>
        <PostMeta post={post} />
        <p className="blog-card__excerpt">{post.excerpt}</p>
      </div>
    </Link>
  );
}

const SOCIAL = [
  { href: 'https://www.linkedin.com/company/certifycx', label: 'LinkedIn', Icon: Linkedin },
  { href: 'https://www.youtube.com/@certifycx', label: 'YouTube', Icon: Youtube },
  { href: 'https://twitter.com/certifycx', label: 'X', Icon: Twitter },
  { href: 'https://www.facebook.com/certifycx', label: 'Facebook', Icon: Facebook },
];

export function SocialLinks() {
  return (
    <div className="blog-social">
      {SOCIAL.map((item) => {
        const Icon = item.Icon;
        return <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}><Icon size={16} /></a>;
      })}
    </div>
  );
}

export function BlogFooter() {
  const topics = ['iso-9001', 'iso-14001', 'iso-21001', 'iso-27001'];
  return (
    <footer className="blog-footer">
      <div className="blog-wrap">
        <div className="blog-footer__cols">
          <div className="blog-footer__brand">
            <BrandLogo size={34} />
            <p>Certify.cx helps organisations get ISO certified with ease and achieve compliance with confidence.</p>
            <SocialLinks />
          </div>
          <div className="blog-footer__col">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/certifications">Get certified</Link>
            <Link to="/gap-analysis">Gap analysis</Link>
          </div>
          <div className="blog-footer__col">
            <h4>ISO Standards</h4>
            {topics.map((k) => <Link key={k} to={`/blog?topic=${k}`}>{CATEGORIES[k].label}</Link>)}
            <Link to="/blog">All topics</Link>
          </div>
          <div className="blog-footer__col">
            <h4>Resources</h4>
            <Link to="/gap-analysis">Free gap analysis</Link>
            <Link to="/certifications">All certifications</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <div className="blog-footer__bar">
          <span>&copy; Certify.cx&trade; | Operated by Certify International OPC Private Limited</span>
          <span>Global Compliance Marketplace</span>
        </div>
      </div>
    </footer>
  );
}
