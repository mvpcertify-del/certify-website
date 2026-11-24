// Finance ERP: financial statements built from the POSTED ledger (pure functions, tested in tests/finance/statements.test.mjs).
//
//   Statement of profit or loss   IFRS 18 categories: operating, investing, financing, income tax, discontinued operations,
//                                 then other comprehensive income. The category of an account is its ifrs_class on the chart
//                                 (set per account on Chart of Accounts), so it can be changed without touching code.
//   Statement of financial position  assets, liabilities and equity as at a date, grouped by the chart's groups.
//
// Sign convention in the profit or loss statement: every amount is credit minus debit, so income is positive and a cost is
// negative (shown in brackets on screen). Totals are plain sums, so nothing is hidden.
//
// Nothing here posts or changes anything. There are no closing entries yet, so the result of the period is carried into
// equity on the statement of financial position as "Result not yet closed to retained earnings".

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const credit = (m) => (m ? Number(m.credit) - Number(m.debit) : 0); // credit minus debit
const PNL_CATEGORIES = new Set(['revenue', 'cost_of_revenue', 'expense', 'finance_other']);

const line = (a, amount) => ({ code: a.code, name: a.name, amount: r2(amount) });
const sum = (rows) => r2(rows.reduce((s, x) => s + x.amount, 0));
const section = (lines) => ({ lines, total: sum(lines) });

/**
 * accounts   chart rows: { code, name, category, parent_code, is_header, ifrs_class }
 * movement   { [code]: { debit, credit } } posted lines inside the period
 * cumulative { [code]: { debit, credit } } posted lines from the beginning up to the end of the period
 * Returns { pnl, position, warnings }.
 */
