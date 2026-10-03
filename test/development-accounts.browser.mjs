import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const session = `passport-admin-development-${process.pid}`;
const old = '2000-01-01T00:00:00.000Z';
const future = new Date(Date.now() + 86_400_000).toISOString();
const account = (i = 1) => ({ id: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`, minecraft: { uuid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Fixture_${i}` }, displayName: '개발용 계정', member: false, discordLinked: false, enabled: true, revision: 1, createdAt: old, updatedAt: old, allowedServerIds: ['fixture'], presence: { online: false, serverId: null, serverLabel: null, lastSeenAt: null } });
const asMember = row => ({ ...row, identityProvider: 'managed-development', developmentAccount: { enabled: row.enabled, discordLinked: row.discordLinked }, studentId: null, department: null, admissionYear: null, membershipStatus: row.member ? 'active' : 'inactive', roleLabel: row.member ? '회원' : '', verifiedUntil: future, universityVerifiedUntil: null, accessSuspended: !row.enabled, eligibleServerIds: ['fixture'], scopeRestricted: false, scopeLimit: [], discordId: null, discordConnection: null, administrator: false });
let state;
const reset = () => { state = { role: 'owner', accounts: [account()], writes: [], reads: [], forceError: null }; };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1'); const p = url.pathname;
  const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  if (p === '/v1/auth/session') return json(200, { authenticated: true, authMode: 'university', csrfToken: 'synthetic-csrf' });
  if (p === '/v1/admin/session') return json(200, { authenticated: true, schoolVerified: true, subjectId: 'owner', displayName: '합성 운영자', enrolled: true, enrollmentPending: false, bootstrapAvailable: false, mfaRequired: false, authorized: true, role: state.role, permissions: { read: true, write: state.role !== 'viewer', manageOperators: state.role === 'owner' }, mfaVerified: false, mfaVerifiedUntil: null });
  if (req.method === 'GET') state.reads.push(p);
  if (p === '/v1/admin/overview') return json(200, { subjects: 1, linked: 1, suspended: 0, snapshot: null, sync: { enabled: false, running: false, lastSuccessAt: null, lastError: null }, servers: [{ id: 'fixture', label: '합성 서버', commandName: '합성' }] });
  if (p === '/v1/admin/development-accounts' && req.method === 'GET') return json(200, { accounts: state.accounts });
  if (p === '/v1/admin/members' && req.method === 'GET') return json(200, { members: state.accounts.map(asMember), total: state.accounts.length, nextCursor: null });
  if (p === '/v1/admin/operators' && req.method === 'GET') return json(200, { operators: [], invitations: [] });
  if (p === '/v1/admin/servers' && req.method === 'GET') return json(200, { servers: [{ id: 'fixture', label: '합성 서버', commandName: '합성', enabled: true, sensitive: false, accessMode: 'selected', discordRequirement: 'any', allowedSubjectIds: [state.accounts[0]?.id].filter(Boolean), paperSeenAt: future, proxySeenAt: future, online: true, proxyAvailable: true, createdAt: old, updatedAt: old }] });
  if (p.startsWith('/v1/') && req.method !== 'GET') {
    let content = ''; for await (const chunk of req) content += chunk; const input = content ? JSON.parse(content) : {};
    state.writes.push({ path: p, method: req.method, input, csrf: req.headers['x-csrf-token'] });
    if (state.role === 'viewer') return json(403, { code: 'admin_write_required' });
    if (state.forceError) return json(409, { code: state.forceError });
    if (p === '/v1/admin/development-accounts' && req.method === 'POST') { const row = { ...account(state.accounts.length + 1), minecraft: { ...account(state.accounts.length + 1).minecraft, name: input.minecraftName }, member: input.member, discordLinked: input.discordLinked }; state.accounts.unshift(row); return json(201, { account: row }); }
    if (p.startsWith('/v1/admin/development-accounts/')) {
      const index = state.accounts.findIndex(row => p.endsWith(row.id)); if (index < 0) return json(404, { code: 'development_account_not_found' });
      if (state.accounts[index].revision !== input.expectedRevision) return json(409, { code: 'development_account_changed' });
      if (req.method === 'DELETE') { state.accounts.splice(index, 1); return json(200, { deleted: true }); }
      state.accounts[index] = { ...state.accounts[index], member: input.member, discordLinked: input.discordLinked, enabled: input.enabled, revision: input.expectedRevision + 1, updatedAt: future }; return json(200, { account: state.accounts[index] });
    }
    return json(404, { code: 'request_failed' });
  }
  const requested = path.resolve(dist, `.${p === '/' ? '/index.html' : p}`); if (!requested.startsWith(dist)) return json(404, {});
  try { const data = await readFile(requested); res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'" }); res.end(data); } catch { json(404, {}); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', session, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async expr => { let value = JSON.parse(await browser('eval', `JSON.stringify(${expr})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async expr => { for (let n = 0; n < 20; n++) { if (await inspect(expr)) return; await new Promise(resolve => setTimeout(resolve, 250)); } assert.fail(expr); };
const click = name => browser('find', 'role', 'button', 'click', '--name', name, '--exact');
const open = async origin => { await browser('open', 'about:blank'); await browser('open', origin); await browser('wait', '--load', 'networkidle'); await browser('snapshot', '-i'); };
const manage = async origin => { await open(origin); await click('개발 계정'); await until('Boolean(document.querySelector(".development-list"))'); await browser('snapshot', '-i'); };
const expanded = async () => { await browser('click', '.development-summary'); await until('Boolean(document.querySelector(".development-expanded"))'); await browser('snapshot', '-i'); };
const select = (label, value) => browser('select', `select[id$="-${label === '회원 자격' ? 'member' : 'discord'}"]`, value);
const screenshot = async name => { await browser('screenshot', `/tmp/passport-admin-development-${name}.png`, '--full'); };

test('managed Minecraft accounts UI uses the production contract with synthetic loopback identities', { timeout: 400_000 }, async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await t.test('register verified IGN with member and Discord scenario; profile conflicts do not create an account', async () => {
      reset(); await manage(origin); await browser('set', 'viewport', '1440', '1000'); await click('개발 계정 등록');
      assert.equal(await inspect('document.querySelector(".development-create button.primary").disabled'), true);
      await browser('fill', '#development-minecraft-name', 'Fixture_New'); await select('회원 자격', 'true'); await select('Discord 연동 가정', 'true');
      state.forceError = 'minecraft_already_linked'; await click('프로필 확인 후 등록'); await until('document.body.textContent.includes("이미 연결된 Minecraft 계정")'); assert.equal(state.accounts.length, 1);
      state.forceError = 'minecraft_profile_not_found'; await click('프로필 확인 후 등록'); await until('document.body.textContent.includes("Minecraft 프로필을 찾지 못했습니다")');
      state.forceError = null; await click('프로필 확인 후 등록'); await until('document.querySelector(".development-create")===null'); await until('document.querySelectorAll(".development-summary").length===2');
      assert.deepEqual(state.writes.at(-1), { path: '/v1/admin/development-accounts', method: 'POST', input: { minecraftName: 'Fixture_New', member: true, discordLinked: true }, csrf: 'synthetic-csrf' });
      assert.equal(await inspect('document.querySelector(".development-summary").textContent.includes("Fixture_New")'), true);
      await expanded(); assert.equal(await inspect('document.querySelector(".development-expanded").textContent.includes("합성 서버")'), true); await screenshot('desktop');
      await browser('set', 'viewport', '390', '844'); assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'), true); await screenshot('mobile');
    });
    await t.test('update and disable scenarios; stale revision refreshes and cannot blindly overwrite; delete requires confirmation', async () => {
      reset(); await manage(origin); await expanded();
      await select('회원 자격', 'true'); await select('Discord 연동 가정', 'true'); await browser('uncheck', '.development-editor input[type=checkbox]'); await click('설정 저장'); await until('document.querySelector(".development-expanded")===null');
      assert.deepEqual(state.writes[0].input, { member: true, discordLinked: true, enabled: false, expectedRevision: 1 }); assert.equal(state.accounts[0].revision, 2);
      await expanded(); await select('회원 자격', 'false'); state.accounts[0].revision = 3; state.accounts[0].discordLinked = false; await click('설정 저장'); await until('document.body.textContent.includes("다른 곳에서 개발 계정이 변경")'); await until('document.querySelector(".development-expanded")===null');
      assert.equal(state.accounts[0].member, true); await expanded(); assert.equal(await inspect('document.querySelector(".development-editor button.primary").disabled'), true); assert.equal(await inspect('document.querySelector(".development-editor select:nth-of-type(1)").value'), 'true');
      await click('개발 계정 삭제'); await until('Boolean(document.querySelector(".admin-dialog"))'); assert.equal(await inspect('document.querySelector(".dialog-actions .primary").disabled'), true); await browser('press', 'Escape'); await until('document.querySelector(".admin-dialog")===null'); assert.equal(state.accounts.length, 1);
      await click('개발 계정 삭제'); await browser('find', 'role', 'checkbox', 'check', '--name', '삭제할 개발 계정을 확인했습니다.'); await click('삭제 확인'); await until('document.querySelector(".admin-dialog")===null'); await until('document.querySelector(".development-list")===null');
      assert.deepEqual(state.writes.at(-1).input, { expectedRevision: 3 }); assert.equal(state.accounts.length, 0);
    });
    await t.test('list limits to 20, searches UUID, and viewer is read-only after a live permission loss', async () => {
      reset(); state.accounts = Array.from({ length: 25 }, (_, i) => account(i + 1)); await manage(origin); assert.equal(await inspect('document.querySelectorAll(".development-summary").length'), 20); await click('다음'); assert.equal(await inspect('document.querySelectorAll(".development-summary").length'), 5);
      await browser('fill', '#development-account-search', state.accounts[0].minecraft.uuid); assert.equal(await inspect('document.querySelectorAll(".development-summary").length'), 1); await expanded(); await click('개발 계정 삭제'); state.role = 'viewer'; await browser('eval', 'window.dispatchEvent(new Event("focus"))'); await until('document.querySelector(".admin-dialog")===null'); await until('document.querySelectorAll(".development-summary").length===20');
      await expanded(); assert.equal(await inspect('document.querySelector(".development-editor")===null'), true); assert.equal(await inspect('[...document.querySelectorAll("button")].some(b=>b.textContent==="개발 계정 등록")'), false); assert.equal(state.writes.length, 0);
      state.role = 'operator'; await browser('eval', 'window.dispatchEvent(new Event("focus"))'); await until('[...document.querySelectorAll("button")].some(b=>b.textContent==="개발 계정 등록")'); await until('document.querySelector(".development-summary")?.disabled===false'); await expanded(); await select('회원 자격', 'true'); await click('설정 저장'); await until('document.querySelector(".development-expanded")===null'); assert.equal(state.writes.length, 1);
    });
    await t.test('normal member lists and server picker label development identities, prevent school-admin invitation and hide school unlink/delete', async () => {
      reset(); state.accounts[0].discordLinked = true; await manage(origin); await click('회원 관리'); await until('Boolean(document.querySelector(".member-summary"))'); await browser('click', '.member-summary');
      assert.equal(await inspect('document.querySelector(".member-summary").textContent.includes("학교 계정 없음")'), true); assert.equal(await inspect('document.querySelector(".member-summary-discord").textContent'), '연동 가정');
      assert.equal(await inspect('document.querySelector(".member-actions").textContent.includes("Minecraft 연결 해제")'), false); assert.equal(await inspect('document.querySelector(".member-actions").textContent.includes("회원 정보 삭제")'), false); await click('개발 계정 설정'); await until('Boolean(document.querySelector(".development-list"))');
      await click('운영자 관리'); await browser('fill', '#operator-search', 'Fixture_1'); await browser('click', '.operator-search .primary'); await until('Boolean(document.querySelector(".operator-search-results .operator-row"))'); assert.equal(await inspect('document.querySelector(".operator-search-results button").disabled'), true); assert.equal(await inspect('document.querySelector(".operator-search-results button").textContent'), '초대 불가');
      await click('서버 관리'); await until('Boolean(document.querySelector(".server-summary"))'); await browser('click', '.server-summary'); await click('접근 및 설정'); await browser('snapshot', '-i');
      await browser('find', 'role', 'tab', 'click', '--name', '선택됨 1명', '--exact'); await until('Boolean(document.querySelector(".server-picker-results .development-badge"))'); assert.equal(await inspect('document.querySelector(".server-picker-results").textContent.includes("Discord 연동 가정")'), true);
      assert.equal(await inspect('localStorage.length+sessionStorage.length'), 0); assert.equal(state.writes.length, 0); assert.equal(await browser('errors'), '');
    });
  } finally { await browser('close').catch(() => {}); await new Promise(resolve => server.close(resolve)); }
});
