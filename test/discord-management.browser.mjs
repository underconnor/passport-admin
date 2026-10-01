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
const session = `passport-admin-discord-${process.pid}`;
const baseSettings = { guildId: '100000000000000001', verificationRoleId: '100000000000000002', memberRoleId: '100000000000000003', currentSemester: '26-2', semesterRoles: [{ semester: '26-2', roleId: '100000000000000004' }], nicknameEnabled: true, revision: '1' };
let state = {};
const reset = () => { state = { authorized: true, configured: true, settings: structuredClone(baseSettings), writes: [], requests: [], forceError: false, counts: { linked: 3, roles: { pending: 1, failed: 0 }, nicknames: { pending: 0, failed: 1 } } }; };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const body = async () => { let input = ''; for await (const part of req) input += part; return JSON.parse(input); };
  if (url.pathname === '/v1/auth/session') return json(200, { authenticated: true, authMode: 'university', csrfToken: 'synthetic-admin-csrf' });
  if (url.pathname === '/v1/admin/session') return json(200, { authenticated: true, schoolVerified: true, subjectId: "fixture-owner", role: "owner", permissions: { read: true, write: true, manageOperators: true }, displayName: '합성 운영자', enrolled: true, enrollmentPending: false, bootstrapAvailable: false, mfaRequired: false, authorized: state.authorized, mfaVerified: false, mfaVerifiedUntil: null });
  if (url.pathname === '/v1/admin/overview') return json(200, { subjects: 3, linked: 2, suspended: 0, snapshot: null, sync: { enabled: false, running: false, lastSuccessAt: null, lastError: null }, servers: [] });
  if (url.pathname === '/v1/admin/discord') {
    if (!state.authorized) return json(403, { code: 'admin_required' });
    if (req.method === 'PUT') {
      const input = await body(); state.writes.push({ input, csrf: req.headers['x-csrf-token'] });
      if (input.expectedRevision !== state.settings.revision) return json(409, { code: 'discord_settings_changed' });
      if (state.forceError) return json(503, { code: 'unknown-sensitive-value' });
      const { expectedRevision, ...settings } = input;
      state.settings = { ...state.settings, ...settings, revision: String(BigInt(expectedRevision) + 1n) };
      return json(200, { settings: state.settings });
    }
    return json(200, { configured: state.configured, settings: state.settings, status: state.counts });
  }
  if (url.pathname === '/v1/admin/discord/reconcile') { const input = await body(); state.requests.push({ input, csrf: req.headers['x-csrf-token'] }); state.counts.roles.pending = 3; return json(200, { queued: true }); }
  const requested = path.resolve(dist, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, {});
  try {
    const data = await readFile(requested); const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'" }); res.end(data);
  } catch { json(404, {}); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', session, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async expression => { let result = JSON.parse(await browser('eval', `JSON.stringify(${expression})`)); if (typeof result === 'string') result = JSON.parse(result); return result; };
const until = async expression => { for (let n = 0; n < 15; n++) { if (await inspect(expression)) return; await new Promise(resolve => setTimeout(resolve, 500)); } assert.fail('Expected admin state not observed'); };
const click = name => browser('find', 'role', 'button', 'click', '--name', name);
const fill = (label, value) => browser('find', 'label', label, 'fill', value);
const open = async origin => { await browser('open', 'about:blank'); await browser('open', origin); await browser('wait', '--load', 'networkidle'); await click('Discord 봇'); await until('Boolean(document.querySelector("#discord-member-role"))'); };
test('Discord bot management uses protected real contracts with synthetic loopback responses', { timeout: 240_000 }, async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await t.test('configuration, distinct roles, pending counts and nickname failures are visible on desktop and mobile', async () => {
      reset(); await open(origin); await browser('set', 'viewport', '1440', '900');
      assert.ok((await browser('snapshot', '-i')).includes('봇 설정 저장'));
      assert.equal(await inspect("document.body.textContent.includes('현재 학기 변경 전에 회원 명부를 해당 학기 기준으로 갱신해 주세요')"), true);
      assert.equal(await inspect('Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog]"))'), false);
      assert.equal(await browser('errors'), ''); await browser('console');
      assert.equal(await inspect('document.querySelectorAll("input[type=password]").length'), 0);
      assert.equal(await inspect('document.querySelector("#discord-member-role").value'), baseSettings.memberRoleId);
      assert.equal(await inspect("[...document.fonts].some(font => font.family.includes('Pretendard') && font.status === 'loaded')"), true);
      await browser('screenshot', '/tmp/passport-admin-discord-desktop.png');
      await browser('set', 'viewport', '390', '844');
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      await browser('screenshot', '/tmp/passport-admin-discord-mobile.png');
    });
    await t.test('duplicate role is blocked; valid save carries revision and CSRF; reconcile is only reported as queued', async () => {
      await fill('현재 Overworld 회원 역할 ID', baseSettings.verificationRoleId);
      assert.equal(await inspect('document.querySelector(".discord-save .primary").disabled'), true);
      assert.equal(state.writes.length, 0);
      await fill('현재 Overworld 회원 역할 ID', '100000000000000005'); await click('봇 설정 저장');
      await until("document.body.textContent.includes('설정을 저장했습니다')");
      assert.equal(state.writes[0].input.expectedRevision, '1'); assert.equal(state.writes[0].csrf, 'synthetic-admin-csrf');
      assert.equal(state.writes[0].input.memberRoleId, '100000000000000005'); assert.equal(Object.hasOwn(state.writes[0].input, 'verificationRoleId'), false);
      await click('전체 계정 재동기화'); await until("document.body.textContent.includes('재동기화를 요청했습니다')");
      assert.deepEqual(state.requests, [{ input: { expectedRevision: '2' }, csrf: 'synthetic-admin-csrf' }]);
      assert.equal(await inspect("document.body.textContent.includes('요청 접수는 역할·닉네임 반영 완료를 의미하지 않습니다')"), true);
    });
    await t.test('revision conflict preserves edits, requires explicit reload and unknown failure never echoes data', async () => {
      await fill('현재 Overworld 회원 역할 ID', '100000000000000006'); state.settings.revision = '3';
      await click('봇 설정 저장'); await until("document.body.textContent.includes('다른 운영자가')");
      assert.equal(await inspect('document.querySelector("#discord-member-role").value'), '100000000000000006');
      assert.equal(await inspect('document.querySelector(".discord-save .primary").disabled'), true);
      await click('입력 취소하고 최신 설정 불러오기'); await until('document.querySelector("#discord-member-role").value === "100000000000000005"');
      state.forceError = true; await fill('현재 Overworld 회원 역할 ID', '100000000000000007'); await click('봇 설정 저장');
      await until("document.body.textContent.includes('요청을 처리하지 못했습니다')");
      assert.equal(await inspect("document.body.textContent.includes('unknown-sensitive-value')"), false);
    });
    await t.test('loss of administrator authorization removes all bot controls', async () => {
      state.authorized = false; await click('상태 새로고침'); await until('document.querySelector("#discord-member-role") === null');
      assert.equal(await inspect("[...document.querySelectorAll('button')].some(button => button.textContent === '전체 계정 재동기화')"), false);
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0); assert.equal(await browser('errors'), '');
    });
  } finally { await browser('close').catch(() => {}); await new Promise(resolve => server.close(resolve)); }
});
