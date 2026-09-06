import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './FormElements';

// Two name boxes — First Name / Last Name — over one stored value.
//
// Client instruction (6 Sep), pointing at the referral partner's "Add Client"
// form: "MODIFY & SPLIT IN ALL FORMS AS FOLLOWS: First Name xxxxx  Last Name
// xxxxx". "All forms" is the operative half, so this is a component rather than
// two <Input>s copied into each screen: there are eight places that collect a
// person's name and they must not drift apart.
//
// The pair reads and writes ONE string — the same `full_name` every screen,
// email, contract and certificate in the app already prints. This is the same
// shape as the phone control in ProfileManagementTable, which shows a dial-code
// select and a number box over a single stored phone string, and it is chosen
// for the same reason: splitting the storage would mean touching ~200 read
// sites, and a new column that a hand-run migration has not created yet fails
// the whole INSERT — which is how registration breaks silently. If the parts
// are wanted as their own columns later (sorting by surname, "Dear John" in a
// mail merge), that is one migration plus a join, not a rewrite.
//
// Splitting rule: everything before the LAST space is the first name, the
// remainder is the last name. So "Ana Maria Ruiz Gómez" round-trips as
// "Ana Maria Ruiz" + "Gómez" rather than losing the middle names, and a
// single-word legal name stays entirely in First Name with Last Name empty.
export function splitFullName(full) {
  const clean = String(full || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { first: '', last: '' };
  const cut = clean.lastIndexOf(' ');
  if (cut === -1) return { first: clean, last: '' };
  return { first: clean.slice(0, cut), last: clean.slice(cut + 1) };
}

export function joinFullName(first, last) {
  return [String(first || '').trim(), String(last || '').trim()]
    .filter(Boolean)
    .join(' ');
}

// The two boxes keep their own state instead of re-deriving from `value` on
// every keystroke. Deriving looks tidier but misplaces the caret: type
// "Ana Maria" into First Name while Last Name is empty and the joined string is
// "Ana Maria", which splits back as "Ana" + "Maria" — the second word jumps out
// of the box mid-word. Local state lets a multi-word first name stay where it
// was typed.
//
// Exported as a hook, not kept private, because checkout renders its own field
// markup and would otherwise have to re-derive (and re-introduce the bug).
export function useNameParts(value, onChange) {
  const [parts, setParts] = useState(() => splitFullName(value));

  // Re-sync only when the outside value is genuinely different from what these
  // two boxes represent — a form reset, or an edit modal opening on a new row.
  // Comparing against the join (not against `value` directly) is what stops
  // this from fighting the local state on every keystroke.
  useEffect(() => {
    const incoming = String(value || '').trim();
    if (incoming !== joinFullName(parts.first, parts.last)) {
      setParts(splitFullName(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next) => {
    setParts(next);
    onChange(joinFullName(next.first, next.last));
  };

  return {
    first: parts.first,
    last: parts.last,
    setFirst: (v) => emit({ first: v, last: parts.last }),
    setLast: (v) => emit({ first: parts.first, last: v }),
  };
}

// `value`/`onChange` are the single full-name string, so a caller swaps one
// <Input> for one <NameFields> and touches nothing else in its submit handler.
export default function NameFields({
  value,
  onChange,
  idPrefix = 'name',
  required = false,
  disabled = false,
  firstLabel,
  lastLabel,
}) {
  const { t } = useTranslation();
  const { first, last, setFirst, setLast } = useNameParts(value, onChange);

  return (
    <div className="name-fields">
      <Input
        label={firstLabel || t('common.firstName')}
        id={`${idPrefix}-first`}
        name="first_name"
        autoComplete="given-name"
        value={first}
        // Only the first box carries `required`. Marking both would reject a
        // mononym — legal in much of the world and common across the regions
        // this platform sells into — and the join below already guarantees a
        // non-empty full name whenever this box is filled.
        required={required}
        disabled={disabled}
        onChange={(e) => setFirst(e.target.value)}
      />
      <Input
        label={lastLabel || t('common.lastName')}
        id={`${idPrefix}-last`}
        name="last_name"
        autoComplete="family-name"
        value={last}
        disabled={disabled}
        onChange={(e) => setLast(e.target.value)}
      />
    </div>
  );
}
