import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchConditions } from '../src/conditions.ts';

const labels = (name: string, desc = '') => matchConditions(name, desc)?.conditions ?? [];

test('finds each condition by its usual wording', () => {
  assert.deepEqual(labels('Autism Hampshire'), ['autism']);
  assert.deepEqual(labels('Aspergers Support Group'), ['autism']);
  assert.deepEqual(labels('X', 'support for autistic adults'), ['autism']);
  assert.deepEqual(labels('X', 'families affected by Attention Deficit Hyperactivity Disorder'), ['ADHD']);
  assert.deepEqual(labels('Tourettes Action'), ['Tourette syndrome']);
  assert.deepEqual(labels('X', 'dyslexia, dyscalculia and dysgraphia'), ['dyslexia', 'dyscalculia', 'dysgraphia']);
  assert.deepEqual(labels('Dyspraxia Foundation'), ['dyspraxia (DCD)']);
  assert.deepEqual(labels('X', 'children with Developmental Language Disorder (DLD)'), ['developmental language disorder']);
  assert.deepEqual(labels('X', 'sensory processing differences'), ['sensory processing']);
  assert.deepEqual(labels('X', 'face blindness research'), ['prosopagnosia']);
  assert.deepEqual(labels('UK Synaesthesia Association'), ['synaesthesia']);
  assert.deepEqual(labels('OCD Action'), ['OCD']);
  assert.deepEqual(labels('X', 'adults with learning disabilities'), ['learning disability']);
  assert.deepEqual(labels("Down's Syndrome Association"), ['Down syndrome']);
  assert.deepEqual(labels('Williams Syndrome Foundation'), ['Williams syndrome']);
  assert.deepEqual(labels('The Fragile X Society'), ['Fragile X syndrome']);
  assert.deepEqual(labels('Headway Cardiff'), ['brain injury']);
  assert.deepEqual(labels('X', 'acquired brain injuries'), ['brain injury']);
  assert.deepEqual(labels('X', 'a neurodivergent-led group'), ['neurodiversity']);
});

test('does not match look-alikes', () => {
  for (const [name, desc] of [
    ['Down Cathedral Trust', 'County Down churches'],
    ['Sensory Trust', 'services for deaf and blind people with sensory impairment'],
    ['Add Hope', 'we add value to young lives'],
    ['Williams Family Trust', 'grants in memory of John Williams'],
    ['Authentic Arts', 'authentic theatre'],
    ['Tick Tock Nursery', 'childcare'],
    ['Learning Difficulties Fund', 'general learning difficulties in schools'],
    ['Synergy Trust', 'synthesis of ideas'],
    ['Headwind Sailing', 'brain training games'],
  ]) assert.deepEqual(labels(name, desc), [], name);
});

test('name matches are marked, and a snippet shows the words found', () => {
  const m = matchConditions('ABC Trust', 'We run weekly groups for children with autism and their families in Fife.')!;
  assert.equal(m.inName, false);
  assert.match(m.snippet, /children with autism and their families/);
  assert.equal(matchConditions('Autism Fife', 'groups')!.inName, true);
});

import { primaryConditions } from '../src/conditions.ts';
test('primary conditions: the name and the start of the description, not passing mentions', () => {
  const late = ' We run weekly social groups, a parents\' coffee morning and holiday clubs across the city, and we welcome autistic people with or without a learning disability.';
  assert.deepEqual(primaryConditions('Autistic Nottingham', 'Peer support run by autistic adults.' + late), ['autism']);
  assert.deepEqual(primaryConditions('Brent Mencap', 'Support for people with a learning disability and their families. Some members are also autistic.'), ['autism', 'learning disability']);
  assert.deepEqual(primaryConditions('Brent Mencap', 'Support for people with a learning disability and their families, with clubs, advice and advocacy across the borough every week. Many of our members are also autistic.'), ['learning disability']);
  assert.deepEqual(primaryConditions('Riverside Trust', 'We run clubs and holidays for young people and families in the valley, with trained volunteers, a minibus and a small grant fund for trips. We welcome children with ADHD.'), ['ADHD']);
});
