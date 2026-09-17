/**
 * End-to-end check of the main flow, driven through a real browser.
 *
 *   npm run e2e                      (expects `npm run dev` on :3000)
 *   BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... EXEC_EMAIL=... EXEC_PASSWORD=... npm run e2e
 *
 * It creates one order, assigns it, completes it as the technician, closes and pays it
 * as the manager, then deletes it again. It never touches other rows.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "admin@line-net.ge", password: process.env.ADMIN_PASSWORD ?? "admin1234" };
const EXEC = { email: process.env.EXEC_EMAIL ?? "giorgi@line-net.ge", password: process.env.EXEC_PASSWORD ?? "user1234" };
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CDP_PORT ?? 9350);
const HEADLESS = process.env.HEADED !== "1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
let failures = 0;

async function signIn({ email, password }) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1) };
  });
}

const profile = mkdtempSync(join(tmpdir(), "linenet-e2e-"));
const chrome = spawn(CHROME, [HEADLESS ? "--headless=new" : "", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1440,1000", "--no-first-run", "--disable-gpu", "about:blank"].filter(Boolean), { stdio: "ignore" });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

async function connect() {
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      target = list.find((t) => t.type === "page");
      if (target) break;
    } catch {}
    await sleep(250);
  }
  if (!target) throw new Error("Chrome did not start");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") consoleErrors.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
  };
  await send("Network.enable");
  await send("Page.enable");
  await send("Runtime.enable");
}

async function useSession(who) {
  const cookies = await signIn(who);
  await send("Network.clearBrowserCookies");
  for (const c of cookies) await send("Network.setCookie", { ...c, url: BASE, domain: new URL(BASE).hostname, path: "/" });
}

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.result?.value;
};

async function waitFor(condition, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evalJs(`!!(${condition})`)) return true;
    await sleep(200);
  }
  throw new Error(`timeout: ${condition.slice(0, 70)}`);
}

/** Headings and buttons render in Mtavruli; compare on a normalised (Mkhedruli) copy. */
const NORM = `(s => String(s).replace(/[\u1C90-\u1CBA]/g, c => String.fromCodePoint(c.codePointAt(0) - 0xBC0)))`;
const hasText = (t) => `${NORM}(document.body.innerText).includes(${JSON.stringify(t)})`;

async function goto(path) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(1500);
  await waitFor("document.readyState === 'complete'");
  await sleep(300);
}

const FIND = `(function(sel, text, within){const n = ${NORM}; const root = within ? [...document.querySelectorAll('article,tr,li,section,div')].find(e => e.innerText && n(e.innerText).includes(within) && e.querySelector(sel)) : document; if(!root) return null; const els=[...root.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && (!text || n(e.innerText||e.value||e.getAttribute('aria-label')||'').includes(text));}); return els[0] ?? null;})`;

async function click(sel, text, within) {
  const at = await evalJs(`(()=>{const el=${FIND}(${JSON.stringify(sel)},${JSON.stringify(text ?? "")},${JSON.stringify(within ?? "")}); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!at) throw new Error(`not found: ${sel} "${text ?? ""}"`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
  await sleep(400);
}

async function fill(sel, value) {
  const ok = await evalJs(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return false; el.focus(); const proto = el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true;})()`);
  if (!ok) throw new Error(`no field ${sel}`);
}

async function selectByText(sel, text) {
  const v = await evalJs(`(()=>{const n=${NORM}; const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const o=[...el.options].find(o=>n(o.textContent).includes(${JSON.stringify(text)})); return o?o.value:null;})()`);
  if (v === null) throw new Error(`no option "${text}" in ${sel}`);
  await fill(sel, v);
}

async function step(name, fn) {
  try {
    await fn();
    log.push(`  ok    ${name}`);
  } catch (e) {
    failures++;
    log.push(`  FAIL  ${name} — ${String(e.message).slice(0, 120)}`);
  }
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());
const TITLE = `E2E ${new Date().toISOString().slice(0, 16)}`;
let orderHref = null;

