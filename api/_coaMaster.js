// Certify.cx™ Master Chart of Accounts, IFRS edition V1.0 (client spec, 20 Nov 2026).
//
// This file is the single source of the V1.0 account list. It is used to
//   - generate the database seed (scripts/build-coa-sql.mjs -> supabase/phase51_chart_of_accounts.sql),
//   - check the structure in tests (tests/finance/coa.test.mjs).
// The live chart is the coa_accounts table. Edit accounts there (Finance > Chart of Accounts); do not
// change this file for a revision. A new revision is documented as V1.1 and never overwrites V1.0.
//
// Line format:  code | name | normal balance      A leading # marks a group (header) account that cannot be posted to.
// Dr/Cr in the spec means the balance direction depends on the movement.

export const COA_VERSION = 'V1.0';
export const COA_TITLE = 'Certify.cx™ Master Chart of Accounts, IFRS Edition V1.0';

const RAW = `
#1000|ASSETS|Dr
#1100|Current Assets|Dr
1101|Cash on Hand|Dr
1102|Petty Cash|Dr
1110|Bank Account – USD|Dr
1111|Bank Account – EUR|Dr
1112|Bank Account – GBP|Dr
1113|Bank Account – AED|Dr
1114|Bank Account – Other Currencies|Dr
1120|Payment Gateway Clearing|Dr
1121|Stripe Clearing|Dr
1122|Other Payment Processor Clearing|Dr
1130|Accounts Receivable – Customers|Dr
1131|Accounts Receivable – Corporate Clients|Dr
1132|Accounts Receivable – Other|Dr
1139|Allowance for Expected Credit Losses|Cr
1140|Refund Receivable|Dr
1150|Prepaid Expenses|Dr
1151|Prepaid Software Subscriptions|Dr
1152|Prepaid Insurance|Dr
1153|Prepaid Marketing|Dr
1160|Employee Advances|Dr
1170|VAT / Recoverable Tax|Dr
1180|Inventory and Supplies|Dr
1190|Other Current Assets|Dr
#1200|Non-Current Assets|Dr
1201|Computer Equipment|Dr
1202|Office Equipment|Dr
1203|Furniture and Fixtures|Dr
1204|Vehicles|Dr
1210|Software Development Asset|Dr
1211|Capitalized Platform Development|Dr
1212|Capitalized Software Licences|Dr
1220|Accumulated Depreciation – Equipment|Cr
1221|Accumulated Depreciation – Furniture|Cr
1222|Accumulated Depreciation – Vehicles|Cr
1223|Accumulated Amortization – Software|Cr
1230|Right-of-Use Assets|Dr
1231|Accumulated Depreciation – Right-of-Use Assets|Cr
1240|Long-Term Investments|Dr
1250|Deferred Tax Assets|Dr
1260|Security Deposits|Dr
1270|Other Non-Current Assets|Dr
#2000|LIABILITIES|Cr
#2100|Current Liabilities|Cr
2101|Accounts Payable – Suppliers|Cr
2102|Accounts Payable – Contractors|Cr
2103|Accounts Payable – Employees|Cr
2110|Certification Body Funds Payable|Cr
2111|Auditor Fees Payable|Cr
2112|Training Provider Fees Payable|Cr
2113|Inspection Provider Fees Payable|Cr
2120|Referral Partner Commissions Payable|Cr
2121|Affiliate Commissions Payable|Cr
2130|Customer Refunds Payable|Cr
2131|Customer Credits Payable|Cr
2140|Deferred Subscription Revenue|Cr
2141|Deferred Compliance Subscription Revenue|Cr
2142|Deferred Training Revenue|Cr
2150|VAT Payable|Cr
2151|Sales Tax Payable|Cr
2152|Withholding Tax Payable|Cr
2160|Salaries Payable|Cr
2161|Employee Benefits Payable|Cr
2170|Accrued Expenses|Cr
2171|Accrued Audit Fees|Cr
2172|Accrued Marketing Expenses|Cr
2180|Customer Deposits|Cr
2190|Other Current Liabilities|Cr
#2200|Non-Current Liabilities|Cr
2201|Long-Term Loans Payable|Cr
2202|Lease Liabilities|Cr
2203|Long-Term Employee Benefits|Cr
2204|Deferred Tax Liabilities|Cr
2205|Other Long-Term Liabilities|Cr
#3000|EQUITY|Cr
3101|Share Capital|Cr
3102|Additional Paid-in Capital|Cr
3103|Share Premium|Cr
3110|Retained Earnings|Cr
3111|Accumulated Profits|Cr
3112|Accumulated Losses|Dr
3120|Current Year Profit|Cr
3121|Current Year Loss|Dr
3130|Dividends Declared|Dr
3140|Foreign Currency Translation Reserve|Cr
3150|Other Comprehensive Income Reserve|Cr
3160|Share-Based Payment Reserve|Cr
3170|Treasury Shares|Dr
3180|Other Equity Reserves|Cr
#4000|REVENUE|Cr
#4100|Marketplace Revenue|Cr
4101|ISO Certification Marketplace Commission Revenue|Cr
4102|Non-ISO Certification Marketplace Revenue|Cr
4103|Certification Service Facilitation Revenue|Cr
4104|Certification Application Processing Revenue|Cr
4105|Audit Coordination Revenue|Cr
4106|Inspection Marketplace Revenue|Cr
4107|Training Marketplace Commission Revenue|Cr
#4200|Subscription Revenue|Cr
4201|AI Compliance Subscription Revenue|Cr
4202|ISO 9001 Subscription Revenue|Cr
4203|ISO 14001 Subscription Revenue|Cr
4204|ISO 45001 Subscription Revenue|Cr
4205|ISO 22000 Subscription Revenue|Cr
4206|ISO/IEC 27001 Subscription Revenue|Cr
4207|ISO 13485 Subscription Revenue|Cr
4208|SOC 2 Subscription Revenue|Cr
4209|Other Compliance Subscription Revenue|Cr
#4300|Other Platform Revenue|Cr
4301|Premium Platform Services Revenue|Cr
4302|Document Management Revenue|Cr
4303|Additional User / Seat Revenue|Cr
4304|API / Integration Revenue|Cr
4305|Platform Setup Revenue|Cr
4306|Consulting Services Revenue|Cr
4307|Training Revenue|Cr
4308|Other Service Revenue|Cr
#4400|Other Operating Income|Cr
4401|Affiliate Programme Revenue|Cr
4402|Advertising Revenue|Cr
4403|Data / Analytics Services Revenue|Cr
4404|Other Operating Income|Cr
#4900|Contra-Revenue|Dr
4901|Sales Discounts|Dr
4902|Promotional Discounts|Dr
4903|Customer Refunds|Dr
4904|Chargebacks|Dr
4905|Sales Adjustments|Dr
#5000|COST OF REVENUE|Dr
#5100|Marketplace Direct Costs|Dr
5101|Certification Body Service Costs|Dr
5102|Auditor Service Costs|Dr
5103|Training Provider Costs|Dr
5104|Inspection Provider Costs|Dr
5105|External Technical Service Costs|Dr
5106|Marketplace Fulfilment Costs|Dr
#5200|Payment and Transaction Costs|Dr
5201|Payment Gateway Fees|Dr
5202|Bank Transaction Fees|Dr
5203|Currency Conversion Fees|Dr
5204|Chargeback Processing Fees|Dr
#5300|Technology Service Costs|Dr
5301|Cloud Hosting Costs|Dr
5302|Database Hosting Costs|Dr
5303|AI API Usage Costs|Dr
5304|Third-Party Software API Costs|Dr
5305|Platform Infrastructure Costs|Dr
5306|Customer Support Technology Costs|Dr
#5400|Revenue-Related Commissions|Dr
5401|Referral Partner Commission Expense|Dr
5402|Affiliate Commission Expense|Dr
5403|Sales Agent Commission Expense|Dr
5404|Marketplace Partner Commission Expense|Dr
#6000|OPERATING EXPENSES|Dr
#6100|Personnel Expenses|Dr
6101|Salaries and Wages|Dr
6102|Management Compensation|Dr
6103|Employee Benefits|Dr
6104|Payroll Taxes|Dr
6105|Recruitment Expenses|Dr
6106|Employee Training|Dr
6107|Freelancers and Consultants|Dr
#6200|Marketing and Sales Expenses|Dr
6201|Digital Advertising|Dr
6202|Social Media Marketing|Dr
6203|SEO Expenses|Dr
6204|Content Creation|Dr
6205|Email Marketing|Dr
6206|Marketing Automation|Dr
6207|Sales Campaign Expenses|Dr
6208|Public Relations|Dr
6209|Branding and Design|Dr
#6300|Technology and Development Expenses|Dr
6301|Software Maintenance|Dr
6302|Non-Capitalized Software Development|Dr
6303|Cybersecurity Expenses|Dr
6304|IT Support|Dr
6305|Domain and Hosting Expenses|Dr
6306|Software Licences and Tools|Dr
6307|Data Protection Expenses|Dr
6308|Technology Research and Development|Dr
#6400|General and Administrative Expenses|Dr
6401|Office Rent|Dr
6402|Utilities|Dr
6403|Office Supplies|Dr
6404|Telephone and Internet|Dr
6405|Travel and Accommodation|Dr
6406|Business Meetings|Dr
6407|Legal Fees|Dr
6408|Accounting and Audit Fees|Dr
6409|Insurance Expenses|Dr
6410|Government and Licensing Fees|Dr
6411|Professional Memberships|Dr
6412|Bank Administration Fees|Dr
6413|General Administrative Expenses|Dr
#6500|Depreciation and Amortization|Dr
6501|Depreciation – Equipment|Dr
6502|Depreciation – Furniture|Dr
6503|Depreciation – Vehicles|Dr
6504|Depreciation – Right-of-Use Assets|Dr
6505|Amortization – Capitalized Software|Dr
#6600|Other Operating Expenses|Dr
6601|Bad Debt / Impairment Expense|Dr
6602|Expected Credit Loss Expense|Dr
6603|Customer Support Expenses|Dr
6604|Business Development Expenses|Dr
6605|Other Operating Expenses|Dr
#7000|FINANCE, INVESTING AND OTHER ITEMS|Dr/Cr
#7100|Finance Income|Cr
7101|Interest Income|Cr
7102|Investment Income|Cr
7103|Foreign Exchange Gains|Cr
7104|Other Finance Income|Cr
#7200|Finance Costs|Dr
7201|Interest Expense|Dr
7202|Loan Financing Costs|Dr
7203|Lease Interest Expense|Dr
7204|Foreign Exchange Losses|Dr
7205|Other Finance Costs|Dr
#7300|Investing Income and Expenses|Dr/Cr
7301|Gains on Disposal of Assets|Cr
7302|Losses on Disposal of Assets|Dr
7303|Investment Disposal Gains|Cr
7304|Investment Disposal Losses|Dr
7305|Impairment of Investments|Dr
#7400|Income Tax|Dr/Cr
7401|Current Income Tax Expense|Dr
7402|Deferred Income Tax Expense|Dr
7403|Deferred Tax Income|Cr
7404|Prior-Year Tax Adjustments|Dr/Cr
#8000|OTHER COMPREHENSIVE INCOME (OCI)|Dr/Cr
8101|Foreign Currency Translation – OCI|Cr
8102|Fair Value Changes – OCI|Cr
8103|Cash Flow Hedge Reserve – OCI|Cr
8104|Remeasurement of Defined Benefit Plans – OCI|Dr/Cr
8105|Other OCI Adjustments|Dr/Cr
#9000|CONTROL AND CLEARING ACCOUNTS|Dr/Cr
9101|Suspense Account|Dr/Cr
9102|Unallocated Customer Receipts|Cr
9103|Unallocated Supplier Payments|Dr
9104|Intercompany Receivables|Dr
9105|Intercompany Payables|Cr
9106|Payment Reconciliation Clearing|Dr/Cr
9107|Foreign Currency Revaluation Clearing|Dr/Cr
9108|Opening Balance Clearing|Dr/Cr
9109|System Migration Clearing|Dr/Cr
`;

