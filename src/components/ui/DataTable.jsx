import './DataTable.css';

// The row-action cluster is rendered FIRST, not last (client, 12 Aug: "IS IT
// POSSIBLE TO SHIFT THE 4 ICONS FROM THE RIGHT SIDE TO BECOME IN THE LEFT
// SIDE, SINCE TO CHANGE THE STATUS OF ANY USER, IT IS NOT POSSIBLE TO VIEW THE
// NAME WITH TOO MUCH DATA IN LINE").
//
// On a wide list — Referral Partners carries fourteen columns — the actions
// column sat past the right edge of the horizontal scroll area, so acting on a
// row meant scrolling right until the name that identifies it had scrolled off
// the left. Moving it to the first column puts the buttons next to the name
// instead, and neither has to be scrolled to.
//
// Done here rather than in each page so every list gets it and no future
// screen can forget: the pages keep declaring `actions` wherever it reads best
// in their column list, and the table decides where it is drawn.
//
// Note this is column ORDER, not CSS direction — Arabic (RTL) mirrors the whole
// table, so the cluster correctly ends up on the right for those users, which
// is the leading edge there.
function orderColumns(columns) {
  const list = columns || [];
  const actionsIndex = list.findIndex((c) => c && c.key === 'actions');
  if (actionsIndex <= 0) return list; // absent, or already first
  return [list[actionsIndex], ...list.slice(0, actionsIndex), ...list.slice(actionsIndex + 1)];
}

export default function DataTable({ columns, data, onRowClick, emptyMessage = 'No data available' }) {
  if (!data || data.length === 0) {
    return (
      <div className="data-table__empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const orderedColumns = orderColumns(columns);

  return (
    <div className="data-table__wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {orderedColumns.map((col) => (
              <th
                key={col.key}
                className={`data-table__th${col.key === 'actions' ? ' data-table__th--actions' : ''}`}
                style={col.width ? { width: col.width } : {}}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              className={`data-table__row ${onRowClick ? 'data-table__row--clickable' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {orderedColumns.map((col) => (
                <td
                  key={col.key}
                  className={`data-table__td${col.key === 'actions' ? ' data-table__td--actions' : ''}`}
                  data-label={col.label}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
