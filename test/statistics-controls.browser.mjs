import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile),dist=fileURLToPath(new URL('../dist/',import.meta.url)),session=`passport-stats-controls-${process.pid}`;
const counters={playSeconds:7320,blocksBroken:12,blocksPlaced:4,damageTakenMilli:125500,deaths:2,mobKills:4,playerKills:1,distanceCm:456700};
const future=new Date(Date.now()+86400000).toISOString();
const subjectId='00000000-0000-4000-8000-000000000001';
const serverRecord=(id,label,statisticsEnabled)=>({id,label,statisticsEnabled,enabled:true,sensitive:false,accessMode:'members',allowedSubjectIds:[],updatedAt:'2026-10-02T00:00:00.000Z',createdAt:'2026-10-01T00:00:00.000Z',online:true,proxyAvailable:true,paperSeenAt:future});
let state;
const reset=()=>{state={role:'owner',servers:[serverRecord('lobby','합성 로비',false),serverRecord('survival','합성 야생',true)],writes:[],previews:[],revision:1,resetError:null,serverError:null,cleared:false};};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1'),p=url.pathname;
 const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const body=async()=>{let value='';for await(const part of req)value+=part;return value?JSON.parse(value):{};};
 if(p==='/v1/auth/session')return json(200,{authenticated:true,csrfToken:'synthetic-csrf',authMode:'university'});
 if(p==='/v1/admin/session')return json(200,{authenticated:true,schoolVerified:true,subjectId:'owner',displayName:'합성 운영자',enrolled:true,enrollmentPending:false,bootstrapAvailable:false,mfaRequired:false,authorized:true,role:state.role,permissions:{read:true,write:state.role!=='viewer',manageOperators:state.role==='owner'},mfaVerified:false,mfaVerifiedUntil:null});
 if(p==='/v1/admin/overview')return json(200,{subjects:1,linked:1,suspended:0,snapshot:null,sync:{enabled:false,running:false,lastSuccessAt:null,lastError:null},servers:state.servers});
 if(p==='/v1/admin/servers')return json(200,{servers:state.servers});
 if(p.startsWith('/v1/admin/servers/')&&req.method==='PUT'){const input=await body();state.writes.push({p,input,csrf:req.headers['x-csrf-token']});if(state.serverError)return json(409,{code:state.serverError});const item=state.servers.find(s=>p.endsWith(s.id));if(input.expectedUpdatedAt!==item.updatedAt)return json(409,{code:'server_changed'});Object.assign(item,input,{updatedAt:future});return json(200,{updated:true});}
 if(p==='/v1/admin/members')return json(200,{members:[{id:subjectId,revision:'1',createdAt:future,administrator:false,studentId:'20991234',displayName:'합성 회원',department:'가상 학과',membershipStatus:'active',roleLabel:'회원',verifiedUntil:future,universityVerifiedUntil:future,allowedServerIds:['lobby','survival'],eligibleServerIds:['lobby','survival'],accessSuspended:false,scopeRestricted:false,scopeLimit:[],discordId:null,discordConnection:null,minecraft:{uuid:subjectId,name:'SyntheticPlayer'}}],total:1,nextCursor:null});
 if(p==='/v1/admin/stats/reset/preview'){const input=await body();state.previews.push(input);return json(200,{...input,affectedSubjects:1,rows:state.cleared?0:2,totals:counters,expectedRevision:`revision-${state.revision}`,confirmation:'통계 초기화'});}
 if(p==='/v1/admin/stats/reset'){const input=await body();state.writes.push({p,input,csrf:req.headers['x-csrf-token']});if(state.resetError)return json(409,{code:state.resetError});if(input.expectedRevision!==`revision-${state.revision}`)return json(409,{code:'statistics_reset_changed'});state.cleared=true;state.revision++;return json(200,{reset:true,affectedSubjects:1,rows:2});}
 if(p==='/v1/admin/stats'||p===`/v1/admin/members/${subjectId}/stats`){const totals=state.cleared?Object.fromEntries(Object.keys(counters).map(k=>[k,0])):counters;return json(200,{available:true,totals,servers:state.servers.map(s=>({serverId:s.id,label:s.label,collectionEnabled:s.statisticsEnabled,...totals,onlinePlayerCount:s.id==='lobby'?1:0})),collection:{enabled:p==='/v1/admin/stats'?null:false,effective:p==='/v1/admin/stats'?null:false,consentGranted:p==='/v1/admin/stats'?null:true,excludedServerIds:state.servers.filter(s=>!s.statisticsEnabled).map(s=>s.id),historyRetained:true},playerCount:1,onlinePlayerCount:1});}
 const requested=path.resolve(dist,`.${p==='/'?'/index.html':p}`);if(!requested.startsWith(dist))return json(404,{});
 try{const data=await readFile(requested);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(requested)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'"});res.end(data);}catch{json(404,{});}
});
const browser=async(...args)=>(await run(process.env.PASSPORT_AGENT_BROWSER||'npx',[...(process.env.PASSPORT_AGENT_BROWSER?[]:['--yes','agent-browser@0.38.1']),'--session',session,...args],{timeout:30000,maxBuffer:1e6})).stdout.trim();
const inspect=async expr=>{let value=JSON.parse(await browser('eval',`JSON.stringify(${expr})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const until=async expr=>{for(let n=0;n<20;n++){if(await inspect(expr))return;await new Promise(r=>setTimeout(r,250));}assert.fail(expr);};
const click=name=>browser('find','role','button','click','--name',name,'--exact');
const open=async origin=>{await browser('open','about:blank');await browser('open',origin);await browser('wait','--load','networkidle');};
const stats=async origin=>{await open(origin);await click('플레이 통계');await until('document.querySelectorAll(".stats-metric").length===8');};
const confirm=async()=>{await browser('fill','#statistics-reset-confirmation','통계 초기화');await browser('find','role','checkbox','check','--name','초기화 범위와 삭제할 기록을 확인했습니다.');await click('기록 초기화');};
test('statistics collection and reset controls respect scope, retained history, revisions and roles',{timeout:300000},async t=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  await t.test('server toggle displays lobby OFF, confirms collection impact, sends revision and preserves stored history',async()=>{
   reset();await open(origin);await click('서버 관리');await until('document.querySelectorAll(".server-summary").length===2');await browser('click','.server-summary');assert.equal(await inspect('document.querySelector(".server-expanded").textContent.includes("꺼짐 · 합계 제외")'),true);await click('접근 및 설정');await until('Boolean(document.querySelector(".server-statistics-setting"))');assert.equal(await inspect('document.querySelector(".server-statistics-setting input").checked'),false);
   await browser('find','role','checkbox','check','--name','이 서버 통계 수집');await browser('set','viewport','1440','900');await browser('screenshot','/tmp/passport-statistics-server-settings-desktop.png');
   state.serverError='server_changed';await click('설정 저장');await until('document.body.textContent.includes("다른 곳에서 서버 설정이 변경되었습니다")');assert.equal(state.servers[0].statisticsEnabled,false);state.serverError=null;await click('설정 저장');await until('document.querySelector(".admin-dialog")===null');assert.equal(state.servers[0].statisticsEnabled,true);assert.equal(state.writes.at(-1).input.expectedUpdatedAt,'2026-10-02T00:00:00.000Z');assert.equal(state.writes.at(-1).csrf,'synthetic-csrf');assert.equal(state.cleared,false);
  });
  await t.test('excluded server hides counters; server reset preview includes retained data and rejects stale generation',async()=>{
   reset();await stats(origin);assert.equal(await inspect('document.querySelectorAll(".metric-icon").length'),8);await browser('select','.stats-scope select','lobby');assert.equal(await inspect('document.querySelectorAll(".stats-metric").length'),0);assert.equal(await inspect('document.querySelector(".stats-disabled").textContent.includes("기존 기록은 보관")'),true);
   await click('이 서버 통계 초기화');await until('Boolean(document.querySelector("#statistics-reset-confirmation"))');assert.deepEqual(state.previews.at(-1),{scope:'server',serverId:'lobby'});assert.equal(await inspect('document.querySelector(".dialog-actions .primary").disabled'),true);assert.equal(state.writes.length,0);assert.equal(await inspect('document.querySelector(".stats-reset-target").textContent.includes("합성 로비")'),true);
   await browser('set','viewport','390','844');assert.equal(await inspect('document.documentElement.scrollWidth<=innerWidth'),true);await browser('screenshot','/tmp/passport-statistics-reset-mobile.png','--full');
   state.revision++;await confirm();await until('document.body.textContent.includes("초기화 대상의 연결 또는 기록 상태가 변경되었습니다")');assert.equal(await inspect('document.querySelector("#statistics-reset-confirmation")===null'),true);assert.equal(state.cleared,false);await click('영향 다시 확인');await until('Boolean(document.querySelector("#statistics-reset-confirmation"))');assert.equal(await inspect('document.querySelector("#statistics-reset-confirmation").value'),'');assert.equal(await inspect('document.querySelector(".admin-dialog input[type=checkbox]").checked'),false);await confirm();await until('document.querySelector(".admin-dialog")===null');assert.equal(state.cleared,true);assert.deepEqual(state.writes.at(-1).input,{scope:'server',serverId:'lobby',expectedRevision:'revision-2',confirmation:'통계 초기화'});
  });
  await t.test('all and personal reset scope is explicit and cancel never changes records',async()=>{
   reset();await stats(origin);await click('전체 통계 초기화');await until('Boolean(document.querySelector("#statistics-reset-confirmation"))');assert.deepEqual(state.previews.at(-1),{scope:'all'});await browser('press','Escape');await until('document.querySelector(".admin-dialog")===null');assert.equal(state.writes.length,0);
   await click('회원 관리');await until('Boolean(document.querySelector(".member-summary"))');await browser('click','.member-summary');await click('플레이 기록');await until('document.querySelectorAll(".member-stats .stats-metric").length===8');await browser('select','.member-stats .stats-scope select','survival');await click('이 회원 전체 통계 초기화');await until('Boolean(document.querySelector("#statistics-reset-confirmation"))');assert.deepEqual(state.previews.at(-1),{scope:'subject',subjectId});assert.equal(await inspect('document.querySelector(".stats-reset-target").textContent.includes("이 회원의 모든 서버 기록")'),true);await click('취소');assert.equal(state.writes.length,0);
  });
  await t.test('viewer cannot toggle or reset and a live role downgrade closes pending reset',async()=>{
   reset();state.role='viewer';await stats(origin);assert.equal(await inspect('document.querySelector(".stats-reset-actions")===null'),true);await click('서버 관리');await until('Boolean(document.querySelector(".server-summary"))');await browser('click','.server-summary');assert.equal(await inspect('document.querySelector(".server-expanded button")===null'),true);assert.equal(state.writes.length,0);
   reset();await stats(origin);await click('전체 통계 초기화');await until('Boolean(document.querySelector("#statistics-reset-confirmation"))');state.role='viewer';await browser('eval','window.dispatchEvent(new Event("focus"))');await until('document.querySelector(".admin-dialog")===null');assert.equal(await inspect('document.querySelector(".stats-reset-actions")===null'),true);assert.equal(state.writes.length,0);assert.equal(await inspect('localStorage.length+sessionStorage.length'),0);assert.equal(await browser('errors'),'');
  });
 }finally{await browser('close').catch(()=>{});await new Promise(r=>server.close(r));}
});
