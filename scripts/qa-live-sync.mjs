/** Browser QA against the local sync demo only. Requires its four seeded accounts.
 * QA_DATABASE_URL=postgresql://...@127.0.0.1:5432/linenet_sync_qa
 * PLAYWRIGHT_MODULE=/path/to/playwright node scripts/qa-live-sync.mjs
 * Never loads .env.local. Creates an order via the client UI and deletes that
 * exact test order on exit. Requires Chrome and Playwright (or PLAYWRIGHT_MODULE).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const database = new URL(process.env.QA_DATABASE_URL || 'http://missing');
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/linenet_sync_qa');
const pool = new pg.Pool({ connectionString: database.href });
let createdId;
let browser;const errors=[];let checks=0;const pass=n=>{checks++;console.log('PASS',n)};
async function waitText(page,text){await page.getByText(text,{exact:true}).filter({visible:true}).first().waitFor({timeout:15000})}
(async()=>{
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const pages={}; const contexts={}; const docs={}; const refreshes={};
 for(const role of ['manager','executor','client','admin']) {
  const context=await browser.newContext({baseURL:'http://localhost:3000',viewport:role==='executor'?{width:390,height:844}:{width:1440,height:1000}});contexts[role]=context;
  const r=await context.request.post('/api/auth/sign-in/email',{data:{email:`${role}@sync.local`,password:'SyncTest2026!'},headers:{Origin:'http://localhost:3000'}});assert.equal(r.status(),200);
  const page=await context.newPage();pages[role]=page;docs[role]=0;refreshes[role]=0;
  page.on('pageerror',e=>errors.push(`${role}: ${e.message}`));
  page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())docs[role]++;if(r.headers()['rsc']==='1')refreshes[role]++});
 }
 const {manager,executor,client,admin}=pages;
 await Promise.all([manager.goto('/inbox'),executor.goto('/my?tab=new'),client.goto('/portal/new'),admin.goto('/orders?status=all')]);
 await client.locator('#p-title').fill('სინქრონიზაციის ტესტი '+Date.now());
 const title=await client.locator('#p-title').inputValue();
 await client.locator('#p-desc').fill('პირველი პუნქტის ტესტი — ავტომატური განახლება');
 await client.locator('button[type=submit]').click();
 await client.waitForURL(/\/portal\?sent=/);
 const id=Number(new URL(client.url()).searchParams.get('sent'));
 assert.ok(id); createdId=id; console.log('ORDER',id,title);
 await waitText(manager,title);assert.equal(docs.manager,1);pass('client creation appears in an already-open manager inbox without document reload');
 const clientDocs=docs.client;
 await manager.goto(`/orders/${id}/edit`);
 await manager.getByRole('button',{name:/ტესტი შემსრულებელი/}).click();
 await manager.locator('button[type=submit]').click();
 await manager.waitForURL(`/orders/${id}`);
 await waitText(executor,title);assert.equal(docs.executor,1);pass('assignment appears in the already-open executor list');
 await waitText(admin,title);assert.equal(docs.admin,1);pass('triaged order appears in the already-open admin list');
 await waitText(client.locator('article').filter({hasText:title}),'ვიზიტის დრო ზუსტდება');assert.equal(docs.client,clientDocs);pass('client status changes after assignment without navigation');
 // Keep a partially completed client form open through an unrelated order change.
 const draft=await contexts.client.newPage();await draft.goto('/portal/new');await draft.locator('#p-title').fill('შეუნახავი ტექსტი');
 await executor.locator('article').filter({hasText:title}).getByRole('button',{name:'დაწყება'.toUpperCase(),exact:true}).click();
 await executor.waitForURL(/tab=active/);
 await manager.getByText('მიმდინარე',{exact:true}).first().waitFor({timeout:15000});
 await waitText(client.locator('article').filter({hasText:title}),'მიმდინარეობს');pass('executor starts work and manager + client update automatically');
 assert.equal(await draft.locator('#p-title').inputValue(),'შეუნახავი ტექსტი');pass('unsaved form input survives synchronization');
 // Direct writes model another app instance; no notification/revalidation hooks.
 await pool.query("update orders set status='done',completed_at=now() where id=$1",[id]);
 await manager.getByText('შესრულებული',{exact:true}).first().waitFor({timeout:15000});
 await waitText(client.locator('article').filter({hasText:title}),'შემოწმებას ელოდება');pass('status changes from another server are detected even without updated_at or notifications');
 // Fallback works with EventSource unavailable.
 const fallback=await contexts.executor.newPage();await fallback.addInitScript(()=>{delete window.EventSource});await fallback.goto('/my/board');
 const fallbackTitle=title+' — fallback';
 await pool.query('update orders set title=$1 where id=$2',[fallbackTitle,id]);
 await waitText(fallback,fallbackTitle);pass('short-poll fallback updates pages without EventSource');
 // Disconnect and catch up without manual reload.
 await contexts.client.setOffline(true);
 await pool.query("update orders set status='closed',closed_at=now() where id=$1",[id]);
 await contexts.client.setOffline(false);
 await waitText(client.locator('article').filter({hasText:title}),'დასრულებულია');assert.equal(docs.client,clientDocs);pass('reconnection catches a status change missed while offline');
 await client.screenshot({path:join(tmpdir(),'linenet-sync-client.png'),fullPage:true});
 await admin.screenshot({path:join(tmpdir(),'linenet-sync-admin.png'),fullPage:true});
 await executor.screenshot({path:join(tmpdir(),'linenet-sync-executor.png'),fullPage:true});
 assert.deepEqual(errors,[]);pass('no browser runtime errors');
 console.log('RESULT',JSON.stringify({checks,docs,refreshes,id,title:fallbackTitle}));
})().catch(async e=>{console.error(e);if(browser){for(const c of browser.contexts())for(const p of c.pages())console.log('FAILPAGE',p.url(),(await p.locator('body').innerText().catch(()=>'' )).slice(-2600))}process.exitCode=1}).finally(async()=>{await browser?.close();if(createdId)await pool.query('delete from orders where id=$1',[createdId]);await pool.end()});
