/** Read/render QA against a separately started LOCAL server and disposable linenet_qa DB only.
 * Creates its own fixtures and removes exactly them in finally. Never point at the regular app.
 * QA_DATABASE_URL=postgresql://...@127.0.0.1:55439/linenet_qa QA_BASE_URL=http://localhost:3003 node scripts/qa-http.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';
const database = new URL(process.env.QA_DATABASE_URL || 'http://missing');
const base = new URL(process.env.QA_BASE_URL || 'http://missing');
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.pathname, '/linenet_qa');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname)); assert.equal(base.port,'3003');
const pool = new pg.Pool({connectionString: database.href});
const runId = randomUUID(); const users=[]; const clients=[]; const orders=[]; let checks=0;
const check = (name, value) => { assert.ok(value,name); checks++; console.log(`PASS ${name}`); };
async function page(path, cookie) { const res = await fetch(new URL(path,base), {headers: cookie ? {cookie} : {}, redirect:'manual'}); return {status:res.status, location:res.headers.get('location'), body:await res.text()}; }
async function login(id) {
 const res = await fetch(new URL('/api/auth/sign-in/email',base), {method:'POST',headers:{'Content-Type':'application/json',Origin:base.origin,'X-Forwarded-For':`198.18.0.${users.indexOf(id)+10}`},body:JSON.stringify({email:`${id}@qa.invalid`,password:runId})}); assert.equal(res.status,200,'fixture login');
 return res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
}
try {
 const hash=await hashPassword(runId);
 for (const role of ['admin','manager','executor','client']) {
  const id=`qa-http-${runId}-${role}`; users.push(id);
  await pool.query('insert into "user" (id,name,email,role) values ($1,$2,$3,$4)',[id,`QA ${role}`,`${id}@qa.invalid`,role]);
  await pool.query('insert into account (id,account_id,provider_id,user_id,password) values ($1,$2,$3,$4,$5)',[id,id,'credential',id,hash]);
 }
 const company=(await pool.query('insert into clients(name,email) values ($1,$2) returning id',['QA HTTP','company@qa.invalid'])).rows[0].id; clients.push(company);
 const otherCompany=(await pool.query('insert into clients(name) values ($1) returning id',['QA OTHER'])).rows[0].id; clients.push(otherCompany);
 const site=(await pool.query('insert into sites(client_id,name) values($1,$2) returning id',[company,'QA მისამართი'])).rows[0].id;
 await pool.query('update "user" set client_id=$1 where id=$2',[company,users[3]]);
 const own=(await pool.query("insert into orders(title,status,client_id,site_id,amount,paid_total,triaged) values($1,'assigned',$2,$3,100,4321.98,true) returning id,number",['QA საკუთარი შეკვეთა',company,site])).rows[0]; orders.push(own.id);
 const foreign=(await pool.query("insert into orders(title,status,client_id,triaged) values($1,'assigned',$2,true) returning id",['QA უცხო შეკვეთა',otherCompany])).rows[0]; orders.push(foreign.id);
 await pool.query('insert into order_assignees(order_id,user_id) values($1,$2)',[own.id,users[2]]);
 await pool.query('insert into order_requests(order_id,user_id,requested_by) values($1,$2,$2)',[foreign.id,users[2]]);
 await pool.query('insert into order_items(order_id,name,quantity,unit_price,created_by) values($1,$2,1,100,$3)',[own.id,'QA სერვისი',users[2]]);
 await pool.query('insert into order_materials(order_id,name,quantity,unit_cost,created_by) values($1,$2,1,76543.21,$3)',[own.id,'QA მასალა',users[2]]);
 await pool.query("insert into order_payments(order_id,amount,method,note,created_by) values($1,4321.98,'transfer','QA_SECRET_PAYMENT',$2)",[own.id,users[0]]);
 const cookies=[]; for (const id of users) cookies.push(await login(id));
 check('anonymous order redirects to login',(await page(`/orders/${own.id}`)).location?.startsWith('/login'));
 for(const path of ['/', '/orders','/inbox','/settings/company',`/clients/${company}`,`/orders/${own.id}`,`/orders/${own.id}/edit`,`/orders/${own.id}/invoice`,`/orders/${own.id}/mail-preview?kind=completed`]) {
  const p=await page(path,cookies[0]); check(`admin ${path} renders`,p.status===200 && !p.body.includes('NEXT_HTTP_ERROR_FALLBACK;500'));
 }
 for(const path of ['/my','/my/board',`/orders/${own.id}`]) {
  const p=await page(path,cookies[2]); check(`executor ${path} renders`,p.status===200); check(`executor ${path} does not receive receipt or cost`,!p.body.includes('QA_SECRET_PAYMENT')&&!p.body.includes('76543.21')&&!p.body.includes('4321.98'));
 }
 check('executor sees colleague order on safe board',(await page('/my/board',cookies[2])).body.includes('QA უცხო შეკვეთა'));
 const denied=await page(`/orders/${foreign.id}`,cookies[2]); check('executor cannot open colleague detail',(denied.status===404 || denied.body.includes('NEXT_HTTP_ERROR_FALLBACK;404')) && !denied.body.includes('QA უცხო შეკვეთა'));
 check('executor cannot open invoice',(await page(`/orders/${own.id}/invoice`,cookies[2])).status===307);
 const adminOnly=await page('/settings/company',cookies[1]); check('manager cannot open admin settings',(adminOnly.status===307 || adminOnly.body.includes('NEXT_REDIRECT')) && !adminOnly.body.includes('name="company_name"')); 
 for(const path of ['/portal','/portal/sites']) check(`client ${path} renders`,(await page(path,cookies[3])).status===200);
 const portal=await page('/portal',cookies[3]); check('client sees incident number',portal.body.includes(own.number)); check('client cannot see another company order',!portal.body.includes('QA უცხო შეკვეთა')); const clientDenied=await page(`/orders/${own.id}`,cookies[3]); check('client cannot open internal order',(clientDenied.status===404 || clientDenied.body.includes('NEXT_HTTP_ERROR_FALLBACK;404')) && !clientDenied.body.includes('QA სერვისი'));
 const signup=await fetch(new URL('/api/auth/sign-up/email',base),{method:'POST',headers:{'Content-Type':'application/json',Origin:base.origin,'X-Forwarded-For':'198.18.0.20'},body:JSON.stringify({name:'Uninvited',email:`uninvited-${runId}@qa.invalid`,password:runId})}); check('public signup cannot grant executor access',signup.status===400||signup.status===403);
 console.log(`HTTP QA: ${checks} checks passed; browser layout/interactions not covered.`);
} finally {
 if(orders.length) await pool.query('delete from orders where id=any($1::int[])',[orders]);
 if(clients.length) await pool.query('delete from clients where id=any($1::int[])',[clients]);
 if(users.length) await pool.query('delete from "user" where id=any($1::text[])',[users]);
 await pool.end();
}