/** First digit of the code -> account category. */
export const CATEGORY_BY_DIGIT = {
  1: 'asset', 2: 'liability', 3: 'equity', 4: 'revenue', 5: 'cost_of_revenue',
  6: 'expense', 7: 'finance_other', 8: 'oci', 9: 'control',
};

export const CATEGORY_LABEL = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', cost_of_revenue: 'Cost of revenue',
  expense: 'Operating expenses', finance_other: 'Finance, investing and tax', oci: 'Other comprehensive income', control: 'Control and clearing',
};

/** Contra accounts (their balance runs against their category). */
export const CONTRA = new Set(['1139', '1220', '1221', '1222', '1223', '1231', '4901', '4902', '4903', '4904', '4905']);

/** Sub-accounts whose parent is an account, not a group. */
const PARENT = {
  1121: '1120', 1122: '1120', 1131: '1130', 1132: '1130', 1139: '1130', 1151: '1150', 1152: '1150', 1153: '1150',
  1211: '1210', 1212: '1210', 1231: '1230',
  2111: '2110', 2112: '2110', 2113: '2110', 2121: '2120', 2131: '2130', 2141: '2140', 2142: '2140',
  2151: '2150', 2152: '2150', 2161: '2160', 2171: '2170', 2172: '2170',
};

