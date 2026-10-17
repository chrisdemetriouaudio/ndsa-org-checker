import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAudiences, inferAudiences } from '../src/audience.ts';

test('who an organisation is for, from its own words', () => {
  assert.deepEqual(inferAudiences('Support for autistic children and their families'), ['children', 'families']);
  assert.deepEqual(inferAudiences('Peer support for autistic adults'), ['adults']);
  assert.deepEqual(inferAudiences('Groups for young people aged 11-18 and their parents'), ['children', 'families']);
  assert.deepEqual(inferAudiences('Advice for carers of people with learning disabilities'), ['families']);
  assert.deepEqual(inferAudiences('Supported employment for people with a learning disability'), ['adults']);
  assert.deepEqual(inferAudiences('Information and advice about dyslexia'), []);
});

test('register categories count too', () => {
  assert.deepEqual(inferAudiences('', 'Children/young People, People With Disabilities'), ['children']);
  assert.deepEqual(inferAudiences('', 'Learning disabilities,Parents,Preschool (0-5 year olds)'), ['children', 'families']);
  assert.deepEqual(inferAudiences('', 'The General Public/mankind'), []);
});

test('look-alikes do not count', () => {
  assert.deepEqual(inferAudiences('The Childwall Trust grants for Kidsgrove roads'), []);
  assert.deepEqual(inferAudiences('Adultery prevention'), []);
  assert.deepEqual(cleanAudiences(['families', 'robots', 'children', 'children']), ['children', 'families']);
});
