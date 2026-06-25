import Modal from './Modal';

// Read-only detail view for a single list row. It reuses the SAME display
// `columns` the DataTable already defines (label + optional render), so the
// detail popup always matches the table without a second source of truth.
//
// Pass the original display columns (the actions column is filtered out
// automatically) and the row object. Each field renders label + value, using
// the column's `render` when present so badges/dates look identical to the list.
//
// Props:
//   isOpen, onClose   modal open state.
//   title             modal heading (usually the row's name).
//   columns           the display columns array used by the table.
//   row               the row object to display (null = nothing rendered).
//   extraFields       optional [{ label, value }] appended after the columns.
export default function DetailModal({ isOpen, onClose, title, columns = [], row, extraFields = [] }) {
  if (!row) return null;

  const fields = columns.filter(c => c.key !== 'actions');

  const renderValue = (col) => {
    const raw = row[col.key];
    if (col.render) return col.render(raw, row);
    return raw === null || raw === undefined || raw === '' ? '—' : raw;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {fields.map((col) => (
          <div
            key={col.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              padding: '10px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
              {col.label}
            </span>
            <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>
              {renderValue(col)}
            </span>
          </div>
        ))}
        {extraFields.map((f, i) => (
          <div
            key={`extra-${i}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              padding: '10px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
              {f.label}
            </span>
            <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>
              {f.value === null || f.value === undefined || f.value === '' ? '—' : f.value}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