try {
  await connect();
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await useSession(ADMIN);
  await step("manager: dashboard loads", async () => { await goto("/"); await waitFor(hasText("მოქმედება სჭირდება")); });
  await step("manager: quick create with a system", async () => {
    await click("button", "ახალი შეკვეთა");
    await waitFor("document.querySelector('#qc-title')");
    await fill("#qc-title", TITLE);
    await fill("#qc-system", "cctv");
    await fill("#qc-priority", "urgent");
    await fill("#qc-due", today);
    await click("button", "შეკვეთის შექმნა");
    await waitFor(hasText("დაემატა"));
  });
  await step("manager: assign with time from the dispatch queue", async () => {
    await goto("/schedule");
    await waitFor(hasText(TITLE));
    await click("button", "დანიშვნა", TITLE);
    await waitFor("document.querySelector('select[id^=as-who-]')");
    const who = await evalJs(`document.querySelector('select[id^=as-who-]').id`);
    await selectByText(`#${who}`, "გიორგი");
    const time = await evalJs(`document.querySelector('input[id^=as-time-]').id`);
    await fill(`#${time}`, "14:00");
    await click("button[type=submit]", "დანიშვნა");
    await waitFor(hasText("დანიშნულია"));
  });
  await step("manager: the job shows on the schedule", async () => { await goto("/schedule"); await waitFor(hasText("14:00")); });
  await step("manager: checklist came from the template", async () => {
    await goto("/orders");
    await click("a", TITLE);
    await waitFor(hasText("ჩეკ-ლისტი"));
    orderHref = await evalJs("location.pathname");
    const items = await evalJs("document.querySelectorAll('input[type=checkbox]').length");
    if (items < 2) throw new Error(`checklist items: ${items}`);
  });

  await useSession(EXEC);
  await step("technician: sees the job", async () => { await goto("/my"); await waitFor(hasText(TITLE)); });
  await step("technician: ticks the checklist", async () => {
    await goto(orderHref);
    const boxes = await evalJs("[...document.querySelectorAll('input[type=checkbox]')].filter(b=>!b.checked && !b.closest('form')).length");
    for (let i = 0; i < boxes; i++) { await click("input[type=checkbox]:not(:checked)"); await sleep(900); }
  });
  await step("technician: hands the work over", async () => {
    await goto(orderHref);
    await click("button", "სამუშაო შესრულებულია");
    await waitFor("document.querySelector('textarea[aria-label]')");
    await fill("textarea[aria-label='შესრულებული სამუშაოს აღწერა']", "ავტომატური ტესტი: სამუშაო შესრულებულია.");
    await click("button[type=submit]", "ჩაბარება");
    await waitFor(hasText("ჩაბარებულია"));
  });

  await useSession(ADMIN);
  await step("manager: verifies and closes", async () => {
    await goto(orderHref);
    await click("button", "შემოწმებულია, დახურვა");
    await sleep(1500);
    await goto(orderHref);
    await waitFor(hasText("დახურული"));
  });
  await step("manager: records a payment", async () => {
    await fill("input[name=amount]", "150");
    await click("button[type=submit]", "გადახდა");
    await waitFor(hasText("გადახდა დაფიქსირდა"));
  });
  await step("manager: removes the test order", async () => {
    await goto(orderHref);
    await click("button", "წაშლა");
    await waitFor(hasText("შეკვეთის წაშლა"));
    await click("button", "დადასტურება");
    await sleep(2000);
    await goto("/orders");
    if (await evalJs(hasText(TITLE))) throw new Error("the order is still listed");
  });
} catch (e) {
  failures++;
  log.push(`  FAIL  harness — ${e.message}`);
} finally {
  console.log(`\ne2e against ${BASE}\n${log.join("\n")}`);
  if (consoleErrors.length) console.log(`\nconsole errors:\n  ${consoleErrors.slice(0, 5).join("\n  ")}`);
  console.log(failures === 0 ? "\nall steps passed" : `\n${failures} step(s) failed`);
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(400); // Chrome still holds its profile for a moment
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  process.exit(failures === 0 ? 0 : 1);
}
