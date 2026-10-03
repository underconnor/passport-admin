import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const output = fileURLToPath(new URL('../output/playwright/', import.meta.url));
const session = `passport-server-members-${process.pid}`;
const future = new Date(Date.now() + 86400000).toISOString();
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const original = [...Array.from({ length: 12 }, (_, i) => id(i + 100)), id(999)];
const fixtures = Array.from({ length: 123 }, (_, index) => {
  const n = index + 1;
  return { id: id(n), revision: '1', createdAt: future, administrator: false,
    studentId: String(20990000 + n), displayName: `합성 회원 ${String(n).padStart(3, '0')}`,
    department: '합성 학과', membershipStatus: n === 123 ? 'inactive' : 'active', roleLabel: n === 123 ? '비회원' : '회원',
    verifiedUntil: future, universityVerifiedUntil: future, allowedServerIds: [], eligibleServerIds: [],
    accessSuspended: n === 122, scopeRestricted: false, scopeLimit: [],
    discordId: String(100000000000000000n + BigInt(n)),
    discordConnection: { discordId: String(100000000000000000n + BigInt(n)), username: `synthetic_discord_${n}`, displayName: `합성 디스코드 ${n}`, linkedAt: future, roleStatus: 'granted', roleUpdatedAt: future },
    minecraft: { uuid: id(n), name: `SyntheticPlayer${n}` } };
});
let state;
const reset = () => { state = {
  role: 'owner', queries: [], writes: [], hold: null, release: null, memberError: null, serverError: null,
  server: { id: 'fixture', label: '합성 서버', commandName: '합성', enabled: true, statisticsEnabled: true,
    sensitive: false, accessMode: 'selected', discordRequirement: 'any', allowedSubjectIds: [...original],
    paperSeenAt: future, proxySeenAt: future, online: true, proxyAvailable: true,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' },
}; };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1'), p = url.pathname;
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (p === '/v1/auth/session') return json(200, { authenticated: true, csrfToken: 'synthetic-csrf', authMode: 'university' });
  if (p === '/v1/admin/session') return json(200, { authenticated: true, schoolVerified: true, subjectId: 'owner', displayName: '합성 운영자', enrolled: true, enrollmentPending: false, bootstrapAvailable: false, mfaRequired: false, authorized: true, role: state.role, permissions: { read: true, write: state.role !== 'viewer', manageOperators: state.role === 'owner' }, mfaVerified: false, mfaVerifiedUntil: null });
  if (p === '/v1/admin/overview') return json(200, { subjects: 123, linked: 123, suspended: 1, snapshot: null, sync: { enabled: false, running: false, lastSuccessAt: null, lastError: null }, servers: [state.server] });
  if (p === '/v1/admin/servers') return json(200, { servers: [state.server] });
  if (p === '/v1/admin/servers/fixture' && req.method === 'PUT') {
    let text = ''; for await (const part of req) text += part;
    const body = JSON.parse(text); state.writes.push({ body, csrf: req.headers['x-csrf-token'] });
    if (state.serverError) return json(409, { code: state.serverError });
    if (body.expectedUpdatedAt !== state.server.updatedAt) return json(409, { code: 'server_changed' });
    Object.assign(state.server, body, { updatedAt: future }); return json(200, { updated: true });
  }
  if (p === '/v1/admin/members') {
    const query = Object.fromEntries(url.searchParams); state.queries.push(query);
    if (state.memberError) return json(400, { code: state.memberError });
    const ids = query.ids?.split(',');
    const q = query.q?.toLocaleLowerCase() ?? '';
    const found = fixtures.filter(member => ids ? ids.includes(member.id) : [member.displayName, member.studentId, member.minecraft.name, member.discordConnection.username, member.discordId].some(value => value.toLocaleLowerCase().includes(q)));
    const offset = Number(query.cursor ?? 0), limit = Number(query.limit ?? 50);
    const result = { members: found.slice(offset, offset + limit), total: found.length, nextCursor: offset + limit < found.length ? String(offset + limit) : null };
    const respond = () => json(200, result);
    if (state.hold?.(query)) { state.hold = null; state.release = respond; } else respond();
    return;
  }
  const requested = path.resolve(dist, `.${p === '/' ? '/index.html' : p}`);
  if (!requested.startsWith(`${dist}/`)) return json(404, {});
  try { const data = await readFile(requested); res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] || 'application/octet-stream' }); res.end(data); } catch { json(404, {}); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', session, ...args], { timeout: 30000, maxBuffer: 1e6 })).stdout.trim();
const inspect = async expression => { let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async expression => { for (let i = 0; i < 25; i++) { if (await inspect(expression)) return; await new Promise(r => setTimeout(r, 150)); } assert.fail(expression); };
const click = name => browser('find', 'role', 'button', 'click', '--name', name, '--exact');
const tab = name => browser('find', 'role', 'tab', 'click', '--name', name, '--exact');
const queryInput = '.server-member-picker input[type="search"]';
const rows = '.server-picker-results input[type="checkbox"]';
const visibleIds = () => inspect(`[...document.querySelectorAll('${rows}')].map(input=>input.value)`);
const query = value => browser('fill', queryInput, value);
const toggle = value => browser('click', `${rows}[value="${id(value)}"]`);
const open = async (origin, edit = true) => {
  await browser('open', 'about:blank'); await browser('open', origin); await browser('wait', '--load', 'networkidle');
  await click('서버 관리'); await until('Boolean(document.querySelector(".server-summary"))'); await browser('click', '.server-summary');
  if (edit) { await click('접근 및 설정'); await until('Boolean(document.querySelector("#server-access"))'); }
};
test('server member picker, staff-only and Discord access conditions', { timeout: 360000 }, async t => {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const scenario = (name, execute) => t.test(name, { skip: Boolean(process.env.PASSPORT_BROWSER_CASE && !name.includes(process.env.PASSPORT_BROWSER_CASE)) }, execute);
  try {
    await scenario('four access modes are offered; legacy roster displays and saves as current club members', async () => {
      reset(); state.server.accessMode = 'roster'; state.server.allowedSubjectIds = [];
      await open(origin);
      assert.equal(await inspect('document.querySelector(".server-summary-policy").textContent'), '소모임 회원 전체');
      assert.equal(await inspect('document.querySelector("#server-access").value'), 'members');
      assert.deepEqual(await inspect('[...document.querySelectorAll("#server-access option")].map(option=>option.value)'), ['members', 'staff', 'selected', 'university']);
      assert.equal(await inspect('document.querySelector(".admin-dialog").textContent.includes("명부")'), false);
      assert.match(await inspect('document.querySelector(".admin-dialog").textContent'), /현재 소모임 회원 모두/);
      assert.equal(await inspect('[...document.querySelectorAll("nav button")].some(button=>button.textContent.includes("회원 시트 동기화"))'), true);
      assert.equal(state.writes.length, 0); assert.equal(state.queries.length, 0);
      await browser('set', 'viewport', '1440', '1000'); await browser('screenshot', path.join(output, 'server-four-modes-desktop.png'));
      await browser('set', 'viewport', '390', '844'); assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'), true);
      await browser('screenshot', path.join(output, 'server-four-modes-mobile.png'));
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal(state.writes[0].body.accessMode, 'members'); assert.equal(state.writes[0].body.discordRequirement, 'any');
      assert.deepEqual(state.writes[0].body.allowedSubjectIds, []); assert.equal(state.writes[0].csrf, 'synthetic-csrf');
      assert.equal(state.writes[0].body.expectedUpdatedAt, '2026-10-02T00:00:00.000Z');
      reset(); await open(origin); // Changing the local mode must not clear selected IDs.
      await browser('select', '#server-access', 'members'); await browser('select', '#server-access', 'staff'); await browser('select', '#server-access', 'university');
      await browser('select', '#server-discord-requirement', 'linked'); await browser('select', '#server-access', 'selected');
      assert.equal(await inspect('document.querySelectorAll(".server-picker-tabs button")[1].textContent'), '선택됨 13명');
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal(state.writes[0].body.accessMode, 'selected'); assert.equal(state.writes[0].body.discordRequirement, 'any');
      assert.deepEqual(state.writes[0].body.allowedSubjectIds, original);
    });
    await scenario('staff-only access saves and reopens with cleared selected and Discord conditions, retaining revision guards', async () => {
      reset(); await open(origin); await browser('select', '#server-access', 'staff');
      assert.equal(await inspect('document.querySelector(".server-member-picker")===null && document.querySelector("#server-discord-requirement")===null'), true);
      assert.match(await inspect('document.querySelector(".admin-dialog").textContent'), /총괄 운영자·운영자만 접속/);
      assert.match(await inspect('document.querySelector(".admin-dialog").textContent'), /조회 전용 역할은 제외/);
      assert.equal(state.queries.length, 0);
      await browser('set', 'viewport', '1440', '1000'); await browser('screenshot', path.join(output, 'server-staff-only-desktop.png'));
      await browser('set', 'viewport', '390', '844');
      assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth && document.querySelector(".admin-dialog").scrollWidth<=document.querySelector(".admin-dialog").clientWidth'), true);
      await browser('screenshot', path.join(output, 'server-staff-only-mobile.png'));
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal(state.writes[0].body.accessMode, 'staff'); assert.deepEqual(state.writes[0].body.allowedSubjectIds, []);
      assert.equal(state.writes[0].body.discordRequirement, 'any'); assert.equal(state.writes[0].csrf, 'synthetic-csrf');
      assert.equal(state.writes[0].body.expectedUpdatedAt, '2026-10-02T00:00:00.000Z');
      assert.equal(await inspect('document.querySelector(".server-summary-policy").textContent'), '소모임 운영진만');
      await click('접근 및 설정'); await until('Boolean(document.querySelector("#server-access"))');
      assert.equal(await inspect('document.querySelector("#server-access").value'), 'staff');
      assert.equal(await inspect('document.querySelector(".server-member-picker")===null && document.querySelector("#server-discord-requirement")===null'), true);
      await click('취소');
      reset(); state.server.accessMode = 'university'; state.server.discordRequirement = 'linked'; await open(origin);
      await browser('select', '#server-access', 'staff'); state.serverError = 'server_changed'; await click('설정 저장');
      await until('document.querySelector(".admin-dialog").textContent.includes("다른 곳에서 서버 설정이 변경되었습니다")');
      assert.equal(state.server.accessMode, 'university'); assert.equal(state.server.discordRequirement, 'linked');
      assert.deepEqual(state.server.allowedSubjectIds, original);
      state.serverError = null; await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal(state.server.accessMode, 'staff'); assert.equal(state.server.discordRequirement, 'any');
      assert.deepEqual(state.server.allowedSubjectIds, []); assert.equal(state.queries.length, 0);
      assert.equal(await browser('errors'), '');
    });
    await scenario('123 accounts stay search-only; pages replace results and preserve hidden or unresolved selections', async () => {
      reset(); await open(origin); await browser('set', 'viewport', '1440', '1000');
      assert.equal(state.queries.length, 0); assert.deepEqual(await visibleIds(), []);
      assert.match(await inspect('document.querySelector(".server-picker-status").textContent'), /검색어를 입력/);
      await query('합성 회원'); await until(`document.querySelectorAll('${rows}').length===10`);
      assert.deepEqual(state.queries.at(-1), { limit: '10', q: '합성 회원' });
      assert.deepEqual(await visibleIds(), Array.from({ length: 10 }, (_, i) => id(i + 1)));
      await toggle(1); await click('검색 다음'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(11))}`);
      assert.equal((await visibleIds()).length, 10); await toggle(11);
      await click('검색 이전'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(1))}`);
      assert.equal(await inspect(`document.querySelector('${rows}[value="${id(1)}"]').checked`), true);
      await browser('eval', 'document.querySelector(".server-member-picker").scrollIntoView({block:"center"})');
      await browser('screenshot', path.join(output, 'server-members-search-desktop.png'));
      await tab('선택됨 15명'); await until(`document.querySelector('.server-picker-results').getAttribute('aria-busy')==='false'`);
      assert.deepEqual(await visibleIds(), original.slice(0, 10));
      assert.deepEqual(state.queries.at(-1), { limit: '10', ids: original.slice(0, 10).join(',') });
      await click('선택 다음'); await until(`document.querySelectorAll('${rows}').length===5 && document.querySelector('.server-picker-results').getAttribute('aria-busy')==='false'`);
      assert.deepEqual(await visibleIds(), [id(110), id(111), id(999), id(1), id(11)]);
      assert.match(await inspect('document.querySelector(".server-picker-results").textContent'), /회원 정보를 확인할 수 없습니다/);
      await browser('set', 'viewport', '390', '844');
      assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth && document.querySelector(".admin-dialog").scrollWidth<=document.querySelector(".admin-dialog").clientWidth'), true);
      assert.equal(await inspect('document.querySelector(".server-picker-results").getBoundingClientRect().height<=280'), true);
      await browser('eval', 'document.querySelector(".server-member-picker").scrollIntoView({block:"center"})');
      await browser('screenshot', path.join(output, 'server-members-selected-mobile.png'));
      await click('선택 이전'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(100))}`); await toggle(100);
      await tab('회원 검색'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(1))}`);
      assert.equal(await inspect(`document.querySelector('${rows}[value="${id(1)}"]').checked`), true);
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.deepEqual(state.writes[0].body.allowedSubjectIds, [...original.filter(value => value !== id(100)), id(1), id(11)]);
      assert.equal(state.writes[0].body.discordRequirement, 'any'); assert.equal(state.writes[0].csrf, 'synthetic-csrf');
      assert.equal(state.writes[0].body.expectedUpdatedAt, '2026-10-02T00:00:00.000Z');
      assert.ok(state.queries.every(value => value.limit === '10' && (value.q || value.ids)));
    });
    await scenario('search debounce, stale pages and selected-ID responses cannot replace the current view', async () => {
      reset(); await open(origin);
      await browser('eval', `(() => { const input=document.querySelector('${queryInput}'), setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; ['합','합성','합성 회원'].forEach((value,i)=>setTimeout(()=>{setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}, i*50)); })()`);
      await until(`document.querySelectorAll('${rows}').length===10`); assert.equal(state.queries.length, 1);
      state.hold = value => value.cursor === '10'; await click('검색 다음');
      await until('document.querySelector(".server-picker-results").getAttribute("aria-busy")==="true"');
      for (let i = 0; !state.release && i < 30; i++) await new Promise(r => setTimeout(r, 100)); assert.equal(typeof state.release, 'function');
      await query('SyntheticPlayer123'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(123))}`);
      state.release(); state.release = null; await browser('wait', '--load', 'networkidle');
      assert.deepEqual(await visibleIds(), [id(123)]); await toggle(123); // School-verified non-member is selectable.
      state.hold = value => Boolean(value.ids); await tab('선택됨 14명');
      for (let i = 0; !state.release && i < 30; i++) await new Promise(r => setTimeout(r, 100)); assert.equal(typeof state.release, 'function');
      await click('선택 다음'); await until('document.querySelector(".server-picker-results").getAttribute("aria-busy")==="false"');
      state.release(); state.release = null; await browser('wait', '--load', 'networkidle');
      assert.deepEqual(await visibleIds(), [id(110), id(111), id(999), id(123)]);
      await tab('회원 검색'); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(123))}`);
      const before = state.queries.length;
      await browser('eval', `(() => { const input=document.querySelector('${queryInput}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await until(`document.querySelectorAll('${rows}').length===0`); await new Promise(r => setTimeout(r, 350)); assert.equal(state.queries.length, before);
      for (const search of ['20990123', 'synthetic_discord_123', '100000000000000123']) { await query(search); await until(`document.querySelector('${rows}')?.value===${JSON.stringify(id(123))}`); assert.equal(state.queries.at(-1).q, search); }
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null'); assert.ok(state.writes[0].body.allowedSubjectIds.includes(id(123)));
    });
    await scenario('lookup failures keep IDs, retry resolves names and keyboard tabs retain search', async () => {
      reset(); await open(origin); state.memberError = 'invalid_request'; await tab('선택됨 13명');
      await until('Boolean(document.querySelector(".server-picker-error"))');
      assert.deepEqual(await visibleIds(), original.slice(0, 10)); assert.match(await inspect('document.querySelector(".server-picker-error").textContent'), /기존 선택은 유지/);
      state.memberError = null; await click('다시 불러오기'); await until('document.querySelector(".server-picker-results strong")?.textContent==="합성 회원 100"');
      await browser('focus', '.server-picker-tabs button[aria-selected="true"]'); await browser('press', 'ArrowLeft');
      assert.equal(await inspect('document.activeElement.textContent'), '회원 검색'); assert.equal(await inspect('document.activeElement.getAttribute("aria-selected")'), 'true');
      assert.equal(await inspect('document.querySelector(".server-picker-results").textContent'), '');
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null'); assert.deepEqual(state.writes[0].body.allowedSubjectIds, original);
    });
    await scenario('Discord conditions persist only for university mode, survive legacy API and keep revision guards', async () => {
      for (const requirement of ['any', 'linked', 'unlinked']) {
        reset(); state.server.accessMode = 'university'; state.server.allowedSubjectIds = []; await open(origin);
        assert.equal(state.queries.length, 0); await browser('select', '#server-discord-requirement', requirement);
        if (requirement === 'linked') { await browser('set', 'viewport', '1440', '1000'); await browser('screenshot', path.join(output, 'server-discord-condition-desktop.png')); }
        await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null'); assert.equal(state.writes[0].body.discordRequirement, requirement);
      }
      reset(); state.server.accessMode = 'university'; state.server.discordRequirement = 'linked'; await open(origin);
      await browser('select', '#server-access', 'members'); assert.equal(await inspect('document.querySelector("#server-discord-requirement")===null'), true);
      assert.match(await inspect('document.querySelector(".admin-dialog").textContent'), /현재 소모임 회원 모두/);
      await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null'); assert.equal(state.writes[0].body.discordRequirement, 'any');
      reset(); state.server.accessMode = 'university'; delete state.server.discordRequirement; await open(origin);
      assert.equal(await inspect('document.querySelector("#server-discord-requirement").disabled'), true);
      assert.match(await inspect('document.querySelector("#server-discord-help").textContent'), /준비 중/);
      await browser('fill', '#server-label', '합성 이전 API'); await click('설정 저장'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal('discordRequirement' in state.writes[0].body, false); assert.equal(state.writes[0].body.label, '합성 이전 API');
      reset(); await open(origin); state.serverError = 'server_changed'; await click('설정 저장');
      await until('document.querySelector(".admin-dialog").textContent.includes("다른 곳에서 서버 설정이 변경되었습니다")'); assert.deepEqual(state.server.allowedSubjectIds, original);
    });
    await scenario('viewer cannot edit; live downgrade closes the picker without a write or stored PII', async () => {
      reset(); state.role = 'viewer'; await open(origin, false);
      assert.equal(await inspect('document.querySelector(".server-expanded button")===null'), true); assert.equal(state.queries.length, 0);
      reset(); await open(origin); await query('합성 회원'); await until(`document.querySelectorAll('${rows}').length===10`); await toggle(1);
      state.role = 'viewer'; await browser('eval', 'window.dispatchEvent(new Event("focus"))'); await until('document.querySelector(".admin-dialog")===null');
      assert.equal(state.writes.length, 0); assert.equal(await inspect('localStorage.length+sessionStorage.length'), 0); assert.equal(await browser('errors'), '');
    });
  } finally { state.release?.(); await browser('close').catch(() => {}); await new Promise(resolve => server.close(resolve)); }
});
