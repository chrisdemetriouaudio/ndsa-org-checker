import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ccniEntry, oscrEntry, ukDate } from '../src/registersUk.ts';
import { registerSignal } from '../src/signals.ts';
import type { Org } from '../src/types.ts';

const org = (charityNumber: string): Org => ({ id: 'x', name: 'X', url: 'https://x.org.uk', area: '', kind: '', focus: [], charityNumber });
const reg = (entries: Record<string, ReturnType<typeof oscrEntry>>, sources = ['e', 's', 'n']) => ({ extractDate: '2026-10-18', sources, entries });

test('UK dates in both register styles', () => {
  assert.equal(ukDate('31/03/2025'), '2025-03-31');
  assert.equal(ukDate('5 April 2024'), '2024-04-05');
  assert.equal(ukDate(''), null);
});

test('Scotland: listed is registered, "Not Submitted" is overdue, missing means removed', () => {
  const e = oscrEntry({ 'Charity Number': 'SC012345', 'Charity Name': 'Autism Fife', 'Charity Status': 'Active', 'Year End': '31/03/2025', Website: 'autismfife.org' });
  assert.equal(registerSignal(org('SC012345'), reg({ SC012345: e })).level, 'green');
  const late = oscrEntry({ 'Charity Number': 'SC012345', 'Charity Name': 'A', 'Charity Status': 'Not Submitted', 'Year End': '' });
  assert.equal(registerSignal(org('SC012345'), reg({ SC012345: late })).level, 'amber');
  const gone = registerSignal(org('SC099999'), reg({}));
  assert.equal(gone.level, 'red');
  assert.notEqual(gone.provesClosure, true); // strong, but a person confirms
  assert.equal(registerSignal(org('SC099999'), reg({}, ['e'])).level, 'amber'); // Scottish file not read today: no verdict
});

test('Northern Ireland: removed proves closure; overdue is amber', () => {
  const removed = ccniEntry({ 'Reg charity number': '100002', 'Charity name': 'B', Status: 'Removed', 'Financial period end': '' });
  assert.equal(removed.number, 'NIC100002');
  const r = registerSignal(org('NIC100002'), reg({ NIC100002: removed }));
  assert.equal(r.provesClosure, true);
  assert.equal(r.detail, 'Removed from the charity register');
  const late = ccniEntry({ 'Reg charity number': '100003', 'Charity name': 'C', Status: 'Overdue: 260 days', 'Financial period end': '31 March 2025' });
  assert.equal(registerSignal(org('NIC100003'), reg({ NIC100003: late })).level, 'amber');
});
