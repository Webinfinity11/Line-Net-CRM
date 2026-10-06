/** Additive, idempotent workflow demo. No mail, notifications, users or existing-row updates.
 * node --env-file=.env.local scripts/seed-workflow-demo.mjs          # inspect plan
 * node --env-file=.env.local scripts/seed-workflow-demo.mjs --apply  # explicitly authorized insert
 */
import pg from 'pg';
const marker='workflow-demo-2026-09-24-v1';
const scenarios=[
 ['ქსელის გათიშვა — ოფისი',0,'new','urgent','email',false],
 ['კამერების დამატების მოთხოვნა',1,'new','high','portal',false],
 ['სახანძრო პანელის დიაგნოსტიკა',2,'new','high','manual',true],
 ['Wi-Fi წერტილების მონტაჟი',0,'assigned','normal','manual',true],
 ['კამერების პროფილაქტიკა',1,'assigned','normal','portal',true],
 ['კარის კონტროლერის შეცვლა',2,'in_progress','high','manual',true],
 ['ქსელის გაყვანა — გუნდური სამუშაო',0,'in_progress','normal','manual',true],
 ['ჩამწერის კონფიგურაცია — შესამოწმებელი',1,'done','normal','email',true],
 ['სახანძრო დეტექტორების შეცვლა',2,'done','high','manual',true],
 ['ქსელის აღდგენა — ნაწილობრივ გადახდილი',0,'closed','normal','manual',true],
 ['ვიდეომეთვალყურეობის გამართვა — გადახდილი',1,'closed','normal','portal',true],
 ['დამატებითი წერტილის გაუქმებული მოთხოვნა',2,'cancelled','low','manual',true],
];
if(!process.argv.includes('--apply')) { console.log(JSON.stringify({marker,clients:3,sites:3,orders:scenarios.map(([title,,status,priority,source])=>({title:`[დემო] ${title}`,status,priority,source})),mail:false,existingRowsChanged:false},null,2)); process.exit(0); }
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const at=hours=>new Date(Date.now()+hours*3600000);
async function insert(table,values){const keys=Object.keys(values);return (await db.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(values))).rows[0];}
try{
 await db.query('begin'); await db.query("select pg_advisory_xact_lock(hashtext($1))",[marker]);
 const existing=(await db.query('select id from clients where notes=$1',[marker])).rows;
 if(existing.length){const rows=(await db.query('select number,title,status from orders where client_id=any($1::int[]) order by id',[existing.map(c=>c.id)])).rows; if(existing.length!==3||rows.length!==12) throw new Error('Partial demo set exists; review it before adding anything'); await db.query('rollback'); console.log(JSON.stringify({alreadyExists:true,orders:rows},null,2));}
 else{
 const staff=(await db.query(`select id,name from "user" where role in ('admin','manager') and banned=false order by case when role='manager' then 0 else 1 end,id`)).rows;
 const execs=(await db.query(`select id,name from "user" where role='executor' and banned=false order by id`)).rows;
 if(!staff.length||execs.length<2) throw new Error('Demo requires a manager/admin and two active executors');
 const manager=staff[0].id,team=execs.slice(0,2); const companies=[]; const sites=[];
 for(const [i,name] of ['სივრცე ოფისი','პანორამა მარკეტი','ვექტორი ცენტრი'].entries()){
  const company=await insert('clients',{name:`[დემო] ${name}`,email:`office${i+1}@workflow-demo.invalid`,contact_name:'სატესტო საკონტაქტო პირი',notes:marker}); companies.push(company);
  const site=await insert('sites',{client_id:company.id,name:`[დემო] ${['ვაკის ოფისი','საბურთალოს ფილიალი','დიღმის ობიექტი'][i]}`,address:['თბილისი, ვაკე — სატესტო მისამართი','თბილისი, საბურთალო — სატესტო მისამართი','თბილისი, დიღომი — სატესტო მისამართი'][i],notes:marker}); sites.push(site);
  await insert('site_contacts',{site_id:site.id,name:'დემო კოორდინატორი',position:'ობიექტის პასუხისმგებელი',email:`site${i+1}@workflow-demo.invalid`,receives_email:false});
 }
 const result=[];
 for(const [index,[title,ci,status,priority,source,triaged]] of scenarios.entries()){
  const working=['in_progress','done','closed'].includes(status),finished=['done','closed'].includes(status),assigned=['assigned','in_progress','done','closed'].includes(status),closed=status==='closed';
  const members=index===6?team:[team[index%2]];
  const note=finished?members.map(u=>`${u.name}: [დემო] მოწყობილობა გამართულია, შემოწმება დასრულდა.`).join('\n'):null;
  const amount=triaged&&status!=='cancelled'?354:null; const paid=index===9?150:index===10?354:0;
  const scheduled=assigned?at(working?-5:24+index):null;
  const o=await insert('orders',{title:`[დემო] ${title}`,description:`${marker}\nგამოგონილი სასწავლო სცენარი: კლიენტმა მოითხოვა ${title}. ჩანაწერი არ წარმოადგენს რეალურ მოთხოვნას ან ფინანსურ ოპერაციას.`,client_id:companies[ci].id,site_id:sites[ci].id,address:sites[ci].address,status,priority,source,triaged,manager_id:triaged?manager:null,manager_at:triaged?at(-24):null,created_by:source==='manual'?manager:null,created_at:at(-48),updated_at:at(-1),scheduled_at:scheduled,planned_minutes:assigned?90:null,arrived_at:working?at(-4):null,finished_at:finished?at(-2):null,completed_at:finished?at(-2):null,closed_at:closed?at(-1):null,verified_by:closed?manager:null,verified_at:closed?at(-1):null,completion_note:note,amount,vat_percent:amount?18:0,paid_total:paid,payment_status:paid===354?'paid':paid?'partial':'unpaid',paid_at:paid?at(-0.5):null,email_from:source==='email'?`დემო კლიენტი <sender${ci}@workflow-demo.invalid>`:null,email_subject:source==='email'?`[დემო] ${title}`:null,email_message_id:source==='email'?`<${marker}-${index}@workflow-demo.invalid>`:null,email_received_at:source==='email'?at(-48):null});
  const event=async(type,data,time=-1)=>insert('order_events',{order_id:o.id,user_id:manager,type,data:JSON.stringify(data),created_at:at(time)});
  await event(source==='email'?'created_from_email':'created',{demo:true,source},-48);
  if(triaged) await event('manager_changed',{from:null,to:manager,demo:true},-24);
  if(amount) await insert('order_items',{order_id:o.id,name:'[დემო] დიაგნოსტიკა და გამართვა',unit:'საათი',quantity:2.5,unit_price:120,created_by:manager});
  if(assigned){
   await event('assigned',{added:members.map(u=>u.id),demo:true},-20);
   for(const [mi,u] of members.entries()){
    const done=finished||(index===6&&mi===0);
    await insert('order_assignees',{order_id:o.id,user_id:u.id,assigned_by:manager,assigned_at:at(-20),seen_at:working?at(-6):null,done_at:done?at(-2):null,done_note:done?'[დემო] ჩემი სამუშაო დასრულებულია':null});
    if(working) await insert('order_visits',{order_id:o.id,user_id:u.id,started_at:at(-4),ended_at:done?at(-2):null,note:'[დემო] დიაგნოსტიკა და მოწყობილობის გამართვა'});
   }
  }
  if(index===2||index===5) await insert('order_requests',{order_id:o.id,user_id:team[0].id,requested_by:index===5?members[0].id:team[0].id,note:'[დემო] მზად ვარ კოლეგას დავეხმარო დიაგნოსტიკაში',status:'pending'});
  if(finished) await event('status_changed',{from:'in_progress',to:'done',demo:true},-2);
  if(closed) await event('status_changed',{from:'done',to:'closed',demo:true},-1);
  if(paid) {await insert('order_payments',{order_id:o.id,amount:paid,method:'transfer',note:'[დემო] სიმულირებული გადახდა — რეალური ტრანზაქცია არ არის',created_by:manager,paid_at:at(-0.5)});await event('payment_added',{amount:paid,demo:true},-0.5);}
  await event('client_email',{kind:closed?'completed':assigned?'scheduled':'received',to:[],ok:false,skipped:'დემო სცენარი — გაგზავნა არ შესრულებულა'});
  result.push({number:o.number,title:o.title,status:o.status});
 }
 await db.query('commit');console.log(JSON.stringify({marker,clients:3,sites:3,orders:result,mailSent:false},null,2));
 }
}catch(error){await db.query('rollback');throw error;}finally{await db.end();}
