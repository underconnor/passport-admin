import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerCommandName, serverCommandNameError } from '../src/server-settings.ts';
const servers=[{id:'lobby',commandName:'로비'},{id:'survival',commandName:'약탈'}];

test('command names normalize composed Korean and ASCII case without silently removing spaces',()=>{
  assert.equal(normalizeServerCommandName('약탈'.normalize('NFD')),'약탈');
  assert.equal(normalizeServerCommandName('PvP_2-서버'),'pvp_2-서버');
  for(const value of ['새서버','PvP_2-서버','약탈'.normalize('NFD'),'a'.repeat(64),'가'.repeat(64)])assert.equal(serverCommandNameError(value,'survival',servers),null);
  for(const value of ['', '약 탈',' 약탈','약탈 ','약탈\n','/서버','@all','ㄱ','😃','a'.repeat(65),'가'.repeat(65),'ＳＵＲＶＩＶＡＬ','e\u0301'])assert.ok(serverCommandNameError(value,'survival',servers));
});

test('the same server may retain its ID or command; other commands and immutable IDs conflict after normalization',()=>{
  for(const value of ['survival','약탈','SURVIVAL'])assert.equal(serverCommandNameError(value,'survival',servers),null);
  for(const value of ['lobby','LOBBY','로비','로비'.normalize('NFD')])assert.match(serverCommandNameError(value,'survival',servers),/다른 서버/);
  const renamed=[{id:'lobby',commandName:'home'},{id:'survival',commandName:'약탈'}];
  for(const value of ['home','HOME','lobby'])assert.match(serverCommandNameError(value,'survival',renamed),/다른 서버/);
  assert.match(serverCommandNameError('lobby','survival',[{id:'lobby'}]),/다른 서버/);
  assert.equal(serverCommandNameError('약탈','survival',[{id:'lobby'}]),null);
  assert.deepEqual(servers,[{id:'lobby',commandName:'로비'},{id:'survival',commandName:'약탈'}]);
});
