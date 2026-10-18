import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detailsExtra, detailsToEntry, nameKey, namesFromTitle, pickByName, type CcewDetails } from '../src/ccew.ts';
import { toRegisterEntry } from '../src/lookupKeys.ts';
import { registerSignal } from '../src/signals.ts';
import type { Org } from '../src/types.ts';

const details = (over: Partial<CcewDetails>): CcewDetails => ({
  reg_charity_number: 268502, charity_name: 'DYSLEXIA  INSTITUTE LIMITED', reg_status: 'R', date_of_removal: null, removal_reason: null,
  insolvent: false, in_administration: false, cio_dissolution_ind: null, interim_manager_ind: null, date_of_interim_manager_appt: null,
  reporting_status: 'Submission Received', latest_acc_fin_year_end_date: '2024-03-31T00:00:00', web: null, ...over,
});
const org = (charityNumber: string): Org => ({ id: 'x', name: 'X', url: 'https://x.org.uk', area: '', kind: '', focus: [], charityNumber });

test('live register details become the same entry as the daily files', () => {
  assert.deepEqual(detailsToEntry(details({})), ['e', '268502', 'DYSLEXIA INSTITUTE LIMITED', 'R', '', '', '2024-03-31']);
  const gone = detailsToEntry(details({ reg_status: 'RM', date_of_removal: '2023-08-16T00:00:00', in_administration: true, reporting_status: 'Submission Overdue' }));
  assert.equal(gone[3], 'X');
  assert.equal(gone[4], '2023-08-16');
  assert.equal(gone[5], 'ao');
});

test('the live register says why a charity was removed, and flags an interim manager', () => {
  const removed = detailsToEntry(details({ reg_status: 'RM', date_of_removal: '2023-08-16' }));
  const extra = detailsExtra(details({ removal_reason: 'Ceased to exist ' }), false);
  const reg = (e: ReturnType<typeof toRegisterEntry>) => ({ extractDate: '2026-10-18', live: true, entries: { '268502': e } });
  const r = registerSignal(org('268502'), reg({ ...toRegisterEntry(removed), removalReason: extra.removalReason }));
  assert.equal(r.provesClosure, true);
  assert.match(r.detail, /16 Aug 2023 \(ceased to exist\)/);
  const im = detailsExtra(details({ interim_manager_ind: true, date_of_interim_manager_appt: '2026-09-01' }), null);
  const s = registerSignal(org('268502'), reg({ ...toRegisterEntry(detailsToEntry(details({}))), interimManager: im.interimManager }));
  assert.equal(s.level, 'amber');
  assert.match(s.detail, /interim manager/);
  assert.match(registerSignal(org('268502'), reg(toRegisterEntry(detailsToEntry(details({}))))).detail, /^Registered charity/);
});

test('names from a page title, longest first, single words dropped', () => {
  assert.deepEqual(namesFromTitle('Home | The National Autistic Society'), ['The National Autistic Society']);
  assert.deepEqual(namesFromTitle('ADHD Foundation – The Neurodiversity Charity'), ['ADHD Foundation']);
  assert.deepEqual(namesFromTitle(null), []);
});

test('a name search only counts an exact match of the main charity, registered first', () => {
  assert.equal(nameKey('The National Autistic Society Ltd'), nameKey('NATIONAL AUTISTIC SOCIETY'));
  const found = [
    { reg_charity_number: 1, group_subsid_suffix: 0, charity_name: 'ADHD FOUNDATION', reg_status: 'RM', date_of_removal: '2010-01-01' },
    { reg_charity_number: 2, group_subsid_suffix: 0, charity_name: 'ADHD Foundation Trust', reg_status: 'R', date_of_removal: null },
    { reg_charity_number: 3, group_subsid_suffix: 1, charity_name: 'ADHD Foundation', reg_status: 'R', date_of_removal: null },
    { reg_charity_number: 4, group_subsid_suffix: 0, charity_name: 'ADHD Foundation North', reg_status: 'R', date_of_removal: null },
  ];
  assert.equal(pickByName(found, 'ADHD Foundation')?.reg_charity_number, 2);
  assert.equal(pickByName(found.slice(0, 1), 'ADHD Foundation')?.reg_charity_number, 1);
  assert.equal(pickByName(found, 'Autism Hampshire'), null);
});

test('all-details extras: how it helps, where it works, other names', () => {
  const d = details({
    who_what_where: [
      { classification_code: 105, classification_type: 'What', classification_desc: 'Disability' },
      { classification_code: 306, classification_type: 'How', classification_desc: 'Provides services' },
      { classification_code: 307, classification_type: 'How', classification_desc: 'Provides Advocacy/advice/information' },
      { classification_code: 310, classification_type: 'How', classification_desc: 'Other Charitable Activities' },
      { classification_code: 310, classification_type: 'How', classification_desc: 'Other charitable activities' },
    ],
    CharityAoOLocalAuthority: [{ local_authority: 'Bury', metropolitan_county: 'Greater Manchester', welsh_ind: false }, { local_authority: 'Bolton', metropolitan_county: 'Greater Manchester', welsh_ind: false }],
    CharityAoORegion: [{ region: 'Throughout England' }],
    other_names: [{ other_name: 'Dyslexia  Action', name_type: 'W' }, { other_name: 'Dyslexia Action', name_type: 'O' }],
  });
  const x = detailsExtra(d, null);
  assert.deepEqual(x.does, ['Provides services', 'Provides advocacy / advice / information']);
  assert.deepEqual(x.where, ['Bury', 'Bolton']);
  assert.deepEqual(x.otherNames, ['Dyslexia Action']);
  assert.deepEqual(detailsExtra(details({ CharityAoORegion: [{ region: 'Throughout England' }] }), null).where, ['Throughout England']);
  assert.deepEqual(detailsExtra(details({}), null).where, []);
});
