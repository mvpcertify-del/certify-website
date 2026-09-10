import { useNavigate } from 'react-router-dom';
import '../../pages/dashboard/MainDashboard.css';

// The box grid every dashboard uses.
//
// Client instruction, 8 Sep: after seeing the boxes applied to Training and
// Marketing Tools — "Yes, let us apply this format as standard for all types
// of dashboards."
//
// So it becomes a component rather than a pattern people copy. The Super Admin
// landing, the Referral Program Dashboard and the Training grid had already
// grown three separate copies of the same markup; a fourth and fifth for the
// auditor and certification-body screens is how a "standard" quietly stops
// being one. One implementation means a change to the card — a new state, a
// spacing fix, an RTL correction — lands everywhere at once.
//
// Each box is `{ key, icon, color, value, label, desc }` plus ONE way to act:
// `path` to navigate, or `onClick` to handle it in place (Training uses that to
// open a walkthrough underneath the grid rather than leaving the page).
//
// `value` is deliberately free-form. Most boxes show a count, some show money,
// one shows the partner's discount code and another reads "45 of 102" — the
// caller has the context to format it, and pushing that in here would mean a
// switch on units that grows with every new dashboard.
export default function DashboardBoxes({ boxes, loading = false, selectedKey = null }) {
  const navigate = useNavigate();

  return (
    <div className="main-dash__grid">
      {boxes.map((box) => {
        const Icon = box.icon;
        const selected = selectedKey != null && selectedKey === box.key;
        return (
          <button
            key={box.key}
            type="button"
            className={`main-dash__card${selected ? ' main-dash__card--selected' : ''}`}
            // Only set when the grid is a chooser, so a plain navigation grid
            // does not announce a collapsed/expanded state it does not have.
            {...(selectedKey != null ? { 'aria-expanded': selected } : {})}
            onClick={box.onClick ? box.onClick : () => navigate(box.path)}
            style={{ '--card-accent': box.color }}
          >
            <div
              className="main-dash__icon"
              style={{ background: `${box.color}1a`, color: box.color }}
            >
              <Icon size={24} />
            </div>
            {/* An em-dash, not a zero, when a figure could not be read: zero is
                a real answer and must not be faked. The ellipsis marks the
                short window where the count is still being fetched. */}
            <div className="main-dash__value">
              {loading ? '…' : (box.value == null ? '—' : box.value)}
            </div>
            <div className="main-dash__label">{box.label}</div>
            {box.desc && <div className="main-dash__desc">{box.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}
