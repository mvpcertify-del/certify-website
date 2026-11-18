import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DEPARTMENTS, departmentSlug } from '../../config/sidebarModules';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
import './MainDashboard.css';

// One department's landing page (client, 18 Nov): clicking a department in the menu opens this page and
// lists everything under it, working pages first and "coming soon" items below.
const COLOR = {
  dept_marketing: '#ec4899', dept_sales: '#10b981', dept_customer_service: '#0ea5e9',
  dept_operations: '#6366f1', dept_administration: '#f59e0b', dept_finance: '#14b8a6',
};

export default function DepartmentPage() {
  const { slug } = useParams();
  const dept = DEPARTMENTS.find((d) => departmentSlug(d) === slug);
  if (!dept) return <Navigate to="/main-dashboard" replace />;

  // Split the department's items into its headed sections.
  const sections = [];
  for (const it of dept.items) {
    if (it.heading) sections.push({ id: it.id, title: it.heading, boxes: [] });
    else sections[sections.length - 1].boxes.push({
      key: it.id, icon: dept.icon, path: it.path, color: COLOR[dept.id], noValue: true,
      label: it.label, desc: it.soon ? 'Coming soon' : 'Open',
    });
  }
  const Icon = dept.icon;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon size={28} style={{ color: COLOR[dept.id] }} /> {dept.label}
          </h1>
          <p className="page-subtitle">
            {sections.reduce((n, s) => n + s.boxes.length, 0)} items in this department. Working pages first, coming soon below.
          </p>
        </div>
        <Link to="/main-dashboard" className="main-dash__bar-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Main Dashboard
        </Link>
      </div>

      {sections.map((s) => (
        <section key={s.id} style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary, #6b7280)', margin: 0 }}>
            {s.title} <span style={{ opacity: 0.6 }}>({s.boxes.length})</span>
          </h2>
          <DashboardBoxes boxes={s.boxes} />
        </section>
      ))}
    </div>
  );
}
