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
const session = `passport-admin-operators-${process.pid}`;
const future = new Date(Date.now() + 86_400_000).toISOString();
const old = '2000-01-01T00:00:00.000Z';
const operator = (id,role='operator') => ({subjectId:id,displayName:`합성 ${id}`,studentId:'20260001',role,enabled:true,createdAt:old});
const invitation = (id='invite-1',subjectId='target',role='viewer') => ({id,subjectId,displayName:`합성 ${subjectId}`,role,expiresAt:future,createdAt:old,status:'pending'});
const member = (id='target') => ({id,revision:'1',displayName:`합성 ${id}`,studentId:'20260003',department:'가상 학과',administrator:false,createdAt:old,universityVerifiedUntil:future,verifiedUntil:future,membershipStatus:'active',roleLabel:'회원',accessSuspended:false,allowedServerIds:['fixture'],eligibleServerIds:['fixture'],scopeRestricted:false,scopeLimit:[],presence:{online:false,serverId:null,serverLabel:null,lastSeenAt:null},minecraft:{uuid:'00000000-0000-4000-8000-000000000001',name:'Synthetic'},discordId:null,discordConnection:null});
const settings = {guildId:'100000000000000001',verificationRoleId:'100000000000000002',memberRoleId:'100000000000000003',currentSemester:'26-2',semesterRoles:[{semester:'26-2',roleId:'100000000000000004'}],nicknameEnabled:true,revision:'1'};
let state;
const reset = () => { state={role:'owner',subjectId:'owner',authorized:true,authenticated:true,csrf:'synthetic-before',operators:[operator('owner','owner'),operator('second'),operator('reader','viewer')],invitations:[],rows:[member()],writes:[],reads:[],forceError:null,holdSearch:false,release:null}; };
const server = http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'); const p=url.pathname;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(p==='/v1/auth/session')return json(200,{authenticated:state.authenticated,authMode:'university',csrfToken:state.csrf});
  if(p==='/v1/admin/session')return json(200,{authenticated:state.authenticated,schoolVerified:state.authenticated,subjectId:state.authenticated?state.subjectId:null,displayName:`합성 ${state.subjectId}`,enrolled:state.authorized,enrollmentPending:false,bootstrapAvailable:false,mfaRequired:false,authorized:state.authorized,role:state.authorized?state.role:null,permissions:{read:state.authorized,write:state.authorized&&state.role!=='viewer',manageOperators:state.authorized&&state.role==='owner'},mfaVerified:false,mfaVerifiedUntil:null});
  if(req.method==='GET') state.reads.push(p);
  if(p==='/v1/admin/operator-invitations/pending')return json(200,{invitations:state.invitations.filter(i=>i.subjectId===state.subjectId&&i.status==='pending')});
  if(p==='/v1/admin/overview')return json(200,{subjects:3,linked:1,suspended:0,snapshot:null,sync:{enabled:false,running:false,lastSuccessAt:null,lastError:null},servers:[{id:'fixture',label:'합성 서버',commandName:'합성'}]});
  if(p==='/v1/admin/operators'&&req.method==='GET')return state.role==='owner'?json(200,{operators:state.operators,invitations:state.invitations}):json(403,{code:'owner_required'});
  if(p==='/v1/admin/members'&&req.method==='GET'){const result={members:state.rows,total:state.rows.length,nextCursor:null};if(state.holdSearch){state.holdSearch=false;state.release=()=>json(200,result);return;}return json(200,result);}
  if(p==='/v1/admin/servers'&&req.method==='GET')return json(200,{servers:[{id:'fixture',label:'합성 서버',commandName:'합성',enabled:true,sensitive:false,accessMode:'members',allowedSubjectIds:[],paperSeenAt:future,proxySeenAt:future,online:true,proxyAvailable:true,createdAt:old,updatedAt:old}]});
  if(p==='/v1/admin/discord'&&req.method==='GET')return json(200,{configured:true,settings,status:{linked:1,roles:{pending:0,failed:0},nicknames:{pending:0,failed:0}}});
  if(p.startsWith('/v1/')&&req.method!=='GET'){
    let content='';for await (const chunk of req)content+=chunk;const input=content?JSON.parse(content):{};
    state.writes.push({path:p,method:req.method,input,csrf:req.headers['x-csrf-token']});
    if(state.forceError)return json(409,{code:state.forceError});
    if(p.endsWith('/accept')){const invite=state.invitations.find(i=>p.includes(i.id));if(!invite||invite.subjectId!==state.subjectId)return json(404,{code:'invitation_not_found'});if(new Date(invite.expiresAt).getTime()<=Date.now())return json(410,{code:'invitation_expired'});if(invite.status!=='pending')return json(409,{code:'invitation_unavailable'});invite.status='accepted';state.authorized=true;state.role=invite.role;state.csrf='synthetic-after';return json(200,{accepted:true,role:invite.role});}
    if(state.role!=='owner')return json(403,{code:'owner_required'});
    if(p==='/v1/admin/operator-invitations'){const invite=invitation(`invite-${state.invitations.length+1}`,input.subjectId,input.role);state.invitations.push(invite);return json(200,{invitation:invite});}
    if(p.startsWith('/v1/admin/operator-invitations/')){state.invitations.find(i=>p.endsWith(i.id)).status='revoked';return json(200,{revoked:true});}
    if(p.startsWith('/v1/admin/operators/')){const op=state.operators.find(o=>p.endsWith(o.subjectId));if(req.method==='PUT')op.role=input.role;else op.enabled=false;return json(200,{updated:true});}
    return json(200,{updated:true});
  }
  const requested=path.resolve(dist,`.${p==='/'?'/index.html':p}`);if(!requested.startsWith(dist))return json(404,{});
  try{const data=await readFile(requested);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(requested)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'"});res.end(data);}catch{json(404,{});}
});
const browser=async(...args)=>(await run(process.env.PASSPORT_AGENT_BROWSER||'npx',[...(process.env.PASSPORT_AGENT_BROWSER?[]:['--yes','agent-browser@0.38.1']),'--session',session,...args],{timeout:30_000,maxBuffer:1_000_000})).stdout.trim();
const inspect=async expr=>{let value=JSON.parse(await browser('eval',`JSON.stringify(${expr})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const until=async expr=>{for(let n=0;n<20;n++){if(await inspect(expr))return;await new Promise(resolve=>setTimeout(resolve,250));}assert.fail(expr);};
const click=name=>browser('find','role','button','click','--name',name,'--exact');
const open=async origin=>{await browser('open','about:blank');await browser('open',origin);await browser('wait','--load','networkidle');};
const manage=async origin=>{await open(origin);await click('운영자 관리');await until('Boolean(document.querySelector(".operator-list .operator-row"))');};
const confirm=async()=>{await browser('find','role','checkbox','check','--name','대상 계정과 변경할 권한을 확인했습니다.');await browser('click','.dialog-actions .primary');};
const search=async()=>{await browser('fill','#operator-search','20260003');await browser('click','.operator-search .primary');await until('Boolean(document.querySelector(".operator-search-results .operator-row"))');};
const screenshot=async name=>{await browser('eval','new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');await browser('screenshot',`/tmp/passport-admin-operators-${name}.png`);};
test('multi-operator UI respects invitation lifecycle and role boundaries with synthetic loopback contracts',{timeout:400_000},async t=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    await t.test('owner selects a verified identity, confirms exact role, creates a target-bound invite and cancels it',async()=>{
      reset();await manage(origin);await browser('set','viewport','1440','900');await search();await click('초대');await until('Boolean(document.querySelector(".admin-dialog"))');
      assert.equal(await inspect('document.querySelector(".dialog-actions .primary").disabled'),true);assert.equal(state.writes.length,0);
      assert.equal(await inspect('document.querySelector(".admin-dialog").contains(document.activeElement)'),true);
      await browser('press','Escape');await until('document.querySelector(".admin-dialog")===null');assert.equal(state.writes.length,0);await click('초대');
      await browser('select','#operator-role','operator');await screenshot('invite-desktop');await confirm();await until('document.querySelector(".admin-dialog")===null');
      assert.deepEqual(state.writes[0],{path:'/v1/admin/operator-invitations',method:'POST',input:{subjectId:'target',role:'operator'},csrf:'synthetic-before'});
      assert.equal(state.invitations[0].status,'pending');await screenshot('desktop');await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('mobile');await browser('screenshot','/tmp/passport-admin-operators-mobile-full.png','--full');
      await click('초대 취소');await confirm();await until('document.querySelector(".admin-dialog")===null');assert.equal(state.invitations[0].status,'revoked');assert.equal(await inspect('document.body.textContent.includes("취소됨")'),true);
      assert.equal(await inspect('localStorage.length+sessionStorage.length'),0);assert.equal(await inspect('location.search'),'');
    });
    await t.test('self and last owner controls stay disabled; server race protection is explained; roles and access can be revoked',async()=>{
      reset();await manage(origin);await browser('set','viewport','1440','900');
      assert.equal(await inspect('[...document.querySelector(".operator-list .operator-row").querySelectorAll("button")].every(button=>button.disabled)'),true);
      await browser('click','.operator-list .operator-row:nth-child(2) button');await browser('select','#operator-role','viewer');state.forceError='last_owner';await confirm();await until('document.body.textContent.includes("마지막 총괄 운영자의 권한은 회수할 수 없습니다")');
      state.forceError=null;await browser('click','.dialog-actions .primary');await until('document.querySelector(".admin-dialog")===null');assert.equal(state.operators[1].role,'viewer');
      await browser('click','.operator-list .operator-row:nth-child(2) .danger');await confirm();await until('document.querySelector(".admin-dialog")===null');assert.equal(state.operators[1].enabled,false);
      assert.equal(await inspect('document.querySelectorAll(".operator-list .operator-row:nth-child(2) button").length'),0);
    });
    await t.test('pending target accepts once, expired invitations cannot be accepted and stale errors stay bounded',async()=>{
      reset();state.authorized=false;state.subjectId='target';state.invitations=[{...invitation(),expiresAt:old}];await open(origin);await until('Boolean(document.querySelector(".pending-invitation"))');assert.equal(await inspect('document.querySelector(".pending-invitation button").disabled'),true);assert.equal(state.writes.length,0);
      state.invitations[0].expiresAt=future;await click('초대 새로고침');await until('document.querySelector(".pending-invitation button")?.disabled===false');state.forceError='invitation_expired';await click('초대 수락하고 시작하기');await until('document.body.textContent.includes("초대가 만료되었습니다")');
      state.forceError='invitation_not_found';await click('초대 수락하고 시작하기');await until('document.body.textContent.includes("이 계정에 해당하는 초대를 찾을 수 없습니다")');state.forceError=null;
      await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('accept-mobile');await click('초대 수락하고 시작하기');await until('document.body.textContent.includes("조회 전용 권한입니다")');assert.equal(state.invitations[0].status,'accepted');assert.equal(await inspect('document.querySelector(".pending-invitation")===null'),true);assert.equal(state.writes.at(-1).csrf,'synthetic-before');
      assert.equal(await inspect('[...document.querySelectorAll("nav button")].some(button=>button.textContent.includes("운영자 관리"))'),false);await browser('reload');await until('document.body.textContent.includes("조회 전용 권한입니다")');assert.equal(state.writes.length,3);
    });
    await t.test('viewer has no mutations in members, servers, roster or Discord; operator cannot manage administrators',async()=>{
      reset();state.role='viewer';await open(origin);assert.equal(await inspect('[...document.querySelectorAll("nav button")].some(button=>button.textContent.includes("운영자 관리"))'),false);
      await click('회원 관리');await until('Boolean(document.querySelector(".member-summary"))');await browser('click','.member-summary');assert.equal(await inspect('document.querySelectorAll(".member-actions button").length'),1);assert.equal(await inspect('document.querySelector(".member-actions button").textContent'),'플레이 기록');
      await click('서버 관리');await until('Boolean(document.querySelector(".server-summary"))');await browser('click','.server-summary');assert.equal(await inspect('document.querySelectorAll(".server-expanded button").length'),0);
      await click('명부 동기화');assert.equal(await inspect('document.body.textContent.includes("새 명부 미리보기")'),false);
      await click('Discord 봇');await until('Boolean(document.querySelector(".discord-fields"))');assert.equal(await inspect('document.querySelector(".discord-fields").disabled'),true);assert.equal(await inspect('Boolean(document.querySelector(".discord-save,.discord-reconcile"))'),false);assert.equal(state.writes.length,0);
      state.role='operator';state.rows[0].administrator=true;await open(origin);await click('회원 관리');await until('Boolean(document.querySelector(".member-summary"))');await browser('click','.member-summary');assert.equal(await inspect('document.querySelectorAll(".member-actions button").length'),1);assert.equal(state.reads.includes('/v1/admin/operators'),false);
    });
    await t.test('live role loss removes open mutation dialogs and stale search cannot restore controls',async()=>{
      reset();await manage(origin);await search();await click('초대');await until('Boolean(document.querySelector(".admin-dialog"))');state.role='viewer';await browser('eval','window.dispatchEvent(new Event("focus"))');await until('document.querySelector(".admin-dialog")===null');assert.equal(await inspect('document.querySelector(".operators-view")===null'),true);
      reset();await manage(origin);state.holdSearch=true;await browser('fill','#operator-search','old');await browser('click','.operator-search .primary');assert.equal(typeof state.release,'function');await browser('fill','#operator-search','new');state.release();state.release=null;await browser('wait','--load','networkidle');assert.equal(await inspect('document.querySelectorAll(".operator-search-results .operator-row").length'),0);
      assert.equal(await inspect('localStorage.length+sessionStorage.length'),0);assert.equal(await browser('errors'),'');
    });
  }finally{state.release?.();await browser('close').catch(()=>{});await new Promise(resolve=>server.close(resolve));}
});
