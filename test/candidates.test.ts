import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidateToInput, MAX_AUTO_ADD, pickAutoAdds, type Candidate, type SiteVerdict } from '../src/candidates.ts';

const make = (n: number, extra: Partial<Candidate> = {}): Candidate => ({
  key: `ccew:${1000000 + n}`, source: 'ccew', number: String(1000000 + n), name: `AUTISM GROUP ${n}`, website: `https://group${n}.org.uk`,
  nations: ['England'], area: 'Kent', form: 'CIO', conditions: ['autism'], inName: true, snippet: '', audiences: [], ...extra,
});
const pass = (list: Candidate[]) => new Map<string, SiteVerdict>(list.map((c) => [c.key, { ok: true, why: '' }]));

test('only clear new ones with a clean website are added by themselves', () => {
  const named = make(1);
  const described = make(2, { inName: false });
  const noSite = make(3, { website: null });
  const badSite = make(4);
  const verdicts = pass([named]);
  verdicts.set(badSite.key, { ok: false, why: 'website did not answer' });
  const r = pickAutoAdds([named, described, noSite, badSite], verdicts);
  assert.deepEqual(r.add.map((c) => c.key), [named.key]);
  assert.deepEqual(r.review.map((c) => c.key), [described.key, noSite.key, badSite.key]);
  assert.equal(r.note, null);
});

test('too many clear ones at once: none added, all to review, with a reason', () => {
  const many = Array.from({ length: MAX_AUTO_ADD + 1 }, (_, i) => make(i));
  const r = pickAutoAdds(many, pass(many));
  assert.equal(r.add.length, 0);
  assert.equal(r.review.length, many.length);
  assert.match(r.note!, /none were added/);
});

test('a candidate becomes a tidy directory entry', () => {
  assert.deepEqual(candidateToInput(make(7, { name: 'HEADWAY KENT' })), {
    name: 'Headway Kent', url: 'https://group7.org.uk', area: 'Kent', kind: 'Registered charity', focus: ['autism'], charityNumber: '1000007', registerNote: undefined, audiences: [],
  });
  assert.deepEqual(candidateToInput(make(9, { audiences: ['children', 'families'] })).audiences, ['children', 'families']);
  const scottish = candidateToInput(make(8, { source: 'oscr', number: 'SC012345', area: '' , nations: ['Scotland'] }));
  assert.equal(scottish.charityNumber, '');
  assert.equal(scottish.area, 'Scotland');
  assert.match(scottish.registerNote!, /Scottish charity/);
});
