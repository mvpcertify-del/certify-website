import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUpdate } from '../../api/_notifyAdmin.js';

test('switching a rule off or on', () => {
  assert.deepEqual(cleanUpdate({ enabled: false }), { enabled: false });
  assert.deepEqual(cleanUpdate({ enabled: 'yes' }), {}); // only a real boolean counts
});

test('days are whole numbers, de-duplicated and sorted, from 1 to 6 of them', () => {
  assert.deepEqual(cleanUpdate({ offsets: [1, 7, 3, 3] }).offsets, [7, 3, 1]);
  for (const bad of [[], [1.5], [-1], [400], ['x'], [1, 2, 3, 4, 5, 6, 7], 'nope']) {
    assert.throws(() => cleanUpdate({ offsets: bad }), /Days must be/, JSON.stringify(bad));
  }
});

test('channels must come from the known list', () => {
  assert.deepEqual(cleanUpdate({ channels: ['email', 'in_app', 'email'] }).channels, ['email', 'in_app']);
  for (const bad of [[], ['sms'], ['email', 'fax'], 'email']) {
    assert.throws(() => cleanUpdate({ channels: bad }), /Choose at least one channel/, JSON.stringify(bad));
  }
});

test('nothing outside enabled, offsets and channels can be changed', () => {
  assert.deepEqual(cleanUpdate({ title: 'x', config: { a: 1 }, templates: {}, key: 'other' }), {});
});
