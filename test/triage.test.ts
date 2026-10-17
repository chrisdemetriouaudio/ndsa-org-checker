import assert from 'node:assert/strict';
import { test } from 'node:test';
import { triage } from '../src/triage.ts';

const t = (name: string, description: string, inName = false, website: string | null = 'https://x.org.uk') =>
  triage({ name, description, inName, conditions: ['autism'], website }).verdict;

test('clear support organisations are added', () => {
  assert.equal(t('Leicestershire Dyslexia Association', 'To provide help for dyslexic children and adults', true), 'add');
  assert.equal(t('Doncaster Mencap', 'Doncaster Mencap provides two gateway club nights for members. A carers group meets monthly.'), 'add');
  assert.equal(t('The Engine Shed', 'A special interest group for autistic children, young people and adults set up by parents and carers.'), 'add');
});

test('providers, schools, grant-makers and overseas work are turned down', () => {
  assert.equal(t('Clervaux Garden School', 'The organisation operates an independent special school for young people with autism.'), 'reject');
  assert.equal(t('Prospects for People with Learning Disabilities', 'Provision of residential, supported living and domiciliary services.', true), 'reject');
  assert.equal(t('Ormonde Foundation', 'Makes grants to organisations with an emphasis on autism.'), 'reject');
  assert.equal(t('Autistic Foundation', 'To relieve the needs of people with autism mainly in Bangladesh and overseas.'), 'reject');
});

test('a clear one without a website cannot be added', () => {
  assert.equal(t('Autism Fife', 'Support groups for autistic adults and their families.', true, null), 'no-website');
});
