import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hostKey, hostShard, numberShard, toRegisterEntry } from '../src/lookup.ts';

test('lookup keys are stable and evenly spread', () => {
  assert.equal(hostKey('WWW.Autism.org.uk'), 'autism.org.uk');
  assert.equal(hostShard('www.autism.org.uk'), hostShard('autism.org.uk'));
  assert.match(hostShard('autism.org.uk'), /^\d{4}$/);
  assert.equal(numberShard('sc 012345'), numberShard('SC012345'));
  const used = new Set(Array.from({ length: 5000 }, (_, i) => hostShard(`site${i}.org.uk`)));
  assert.ok(used.size > 900, String(used.size));
});

test('a lookup entry becomes the register entry the scoring rules use', () => {
  const e = toRegisterEntry(['e', '268502', 'DYSLEXIA INSTITUTE LIMITED', 'X', '2023-08-16', '', '']);
  assert.equal(e.status, 'Removed');
  assert.equal(e.removedOn, '2023-08-16');
  assert.equal(toRegisterEntry(['e', '1', 'X', 'R', '', 'ia', '2024-03-31']).inAdministration, true);
});