/**
 * Default IFRS 18 reporting class. NOT derived from the numbering and fully editable per account in the app:
 * the spec requires a configurable mapping. These are starting points to be validated by the finance team.
 */
function defaultIfrs(code) {
  const n = Number(code);
  if (n >= 4000 && n < 7000) return 'operating';
  if (n >= 7000 && n < 7100) return 'none';
  if (n === 7103 || n === 7204) return 'operating'; // exchange differences follow the item that gave rise to them
  if (n >= 7100 && n < 7200) return 'investing';
  if (n >= 7200 && n < 7300) return 'financing';
  if (n >= 7300 && n < 7400) return 'investing';
  if (n >= 7400 && n < 7500) return 'income_tax';
  if (n >= 8000 && n < 9000) return 'oci';
  return 'none'; // balance sheet and control accounts
}

const lines = RAW.trim().split('\n').map((l) => l.trim()).filter(Boolean);
const codes = new Set(lines.map((l) => l.replace('#', '').split('|')[0]));

export const ACCOUNTS = lines.map((line) => {
  const isHeader = line.startsWith('#');
  const [code, name, normal] = line.replace('#', '').split('|');
  const n = Number(code);
  let parent = PARENT[code] || null;
  if (!parent && !(isHeader && n % 1000 === 0)) {
    const hundreds = String(Math.floor(n / 100) * 100);
    const thousands = String(Math.floor(n / 1000) * 1000);
    parent = codes.has(hundreds) && hundreds !== code ? hundreds : thousands;
  }
  return {
    code,
    name,
    category: CATEGORY_BY_DIGIT[code[0]],
    parent,
    normal,
    isHeader,
    isContra: CONTRA.has(code),
    allowPosting: !isHeader,
    ifrs: defaultIfrs(code),
  };
});
