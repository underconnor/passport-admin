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
const session = `passport-admin-members-${process.pid}`;
const future = new Date(Date.now() + 86_400_000).toISOString();
const member = (i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, revision: `revision-${i}`, createdAt: '2026-01-01T00:00:00.000Z', administrator: i === 2, admissionYear: '26', studentId: `2026${String(i).padStart(4, '0')}`, presence: {online:i===1,serverId:i===1?'fixture':null,serverLabel:i===1?'합성 서버':null,lastSeenAt:future}, displayName: i === 1 ? '가상나래' : `가상 회원 ${String(i).padStart(2, '0')}`, department: '가상 학과', membershipStatus: i % 2 ? 'active' : 'inactive', roleLabel: '회원', verifiedUntil: future, universityVerifiedUntil: future, allowedServerIds: ['fixture'], eligibleServerIds: ['fixture'], accessSuspended: false, scopeRestricted: false, scopeLimit: [], discordId: null, discordConnection: { discordId: `1000000000000000${String(i).padStart(2,'0')}`, username: i === 1 ? 'cosmos' : `discord.member.${i}`, displayName: i === 1 ? '별나래' : `디스코드 ${i}`, linkedAt: future, roleStatus: 'granted', roleUpdatedAt: future }, minecraft: { name: i === 1 ? 'MineQuartz' : `Synthetic${i}`, uuid: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}` } });
let state;
const reset = () => { state = { authorized: true, statsReads: [], extraCounters: {}, rows: Array.from({length: 25}, (_, i) => member(i + 1)), reads: [], writes: [], deleteError: null, hold: false, release: null }; };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const json = (code, data) => { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
  const body = async () => { let text = ''; for await (const part of req) text += part; return JSON.parse(text); };
  if (url.pathname === '/v1/auth/session') return json(200, {authenticated:true,authMode:'university',csrfToken:'synthetic-admin-csrf'});
  if (url.pathname === '/v1/admin/session') return json(200, {authenticated:true,schoolVerified:true,subjectId:"fixture-owner",role:"owner",permissions:{read:true,write:true,manageOperators:true},displayName:'합성 운영자',enrolled:true,enrollmentPending:false,bootstrapAvailable:false,mfaRequired:false,authorized:state.authorized,mfaVerified:false,mfaVerifiedUntil:null});
  if (url.pathname === '/v1/admin/overview') return json(200, {subjects:25,linked:25,suspended:0,snapshot:null,sync:{enabled:false,running:false,lastSuccessAt:null,lastError:null},servers:[{id:'fixture',label:'합성 서버'}]});
  if (url.pathname === '/v1/admin/servers') return json(200, {servers:[{id:'fixture',label:'합성 서버',enabled:true,sensitive:false,accessMode:'members',allowedSubjectIds:[],paperSeenAt:future,proxySeenAt:future,online:true,proxyAvailable:true,createdAt:future,updatedAt:future}]});
  if (url.pathname === '/v1/admin/members') {
    if (!state.authorized) return json(403, {code:'admin_required'});
    state.reads.push(Object.fromEntries(url.searchParams));
    let rows = state.rows;
    const q = (url.searchParams.get('q') || '').toLowerCase();
    if (q) rows = rows.filter(row => [row.displayName,row.minecraft.name,row.discordConnection.username,row.discordConnection.displayName,row.discordConnection.discordId,row.studentId].filter(Boolean).some(value => value.toLowerCase().includes(q)));
    const filter = url.searchParams.get('membership'); if (filter && filter !== 'all') rows = rows.filter(row => row.membershipStatus === filter);
    if (url.searchParams.get('sort') === 'newest') rows = [...rows].reverse();
    const total = rows.length; const cursor = url.searchParams.get('cursor'); if (cursor) rows = rows.slice(20);
    const result = {members:rows.slice(0,20),total,nextCursor:rows.length > 20 ? 'signed-opaque-cursor' : null};
    if (state.hold) { state.hold = false; state.release = () => json(200,result); return; }
    return json(200,result);
  }

  if (url.pathname === '/v1/admin/stats' || /^\/v1\/admin\/members\/[^/]+\/stats$/.test(url.pathname)) {
    state.statsReads.push(url.pathname);
    if (!state.authorized) return json(403,{code:'admin_required'});
    const counters={playSeconds:7260,blocksBroken:15000,blocksPlaced:4200,damageTakenMilli:50000,deaths:10,mobKills:380,...state.extraCounters};
    return json(200,{available:true,totals:counters,servers:[{serverId:'fixture',label:'합성 서버',...counters,playSeconds:3660,onlinePlayerCount:1}],...(url.pathname==='/v1/admin/stats'?{playerCount:25,onlinePlayerCount:1}:{presence:member(1).presence})});
  }
  if (url.pathname.startsWith('/v1/admin/members/') && ['DELETE','PUT'].includes(req.method)) {
    const input = await body(); state.writes.push({path:url.pathname,method:req.method,input,csrf:req.headers['x-csrf-token']});
    if (req.method === 'DELETE') {
      if (state.deleteError) return json(409,{code:state.deleteError});
      const id = url.pathname.split('/').at(-1); const row = state.rows.find(item => item.id === id);
      if (input.expectedRevision !== row.revision) return json(409,{code:'subject_changed'});
      if (input.confirmation !== row.displayName) return json(400,{code:'confirmation_mismatch'});
      state.rows = state.rows.filter(item => item.id !== id); return json(200,{deleted:true,discordRevocationPending:true});
    }
    return json(200,{updated:true});
  }
  const requested = path.resolve(dist, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404,{});
  try { const data = await readFile(requested); const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(requested)] || 'application/octet-stream'; res.writeHead(200,{'Content-Type':mime,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'"});res.end(data); } catch { json(404,{}); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes','agent-browser@0.38.1']), '--session',session,...args],{timeout:30_000,maxBuffer:1_000_000})).stdout.trim();
const inspect = async expression => { let value = JSON.parse(await browser('eval',`JSON.stringify(${expression})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async expression => { for (let n=0;n<16;n++) { if (await inspect(expression)) return; await new Promise(resolve => setTimeout(resolve,300)); } assert.fail(`Expected UI condition: ${expression}`); };
const click = name => browser('find','role','button','click','--name',name);
const fill = (label,value) => browser('find','label',label,'fill',value);
const open = async origin => { await browser('open','about:blank'); await browser('open',origin);await browser('wait','--load','networkidle');await click('회원 관리');await until('document.querySelectorAll(".member-summary").length > 0'); };
const search = async q => { const reads = state.reads.length; if (q) { await fill('회원 통합 검색',q); await until('document.querySelector(".member-search .primary").disabled === false'); await browser('click','.member-search .primary'); } else { await click('검색 초기화'); } for (let n=0; n<20 && (state.reads.length === reads || state.reads.at(-1).q !== q); n++) await new Promise(resolve => setTimeout(resolve,100)); assert.equal(state.reads.at(-1).q,q); await until(`document.querySelectorAll(".member-summary").length === ${q ? 1 : 20}`); };
const expand = () => browser('click','.member-summary');
const deleteDialog = async () => { await expand();await until('Boolean(document.querySelector(".member-expanded"))');await click('회원 정보 삭제');await until('Boolean(document.querySelector("#delete-member-name"))'); };
const confirmDelete = async () => { await fill('확인을 위해 ‘가상나래’ 입력','가상나래');await browser('find','role','checkbox','check','--name','위 계정과 삭제 범위를 확인했습니다.');await browser('click','.dialog-actions .destructive'); };
test('compact admin records preserve server-side search and destructive-action safety', {timeout:300_000},async t => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    await t.test('compact rows expand, inline access editing and server rows work on desktop and mobile',async () => {
      reset();await open(origin);await browser('set','viewport','1440','1000');
      assert.equal(await inspect('document.querySelectorAll(".member-summary").length'),20);
      assert.equal(await inspect('document.querySelectorAll(".member-expanded").length'),0);assert.equal(await inspect('document.querySelector(".member-presence").textContent'),'접속 중 · 합성 서버');
      await browser('click','.member-summary:first-child');await until('Boolean(document.querySelector(".member-expanded"))');await click('접근 제한 수정');
      assert.equal(await inspect('document.querySelector(".admin-dialog") === null'),true);
      await browser('find','role','checkbox','check','--name','사용자 접근 정지');await click('접근 제한 저장');await until("document.body.textContent.includes('접근 제한을 저장했습니다')");
      assert.equal(state.writes[0].csrf,'synthetic-admin-csrf');assert.equal(state.writes[0].input.suspended,true);
      await browser('screenshot','/tmp/passport-admin-members-desktop.png');
      await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);await browser('screenshot','/tmp/passport-admin-members-mobile.png');
      await click('서버 관리');await until('Boolean(document.querySelector(".server-summary"))');await browser('click','.server-summary');assert.equal(await inspect('Boolean(document.querySelector(".server-expanded"))'),true);assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);
      await browser('screenshot','/tmp/passport-admin-servers-mobile.png');
    });
    await t.test('verified full student IDs appear in summary and details while absent and legacy values require reauthentication',async () => {
      reset();state.rows=[member(1),{...member(2),studentId:null},member(3)];delete state.rows[2].studentId;
      await open(origin);await browser('set','viewport','1440','1000');
      assert.match(await inspect('document.querySelector(".member-summary-name small").textContent'),/^20260001 · 가상 학과/);
      await browser('click','.member-summary:first-child');await until('Boolean(document.querySelector(".member-expanded"))');
      assert.deepEqual(await inspect('[...document.querySelector(".member-facts").firstElementChild.children].map(el => el.textContent)'),['학번','20260001']);
      assert.equal(await inspect('document.body.textContent.includes("입학 학번") || document.body.textContent.includes("26학번")'),false);
      await browser('screenshot','/tmp/passport-admin-full-student-id-desktop.png');
      await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true);
      await browser('screenshot','/tmp/passport-admin-full-student-id-mobile.png');
      for (const row of [2,3]) {
        await browser('click',`.member-row:nth-of-type(${row}) .member-summary`);await until('Boolean(document.querySelector(".member-expanded"))');
        assert.equal(await inspect('document.querySelector(".member-facts dd").textContent'),'학교 재인증 필요');
        assert.match(await inspect(`document.querySelector('.member-row:nth-of-type(${row}) .member-summary-name small').textContent`),/^학교 재인증 필요/);
      }
      assert.equal(await inspect('localStorage.length + sessionStorage.length'),0);assert.equal(await inspect('location.search'),'');assert.equal(state.writes.length,0);
    });
    await t.test('all identity searches, member filters, sorting and opaque next/previous pagination reach API',async () => {
      reset();await open(origin);
      for (const q of ['가상나래','20260001','MineQuartz','cosmos','100000000000000001']) {await search(q);assert.equal(await inspect('document.querySelectorAll(".member-summary").length'),1, q + JSON.stringify(state.reads) + await inspect('[...document.querySelectorAll(".member-summary-name strong")].map(el => el.textContent)'));assert.equal(state.reads.at(-1).q,q);}
      await search('');await click('다음');await until('document.querySelectorAll(".member-summary").length === 5');assert.equal(state.reads.at(-1).cursor,'signed-opaque-cursor');
      await click('이전');await until('document.querySelectorAll(".member-summary").length === 20');
      await browser('select','#membership-filter','active');await until('document.querySelectorAll(".member-summary").length === 13');await browser('select','#member-sort','newest');await until('document.querySelector(".member-summary-name strong").textContent === "가상 회원 25"');
      assert.equal(state.reads.at(-1).sort,'newest');assert.equal(state.reads.at(-1).membership,'active');assert.equal(await inspect('localStorage.length + sessionStorage.length'),0);assert.equal(await inspect('location.search'), '');
    });
    await t.test('an expired roster confirmation never presents the account as a current club member',async () => {
      reset();state.rows=[{...member(1),verifiedUntil:'2000-01-01T00:00:00.000Z'}];await open(origin);
      assert.equal(await inspect('document.querySelector(".member-kind").textContent'),'회원 확인 만료');
      assert.equal(await inspect('document.querySelector(".member-kind").classList.contains("member-kind-active")'),false);
    });
    await t.test('typed target confirmation, self/last-admin protection, revision conflict and successful deletion',async () => {
      reset();await open(origin);await search('가상나래');await deleteDialog();
      assert.equal(await inspect('document.querySelector(".dialog-actions .destructive").disabled'),true);assert.equal(state.writes.length,0);
      state.deleteError='cannot_delete_self';await confirmDelete();await until("document.body.textContent.includes('현재 로그인한 관리자 계정은 삭제할 수 없습니다')");
      state.deleteError='last_administrator';await browser('click','.dialog-actions .destructive');await until("document.body.textContent.includes('마지막 관리자 계정은 삭제할 수 없습니다')");
      state.deleteError='subject_changed';await browser('click','.dialog-actions .destructive');await until("document.body.textContent.includes('다른 곳에서 회원 정보가 변경되었습니다')");assert.equal(await inspect('document.querySelector(".dialog-actions .destructive").disabled'),true);
      await click('닫고 목록 확인');await click('목록 새로고침');await until('document.querySelectorAll(".member-summary").length === 1');state.deleteError=null;await deleteDialog();await confirmDelete();await until('document.querySelectorAll(".member-summary").length === 0');
      assert.deepEqual(state.writes.at(-1).input,{expectedRevision:'revision-1',confirmation:'가상나래'});assert.equal(state.writes.at(-1).csrf,'synthetic-admin-csrf');assert.equal(await inspect('document.querySelector(".admin-dialog") === null'),true);
    });

    await t.test('admin overall statistics and expanded personal records only request authorized endpoints',async () => {
      reset(); await open(origin); await click('플레이 통계'); await until('document.querySelectorAll(".stats-metric").length === 8');
      assert.deepEqual(state.statsReads,['/v1/admin/stats']); assert.equal(await inspect('document.querySelector(".stats-presence strong").textContent'),'현재 접속 1명'); assert.equal(await inspect('document.querySelector(".stats-metric strong").textContent'),'2시간 1분');
      assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric")].slice(-2).map(el=>el.querySelector("strong").textContent)'),['0','0 m']);
      state.extraCounters={playerKills:3,distanceCm:123456};await click('기록 새로고침');await until('document.querySelectorAll(".stats-metric").length === 8');
      assert.deepEqual(await inspect('[...document.querySelectorAll(".stats-metric")].slice(-2).map(el=>[el.querySelector("span").textContent,el.querySelector("strong").textContent])'),[['플레이어 처치','3'],['이동 거리','1.2 km']]);
      await browser('set','viewport','1440','900'); await browser('screenshot','/tmp/passport-admin-stats-desktop.png');
      await browser('select','.stats-scope select','fixture'); await until('document.querySelector(".stats-metric strong").textContent === "1시간 1분"');
      await browser('set','viewport','390','844'); assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'),true); await browser('screenshot','/tmp/passport-admin-stats-mobile.png','--full');
      await click('회원 관리'); await until('document.querySelectorAll(".member-summary").length === 20'); await search('가상나래'); await expand(); await until('Boolean(document.querySelector(".member-expanded"))');
      assert.equal(state.statsReads.length,2); await click('플레이 기록'); await until('document.querySelectorAll(".member-stats .stats-metric").length === 8');
      assert.equal(state.statsReads.at(-1),`/v1/admin/members/${member(1).id}/stats`);
      state.authorized=false; await click('기록 새로고침'); await until('document.querySelector("#member-search") === null'); assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),0);
    });
    await t.test('late old search cannot replace a new filter and authorization loss clears personal controls',async () => {
      reset();await open(origin);state.hold=true;await fill('회원 통합 검색','가상나래');await browser('click','.member-search .primary');
      assert.equal(typeof state.release,'function');await browser('select','#membership-filter','inactive');await until("document.body.textContent.includes('조건에 맞는 사용자가 없습니다')");state.release();state.release=null;await browser('wait','--load','networkidle');assert.equal(await inspect('document.querySelectorAll(".member-summary").length'),0);
      state.authorized=false;await click('목록 새로고침');await until('document.querySelector("#member-search") === null');assert.equal(await inspect('document.querySelectorAll(".member-summary").length'),0);assert.equal(await browser('errors'),'');
    });
  } finally {state.release?.();await browser('close').catch(()=>{});await new Promise(resolve=>server.close(resolve));}
});
