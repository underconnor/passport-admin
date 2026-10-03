import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDevelopmentAccounts, validMinecraftName } from '../src/development-accounts.ts';

test('registration accepts only Java profile names, leaving UUID resolution to the server', () => {
  assert.equal(validMinecraftName('Fixture_123'), true);
  assert.equal(validMinecraftName('ab'), true);
  assert.equal(validMinecraftName(' Fixture_123 '), true);
  for (const value of ['', 'a'.repeat(17), '개발용 계정', 'foo bar', '12345678-1234-1234-1234-123456789abc']) assert.equal(validMinecraftName(value), false);
});
test('local list search finds IGN or UUID case-insensitively without changing source order', () => {
  const rows = [{minecraft:{name:'Fixture_One',uuid:'aaaaaaaa-0000-4000-8000-000000000001'}},{minecraft:{name:'Fixture_Two',uuid:'bbbbbbbb-0000-4000-8000-000000000002'}}];
  assert.deepEqual(filterDevelopmentAccounts(rows, ' FIXTURE_TWO '), [rows[1]]);
  assert.deepEqual(filterDevelopmentAccounts(rows, 'AAAAAAAA'), [rows[0]]);
  assert.deepEqual(filterDevelopmentAccounts(rows, ' '), rows);
  assert.deepEqual(filterDevelopmentAccounts(rows, 'missing'), []);
});