export function buildStatements({ accounts, movement = {}, cumulative = {} }) {
  const posting = accounts.filter((a) => !a.is_header);
  const byCode = Object.fromEntries(accounts.map((a) => [a.code, a]));
  const warnings = [];

  // ---------------------------------------------------------------- profit or loss
  const buckets = { revenue: [], cost_of_revenue: [], operating_expenses: [], operating_other: [], investing: [], financing: [], income_tax: [], discontinued: [], oci: [] };
  for (const a of posting) {
    const amount = credit(movement[a.code]);
    if (!amount) continue;
    if (a.category === 'oci') { buckets.oci.push(line(a, amount)); continue; }
    if (!PNL_CATEGORIES.has(a.category)) continue;
    const cls = a.ifrs_class;
    if (cls === 'investing' || cls === 'financing' || cls === 'income_tax' || cls === 'discontinued') { buckets[cls].push(line(a, amount)); continue; }
    if (cls === 'operating' && a.category === 'finance_other') { buckets.operating_other.push(line(a, amount)); continue; }
    if (a.category === 'finance_other') { buckets.operating_other.push(line(a, amount)); warnings.push(`${a.code} ${a.name} has no IFRS class, so it is shown under operating. Set its class on the Chart of Accounts.`); continue; }
    if (cls !== 'operating') warnings.push(`${a.code} ${a.name} has no operating class, so it is shown under operating. Set its class on the Chart of Accounts.`);
    buckets[a.category === 'revenue' ? 'revenue' : a.category === 'cost_of_revenue' ? 'cost_of_revenue' : 'operating_expenses'].push(line(a, amount));
  }
  const S = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, section(v)]));
  const grossProfit = r2(S.revenue.total + S.cost_of_revenue.total);
  const operatingProfit = r2(grossProfit + S.operating_expenses.total + S.operating_other.total);
  const profitBeforeTax = r2(operatingProfit + S.investing.total + S.financing.total);
  const profitContinuing = r2(profitBeforeTax + S.income_tax.total);
  const profit = r2(profitContinuing + S.discontinued.total);
  const pnl = {
    revenue: S.revenue, costOfRevenue: S.cost_of_revenue, grossProfit,
    operatingExpenses: S.operating_expenses, operatingOther: S.operating_other, operatingProfit,
    investing: S.investing, financing: S.financing, profitBeforeTax,
    incomeTax: S.income_tax, profitContinuing, discontinued: S.discontinued, profit,
    oci: S.oci, totalComprehensive: r2(profit + S.oci.total),
  };

  // ---------------------------------------------------------------- financial position
  const groupOf = (code) => {
    const hundreds = String(Math.floor(Number(code) / 100) * 100);
    const thousands = String(Math.floor(Number(code) / 1000) * 1000);
    const g = byCode[hundreds] && byCode[hundreds].is_header ? byCode[hundreds] : byCode[thousands];
    return g ? { code: g.code, name: g.name } : { code: thousands, name: thousands };
  };
  const groups = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const g = groupOf(r.code);
      if (!map.has(g.code)) map.set(g.code, { code: g.code, name: g.name, lines: [] });
      map.get(g.code).lines.push(r);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code)).map((g) => ({ ...g, total: sum(g.lines) }));
  };

  const assets = []; const liabilities = []; const equity = [];
  let controlNet = 0; const controlLines = [];
  let result = 0; let ociReserve = 0;
  for (const a of posting) {
    const m = cumulative[a.code];
    if (!m) continue;
    const dr = r2(Number(m.debit) - Number(m.credit)); // debit minus credit
    if (!dr) continue;
    if (a.category === 'asset') assets.push(line(a, dr));
    else if (a.category === 'liability') liabilities.push(line(a, -dr));
    else if (a.category === 'equity') equity.push(line(a, -dr));
    else if (a.category === 'control') { controlNet = r2(controlNet + dr); controlLines.push(line(a, dr)); }
    else if (a.category === 'oci') ociReserve = r2(ociReserve - dr);
    else if (PNL_CATEGORIES.has(a.category)) result = r2(result - dr);
  }
  const clearingAssets = controlNet > 0 ? [{ code: '9000', name: 'Clearing and suspense accounts (debit balance)', amount: controlNet }] : [];
  const clearingLiabs = controlNet < 0 ? [{ code: '9000', name: 'Clearing and suspense accounts (credit balance)', amount: -controlNet }] : [];
  const equityLines = [...equity];
  if (result) equityLines.push({ code: 'RESULT', name: 'Result not yet closed to retained earnings', amount: result });
  if (ociReserve) equityLines.push({ code: 'OCI', name: 'Other comprehensive income reserve', amount: ociReserve });

  const assetGroups = groups(assets);
  const liabilityGroups = groups(liabilities);
  if (clearingAssets.length) assetGroups.push({ code: '9000', name: 'Clearing accounts', lines: clearingAssets, total: clearingAssets[0].amount });
  if (clearingLiabs.length) liabilityGroups.push({ code: '9000', name: 'Clearing accounts', lines: clearingLiabs, total: clearingLiabs[0].amount });
  const totalAssets = r2(assetGroups.reduce((s, g) => s + g.total, 0));
  const totalLiabilities = r2(liabilityGroups.reduce((s, g) => s + g.total, 0));
  const totalEquity = sum(equityLines);
  const difference = r2(totalAssets - totalLiabilities - totalEquity);

  return {
    pnl,
    position: {
      assets: { groups: assetGroups, total: totalAssets },
      liabilities: { groups: liabilityGroups, total: totalLiabilities },
      equity: { lines: equityLines, total: totalEquity },
      totalLiabilitiesAndEquity: r2(totalLiabilities + totalEquity),
      difference, balanced: Math.abs(difference) < 0.005,
    },
    warnings: [...new Set(warnings)],
  };
}

/** Adds up posted lines per account. lines: [{ account_code, debit, credit }]. */
export function sumLines(lines) {
  const acc = {};
  for (const l of lines) {
    const a = (acc[l.account_code] ||= { debit: 0, credit: 0 });
    a.debit = r2(a.debit + Number(l.debit));
    a.credit = r2(a.credit + Number(l.credit));
  }
  return acc;
}
