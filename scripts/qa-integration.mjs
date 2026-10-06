/** Disposable local PostgreSQL only. No .env files are loaded, no production URL is used. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { execFileSync, spawnSync } from 'node:child_process';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const dir=mkdtempSync(join(tmpdir(),'linenet-qa-')); const data=join(dir,'data');
const socket=createServer(); await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve)); const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
let running=false;
try {
 execFileSync('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'start'],{stdio:'pipe'}); running=true;
 const base=`postgresql://${encodeURIComponent(userInfo().username)}@127.0.0.1:${port}/`;
 const admin=new pg.Client({connectionString:base+'postgres'}); await admin.connect(); try { await admin.query('CREATE DATABASE linenet_qa'); } finally { await admin.end(); }
 const url=base+'linenet_qa'; const pool=new pg.Pool({connectionString:url});
 try { await migrate(drizzle(pool),{migrationsFolder:'db/migrations'}); } finally { await pool.end(); }
 const targets = process.argv.length > 2 ? process.argv.slice(2) : ['tests/integration'];
 const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...targets],{stdio:'inherit',env:{...process.env,QA_DATABASE_URL:url,INTERNAL_CRON:'0',CLIENT_MAIL_DRY_RUN:'1',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:''}});
 if(result.error) throw result.error; process.exitCode=result.status ?? 1;
} finally {
 if(running) execFileSync('pg_ctl',['-D',data,'-m','fast','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
