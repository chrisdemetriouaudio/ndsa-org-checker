import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findPhrases, movedTo, pageText, robotsDisallowsAll } from '../src/check.ts';
import { dateWords, replaceBetweenMarkers } from '../src/render.ts';
import { decideStatus } from '../src/status.ts';
import type { CheckResult, Org } from '../src/types.ts';

const org: Org = { id: 'x', name: 'X', url: 'https://x.org.uk', area: 'UK', kind: 'Charity', focus: [] };
const ok = (date: string, extra: Partial<CheckResult> = {}): CheckResult => ({
  date, reachable: true, httpStatus: 200, finalUrl: 'https://x.org.uk/', ms: 100, error: null,
  robotsBlocked: false, closedPhrases: [], parkedPhrases: [], movedTo: null, title: 'X', ...extra,
});
const down = (date: string, error: CheckResult['error'] = 'Timeout') => ok(date, { reachable: false, httpStatus: null, error });

test('a healthy site looks active', () => {
  assert.equal(decideStatus(org, [ok('2026-10-16'), ok('2026-10-17')], '2026-10-17').status, 'Looks active');
});

test('one bad day is not enough to flag', () => {
  assert.equal(decideStatus(org, [ok('2026-10-15'), down('2026-10-16'), ok('2026-10-17')], '2026-10-17').status, 'Looks active');
});

test('down 3 times in a week needs a check', () => {
  const h = [down('2026-10-12'), ok('2026-10-13'), down('2026-10-15'), down('2026-10-17')];
  assert.equal(decideStatus(org, h, '2026-10-17').status, 'Needs a check');
});

test('address gone 3 times is likely closed', () => {
  const h = [down('2026-10-15', 'DNS'), down('2026-10-16', 'DNS'), down('2026-10-17', 'DNS')];
  assert.equal(decideStatus(org, h, '2026-10-17').status, 'Likely closed');
});

test('a closing notice twice in a row is likely closed, once is not', () => {
  const closed = (d: string) => ok(d, { closedPhrases: ['has now closed'] });
  assert.equal(decideStatus(org, [ok('2026-10-16'), closed('2026-10-17')], '2026-10-17').status, 'Looks active');
  const r = decideStatus(org, [closed('2026-10-16'), closed('2026-10-17')], '2026-10-17');
  assert.equal(r.status, 'Likely closed');
  assert.match(r.reasons[0], /has now closed/);
});

test('moving to another domain needs a check', () => {
  assert.equal(decideStatus(org, [ok('2026-10-17', { movedTo: 'newname.org' })], '2026-10-17').status, 'Needs a check');
});

test('a person\'s "still running" clears older failures', () => {
  const h = [down('2026-10-12'), down('2026-10-13'), down('2026-10-14'), ok('2026-10-16')];
  const reviewed = { ...org, review: { status: 'Still running' as const, date: '2026-10-15', by: 'Wade' } };
  assert.equal(decideStatus(org, h, '2026-10-16').status, 'Needs a check');
  assert.equal(decideStatus(reviewed, h, '2026-10-16').status, 'Looks active');
});

test('only a person can close a listing', () => {
  const closed = { ...org, review: { status: 'Closed' as const, date: '2026-10-17', by: 'Wade' } };
  assert.equal(decideStatus(closed, [ok('2026-10-17')], '2026-10-17').status, 'Closed');
});

test('confirmed lasts 6 months', () => {
  const c = { ...org, review: { status: 'Confirmed' as const, date: '2026-01-01', by: 'the charity' } };
  assert.equal(decideStatus(c, [ok('2026-03-01')], '2026-03-01').status, 'Confirmed');
  assert.equal(decideStatus(c, [ok('2026-09-01')], '2026-09-01').status, 'Looks active');
});

test('page text and phrases', () => {
  const text = pageText('<script>var a="has now closed"</script><p>Our charity has&nbsp;now closed. Thank you</p>');
  assert.deepEqual(findPhrases(text).closed, ['has now closed']);
  assert.deepEqual(findPhrases(pageText('<h1>This domain is for sale!</h1>')).parked, ['this domain is for sale']);
});

test('redirect to www or a subdomain is not a move', () => {
  assert.equal(movedTo('https://x.org.uk', 'https://www.x.org.uk/home'), null);
  assert.equal(movedTo('https://www.x.org.uk', 'https://shop.x.org.uk/'), null);
  assert.equal(movedTo('https://x.org.uk', 'https://y.org/'), 'y.org');
});

test('robots.txt', () => {
  assert.equal(robotsDisallowsAll('User-agent: *\nDisallow: /'), true);
  assert.equal(robotsDisallowsAll('User-agent: *\nDisallow: /admin'), false);
  assert.equal(robotsDisallowsAll('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /'), false);
  assert.equal(robotsDisallowsAll('User-agent: Googlebot\nUser-agent: *\nDisallow: /'), true);
});

test('dates as words and live markers', () => {
  assert.equal(dateWords('2026-10-07'), '7 Oct 2026');
  const doc = 'a\n<!-- live:start -->\nold\n<!-- live:end -->\nb';
  assert.equal(replaceBetweenMarkers(doc, 'new'), 'a\n<!-- live:start -->\nnew\n<!-- live:end -->\nb');
});

test('ticks: all fine is green, not-yet-built checks are grey', () => {
  const d = decideStatus(org, [ok('2026-10-16'), ok('2026-10-17')], '2026-10-17');
  const level = Object.fromEntries(d.signals.map((x) => [x.key, x.level]));
  assert.deepEqual(level, { address: 'green', answers: 'green', notice: 'green', parked: 'green', moved: 'green', register: 'none', confirmed: 'none' });
  assert.equal(d.score, 100);
});

test('ticks: one bad day is amber and lowers the score, three is red', () => {
  const one = decideStatus(org, [ok('2026-10-16'), down('2026-10-17')], '2026-10-17');
  assert.equal(one.signals.find((x) => x.key === 'answers')?.level, 'amber');
  assert.ok(one.score! < 100 && one.score! > 50);
  const three = decideStatus(org, [down('2026-10-15'), down('2026-10-16'), down('2026-10-17')], '2026-10-17');
  assert.equal(three.signals.find((x) => x.key === 'answers')?.level, 'red');
  assert.equal(three.status, 'Needs a check');
});

test('website evidence alone is never "proven"', () => {
  const h = [down('2026-10-15', 'DNS'), down('2026-10-16', 'DNS'), down('2026-10-17', 'DNS')];
  const d = decideStatus(org, h, '2026-10-17');
  assert.equal(d.status, 'Likely closed');
  assert.equal(d.proven, false);
});

test('a person closing it counts as proof', () => {
  const closed = { ...org, review: { status: 'Closed' as const, date: '2026-10-17', by: 'Wade' } };
  const d = decideStatus(closed, [], '2026-10-17');
  assert.equal(d.proven, true);
  assert.equal(d.score, 0);
});

test('confirmed by the organisation turns its tick green and adds to the score', () => {
  const c = { ...org, review: { status: 'Confirmed' as const, date: '2026-10-01', by: 'the charity' } };
  const d = decideStatus(c, [ok('2026-10-02', { movedTo: 'y.org' })], '2026-10-02');
  assert.equal(d.signals.find((x) => x.key === 'confirmed')?.level, 'green');
  assert.equal(d.status, 'Needs a check'); // a move still needs a look
});
