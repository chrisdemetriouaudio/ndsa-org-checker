import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidateToInput, MAX_AUTO_ADD, planActions, type Candidate } from '../src/candidates.ts';

const make = (n: number, extra: Partial<Candidate> = {}): Candidate => ({
  key: `ccew:${1000000 + n}`, source: 'ccew', number: String(1000000 + n), name: `AUTISM GROUP ${n}`, website: `https://group${n}.org.uk`,
  nations: ['England'], area: 'Kent', form: 'CIO', conditions: ['autism'], inName: true, snippet: '', audiences: [], ...extra,
});

const withVerdict = (n: number, verdict: 'add' | 'reject' | 'review') => make(n, { triage: { score: 0, verdict, reasons: [] } });

test('rejects leave; adds are website-checked; unclear ones wait', () => {
  const list = [withVerdict(1, 'add'), withVerdict(2, 'reject'), withVerdict(3, 'review')];
  const plan = planActions(list, new Set());
  assert.deepEqual(plan.reject.map((c) => c.number), ['1000002']);
  assert.deepEqual(plan.check.map((c) => c.number), ['1000001']);
  assert.equal(plan.note, null);
});

test('too many new ones qualifying at once: none of the new ones are added, the backlog still is', () => {
  const fresh = Array.from({ length: MAX_AUTO_ADD + 1 }, (_, i) => withVerdict(i, 'add'));
  const backlog = withVerdict(999, 'add');
  const plan = planActions([...fresh, backlog], new Set(fresh.map((c) => c.key)));
  assert.deepEqual(plan.check.map((c) => c.key), [backlog.key]);
  assert.match(plan.note!, /none of them were added/);
});

test('a candidate becomes a tidy directory entry', () => {
  assert.deepEqual(candidateToInput(make(7, { name: 'HEADWAY KENT' })), {
    name: 'Headway Kent', url: 'https://group7.org.uk', area: 'Kent', kind: 'Registered charity', focus: ['autism'], charityNumber: '1000007', registerNote: undefined, audiences: [], postcode: '', coverage: 'local', nations: ['England'], serves: [],
  });
  assert.deepEqual(candidateToInput(make(9, { audiences: ['children', 'families'] })).audiences, ['children', 'families']);
  const scottish = candidateToInput(make(8, { source: 'oscr', number: 'SC012345', area: '' , nations: ['Scotland'] }));
  assert.equal(scottish.charityNumber, '');
  assert.equal(scottish.area, 'Scotland');
  assert.match(scottish.registerNote!, /Scottish charity/);
});
