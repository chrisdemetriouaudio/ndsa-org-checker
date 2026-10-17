import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ccewCoverage, ccniCoverage, milesBetween, oscrCoverage, postcodeIn, ukPostcode } from '../src/place.ts';

test('postcodes are tidied and found inside addresses', () => {
  assert.equal(ukPostcode('sw1a1aa'), 'SW1A 1AA');
  assert.equal(ukPostcode('BT7 1NN'), 'BT7 1NN');
  assert.equal(ukPostcode('not a postcode'), null);
  assert.equal(postcodeIn('12 High Street, Belfast, BT1 5GS, Northern Ireland'), 'BT1 5GS');
});

test('distances are in miles', () => {
  const london = { lat: 51.501, lon: -0.1416 };
  const manchester = { lat: 53.4808, lon: -2.2426 };
  const d = milesBetween(london, manchester);
  assert.ok(d > 160 && d < 165, String(d));
});

test('local or nationwide, from each register', () => {
  assert.equal(ccewCoverage(['Throughout England And Wales']), 'national');
  assert.equal(ccewCoverage(['Hampshire', 'Southampton City']), 'local');
  assert.equal(oscrCoverage('Operations cover all or most of Scotland'), 'national');
  assert.equal(oscrCoverage('A specific local point, community or neighbourhood'), 'local');
  assert.equal(ccniCoverage('We support families across Northern Ireland'), 'national');
  assert.equal(ccniCoverage('A youth club in east Belfast'), 'local');
});
