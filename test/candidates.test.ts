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
    name: 'Headway Kent', url: 'https://group7.org.uk', area: 'Kent', kind: 'Registered charity', focus: ['autism'], charityNumber: '1000007', audiences: [], postcode: '', coverage: 'local', nations: ['England'], serves: [],
  });
  assert.deepEqual(candidateToInput(make(9, { audiences: ['children', 'families'] })).audiences, ['children', 'families']);
  const scottish = candidateToInput(make(8, { source: 'oscr', number: 'SC012345', area: '' , nations: ['Scotland'] }));
  assert.equal(scottish.charityNumber, 'SC012345');
  assert.equal(scottish.area, 'Scotland');
  assert.equal(candidateToInput(make(6, { source: 'ccni', number: '100002', nations: ['Northern Ireland'] })).charityNumber, 'NIC100002');
});

import { relatedMove, siteOutcome } from '../src/candidates.ts';
import type { CheckResult } from '../src/types.ts';

const visit = (extra: Partial<CheckResult> = {}): CheckResult => ({
  date: '2026-10-18', reachable: true, httpStatus: 200, finalUrl: 'https://x.org.uk/', ms: 100, error: null,
  robotsBlocked: false, closedPhrases: [], parkedPhrases: [], movedTo: null, title: null, ...extra,
});
const org = { name: 'Headway Black Country', website: 'https://www.headwayblackcountry.co.uk' };

test('a move to a related new address is followed; an unrelated one waits for a person', () => {
  assert.equal(relatedMove('Headway Black Country', 'https://www.headwayblackcountry.co.uk', 'headwayblackcountry.org'), true);
  assert.equal(relatedMove('Lewisham Mencap', 'https://lewishammencap.org.uk', 'lewishammencaporguk.wordpress.com'), true);
  assert.equal(relatedMove('Bolton Smiley Faces', 'https://boltonsmileyfaces.org', 'google.com'), false);
  assert.equal(relatedMove('Bolton Smiley Faces', 'https://boltonsmileyfaces.org', 'some-other-charity.org'), false);
  const moved = siteOutcome(org, visit({ movedTo: 'headwayblackcountry.org' }), 0);
  assert.equal(moved.action, 'add-moved');
  assert.equal(moved.newUrl, 'https://headwayblackcountry.org');
});

test('gone addresses are parked; temporary failures retry, then park on the third day', () => {
  assert.equal(siteOutcome(org, visit({ reachable: false, httpStatus: null, error: 'DNS' }), 0).action, 'park');
  assert.equal(siteOutcome(org, visit({ reachable: false, httpStatus: 404 }), 0).action, 'park');
  const blip = visit({ reachable: false, httpStatus: null, error: 'Timeout' });
  assert.equal(siteOutcome(org, blip, 0).action, 'review');
  assert.equal(siteOutcome(org, blip, 1).action, 'review');
  assert.equal(siteOutcome(org, blip, 2).action, 'park');
  assert.equal(siteOutcome(org, visit({ closedPhrases: ['has permanently closed'] }), 0).action, 'reject');
  assert.equal(siteOutcome(org, visit(), 0).action, 'add');
});

test('anything still unclear a week after it was found is parked, never added', async () => {
  const { parkStale } = await import('../src/discover.ts');
  const c = (firstSeen: string, verdict: 'review' | 'add') => ({ key: firstSeen + verdict, triage: { score: 30, verdict, reasons: [] }, firstSeen }) as never;
  const list = [c('2026-10-10', 'review'), c('2026-10-15', 'review'), c('2026-10-01', 'add')];
  assert.equal(parkStale(list, '2026-10-18'), 1);
  assert.deepEqual(list.map((x: { triage: { verdict: string } }) => x.triage.verdict), ['parked', 'review', 'add']);
});
