import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Users, MapPin, FileText, Minus, Plus } from 'lucide-react';
import {
  getPriceForStandard,
  calcPackageTotal,
  CALC_EMPLOYEES_INCLUDED,
  CALC_LOCATIONS_INCLUDED,
  CALC_CHARGE_PER_LOCATION,
} from '../../utils/pricing';
import './PricingCalculator.css';

// Clamp a free-typed value to a sane non-negative integer with a floor.
function clamp(value, min) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

// Numeric stepper with +/- buttons. Declared at module scope so its <input>
// keeps focus across the parent's re-renders.
function Stepper({ value, onChange, min, decLabel, incLabel }) {
  return (
    <div className="pricing-calc__stepper">
      <button
        type="button"
        className="pricing-calc__step-btn"
        onClick={() => onChange(clamp(value - 1, min))}
        disabled={value <= min}
        aria-label={decLabel}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        min={min}
        className="pricing-calc__input"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : clamp(e.target.value, min))}
        onBlur={(e) => onChange(clamp(e.target.value, min))}
      />
      <button
        type="button"
        className="pricing-calc__step-btn"
        onClick={() => onChange(clamp(value + 1, min))}
        aria-label={incLabel}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// Public ISO landing-page calculator. Buyer enters an exact headcount and a
// number of locations; the package total updates live and a printable
// invoice can be generated with every line item broken out.
//
//   standardSlug  which standard's Standard-tier price is the base package
//   standardCode  display label for the standard (e.g. "ISO 9001:2015")
//   accent        accent colour from the ISO catalog entry
export default function PricingCalculator({ standardSlug = 'iso-9001', standardCode = 'ISO 9001', accent = '#3ECF8E' }) {
  const { t, i18n } = useTranslation();

  const basePrice = getPriceForStandard(standardSlug, 'bronze');

  const [employeeCount, setEmployeeCount] = useState(CALC_EMPLOYEES_INCLUDED);
  const [locationCount, setLocationCount] = useState(CALC_LOCATIONS_INCLUDED);

  const { employeeCharge, locationCharge, total } = calcPackageTotal({
    basePrice,
    employeeCount,
    locationCount,
  });

  const money = (n) => `$${Number(n).toLocaleString()}`;

  const handleGenerateInvoice = () => {
    const dateStr = new Date().toLocaleDateString(i18n.language || undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const dir = i18n.dir ? i18n.dir() : 'ltr';

    const rows = [
      { label: `${t('pricing.calculator.basePackage')} — ${standardCode}`, value: money(basePrice) },
      {
        label: `${t('pricing.calculator.employeeCharges')} (${employeeCount} ${t('pricing.calculator.employeesUnit')})`,
        value: employeeCharge > 0 ? money(employeeCharge) : t('pricing.calculator.included'),
      },
      {
        label: `${t('pricing.calculator.locationCharges')} (${locationCount} ${t('pricing.calculator.locationsUnit')})`,
        value: locationCharge > 0 ? money(locationCharge) : t('pricing.calculator.included'),
      },
    ];

    const rowsHtml = rows.map(r => `
      <tr>
        <td>${r.label}</td>
        <td class="amount">${r.value}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${i18n.language || 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${t('pricing.calculator.invoiceTitle')} — ${standardCode}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; padding: 40px; }
    .invoice { max-width: 640px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 20px; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 800; }
    .brand span { color: ${accent}; }
    .doc-title { text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; color: #64748b; font-weight: 700; }
    .meta { text-align: end; font-size: 13px; color: #64748b; line-height: 1.6; }
    .meta strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: start; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; padding: 0 0 10px; border-bottom: 1px solid #e2e8f0; }
    th.amount, td.amount { text-align: end; }
    td { padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    td.amount { font-weight: 600; }
    .total-row td { border-bottom: none; border-top: 2px solid #0f172a; font-size: 17px; font-weight: 800; padding-top: 18px; }
    .foot { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="head">
      <div>
        <div class="brand">Certify<span>.cx</span></div>
        <div class="doc-title">${t('pricing.calculator.invoiceTitle')}</div>
      </div>
      <div class="meta">
        <div><strong>${standardCode}</strong></div>
        <div>${t('pricing.calculator.invoiceDate')}: ${dateStr}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${t('pricing.calculator.invoiceItem')}</th>
          <th class="amount">${t('pricing.calculator.invoiceAmount')}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td>${t('pricing.calculator.finalTotal')}</td>
          <td class="amount">${money(total)}</td>
        </tr>
      </tbody>
    </table>
    <div class="foot">${t('pricing.calculator.invoiceFooter')}</div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="pricing-calc" style={{ '--calc-accent': accent }}>
      <div className="pricing-calc__header">
        <div className="pricing-calc__header-icon">
          <Calculator size={20} />
        </div>
        <div>
          <h3 className="pricing-calc__title">{t('pricing.calculator.title')}</h3>
          <p className="pricing-calc__subtitle">{t('pricing.calculator.subtitle')}</p>
        </div>
      </div>

      <div className="pricing-calc__body">
        {/* Inputs */}
        <div className="pricing-calc__fields">
          <div className="pricing-calc__field">
            <label className="pricing-calc__label">
              <Users size={16} /> {t('pricing.calculator.employeesLabel')}
            </label>
            <Stepper
              value={employeeCount}
              onChange={setEmployeeCount}
              min={1}
              decLabel={t('pricing.calculator.decreaseEmployees')}
              incLabel={t('pricing.calculator.increaseEmployees')}
            />
            <span className="pricing-calc__hint">{t('pricing.calculator.employeesHint')}</span>
          </div>

          <div className="pricing-calc__field">
            <label className="pricing-calc__label">
              <MapPin size={16} /> {t('pricing.calculator.locationsLabel')}
            </label>
            <Stepper
              value={locationCount}
              onChange={setLocationCount}
              min={1}
              decLabel={t('pricing.calculator.decreaseLocations')}
              incLabel={t('pricing.calculator.increaseLocations')}
            />
            <span className="pricing-calc__hint">
              {t('pricing.calculator.locationsHint', { amount: money(CALC_CHARGE_PER_LOCATION) })}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="pricing-calc__summary">
          <h4 className="pricing-calc__summary-title">{t('pricing.calculator.summaryTitle')}</h4>

          <div className="pricing-calc__line">
            <span>{t('pricing.calculator.basePackage')}</span>
            <span className="pricing-calc__line-value">{money(basePrice)}</span>
          </div>
          <div className="pricing-calc__line">
            <span>{t('pricing.calculator.employeeCharges')}</span>
            <span className="pricing-calc__line-value">
              {employeeCharge > 0 ? `+${money(employeeCharge)}` : t('pricing.calculator.included')}
            </span>
          </div>
          <div className="pricing-calc__line">
            <span>{t('pricing.calculator.locationCharges')}</span>
            <span className="pricing-calc__line-value">
              {locationCharge > 0 ? `+${money(locationCharge)}` : t('pricing.calculator.included')}
            </span>
          </div>

          <div className="pricing-calc__total">
            <span>{t('pricing.calculator.finalTotal')}</span>
            <span className="pricing-calc__total-value">{money(total)}</span>
          </div>

          <button type="button" className="pricing-calc__invoice-btn" onClick={handleGenerateInvoice}>
            <FileText size={16} /> {t('pricing.calculator.generateInvoice')}
          </button>
        </div>
      </div>
    </div>
  );
}
