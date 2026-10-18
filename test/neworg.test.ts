import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReview, normaliseUrl, parseLines, serialiseOrgs, slug, validateNew } from '../src/neworg.ts';
import type { Org } from '../src/types.ts';

const list: Org[] = [{ id: 'autism-hampshire', name: 'Autism Hampshire', url: 'https://www.autismhampshire.org.uk', area: 'Hampshire', kind: 'Local charity', focus: ['autism'], charityNumber: '288141' }];

test('website addresses are tidied, and only public http(s) sites are accepted', () => {
  assert.equal(normaliseUrl('example.org.uk'), 'https://example.org.uk');
  assert.equal(normaliseUrl('https://Example.org.uk/about/?utm=x#top'), 'https://example.org.uk/about');
  for (const bad of ['', 'javascript:alert(1)', 'ftp://x.org', 'http://localhost', 'http://127.0.0.1', 'https://x.internal', 'https://user:pw@x.org', 'https://x.org:8080', 'nodot']) {
    assert.equal(normaliseUrl(bad), null, bad);
  }
});

test('a good new entry becomes an organisation with a unique id', () => {
  const taken = new Set(list.map((o) => o.id));
  const v = validateNew({ name: 'ADHD Embrace', url: 'adhdembrace.org', kind: 'Local charity', focus: ['ADHD'], charityNumber: '1188759' }, list, taken);
  assert.deepEqual(v.problems, []);
  assert.deepEqual(v.org, { id: 'adhd-embrace', name: 'ADHD Embrace', url: 'https://adhdembrace.org', area: 'UK', kind: 'Local charity', focus: ['ADHD'], charityNumber: '1188759' });
  const twin = validateNew({ name: 'ADHD Embrace', url: 'adhdembrace2.org' }, list, taken);
  assert.equal(twin.org?.id, 'adhd-embrace-2');
});

test('duplicates and bad input are explained in plain words', () => {
  const taken = new Set<string>();
  assert.match(validateNew({ name: 'AH', url: 'http://autismhampshire.org.uk/' }, list, taken).problems.join(' '), /Already listed as Autism Hampshire/);
  assert.match(validateNew({ name: 'New', url: 'new.org', charityNumber: '288141' }, list, taken).problems.join(' '), /already listed/);
  assert.match(validateNew({ name: 'New', url: 'new.org', charityNumber: '12ab' }, list, taken).problems.join(' '), /6 to 8 digits/);
  assert.equal(validateNew({ name: '', url: '' }, list, taken).problems.length, 2);
});

test('text that could break the vault or the page is cleaned', () => {
  const v = validateNew({ name: 'Bad <script>|name`', url: 'x.org', kind: 'made up' }, [], new Set());
  assert.equal(v.org?.name, 'Bad script name');
  assert.equal(v.org?.kind, 'Not sure');
  assert.equal(slug('Autism & ADHD — Café'), 'autism-and-adhd-cafe');
});

test('pasted lines: pipes, tabs, blanks and comments', () => {
  assert.deepEqual(parseLines('A | a.org | Kent | 1234567\n\n# note\nB\tb.org'), [
    { name: 'A', url: 'a.org', area: 'Kent', charityNumber: '1234567' },
    { name: 'B', url: 'b.org', area: '', charityNumber: '' },
  ]);
});

test('remove archives with a reason; restore undoes it; nothing is deleted', () => {
  assert.match(applyReview(list, 'autism-hampshire', 'remove', 'Chris', '2026-10-17').problem!, /why/);
  const removed = applyReview(list, 'autism-hampshire', 'remove', 'Chris', '2026-10-17', 'Closed in 2026').orgs;
  assert.deepEqual(removed[0].review, { status: 'Closed', date: '2026-10-17', by: 'Chris', note: 'Closed in 2026' });
  assert.equal(removed.length, 1);
  assert.equal(applyReview(removed, 'autism-hampshire', 'restore', 'Chris', '2026-10-18').orgs[0].review, undefined);
  assert.equal(applyReview(list, 'autism-hampshire', 'still-running', 'Chris', '2026-10-17').orgs[0].review?.status, 'Still running');
  assert.match(applyReview(list, 'nope', 'restore', 'Chris', '2026-10-17').problem!, /not on the list/);
});

test('orgs.json keeps one entry per line', () => {
  assert.equal(serialiseOrgs(list).split('\n').length, 4);
});

import { tidyName } from '../src/neworg.ts';

test('all-capitals register names are tidied, acronyms kept', () => {
  assert.equal(tidyName('BRENT MENCAP'), 'Brent Mencap');
  assert.equal(tidyName('ADHD SUPPORT GROUP FOR THE NORTH'), 'ADHD Support Group for the North');
  assert.equal(tidyName("DOWN'S SYNDROME ASSOCIATION"), "Down's Syndrome Association");
  assert.equal(tidyName('AUTISM WALES CIO'), 'Autism Wales CIO');
  assert.equal(tidyName('Already Fine Name'), 'Already Fine Name');
});

import { cleanName, sortKey } from '../src/neworg.ts';
test('names lose wrapping quotes and stray punctuation, keep apostrophes, brackets and +, start with a capital', () => {
  assert.equal(cleanName("'spectrum Wasp'"), 'Spectrum Wasp');
  assert.equal(tidyName("'SPECTRUM WASP'"), 'Spectrum WASP');
  assert.equal(cleanName('“Autism Hampshire”'), 'Autism Hampshire');
  assert.equal(cleanName('** Bright  Sparks -'), 'Bright Sparks');
  assert.equal(cleanName("Children's Autism Group (Kent)"), "Children's Autism Group (Kent)");
  assert.equal(cleanName('Jigsaw +'), 'Jigsaw +');
  assert.equal(cleanName('"The" Group'), 'The Group');
  assert.ok(sortKey("'spectrum WASP'") > sortKey('Autism Hampshire')); // punctuation never puts a name first
});
