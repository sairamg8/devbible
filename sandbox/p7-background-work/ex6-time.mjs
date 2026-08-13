import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';

// ---------- timeout budgets ----------
const slow = http.createServer((req, res) => setTimeout(() => res.end('slow'), 5000));
await new Promise((r) => slow.listen(0, r));
const slowUrl = `http://127.0.0.1:${slow.address().port}/`;

let t = performance.now();
try { await fetch(slowUrl); } catch (e) { console.log('no timeout: still waiting…'); }
console.log('--- with AbortSignal.timeout(300) ---');
t = performance.now();
try { await fetch(slowUrl, {signal: AbortSignal.timeout(300)}); }
catch (e) { console.log(`aborted after ${Math.round(performance.now()-t)} ms:`, e.name, '|', e.message); }

// budget shrinking as it propagates
class Budget {
  constructor(ms) { this.deadline = Date.now() + ms; }
  get remaining() { return Math.max(0, this.deadline - Date.now()); }
  signal() { return AbortSignal.timeout(this.remaining); }
}
const budget = new Budget(500);
console.log('budget starts at', budget.remaining, 'ms');
await delay(200);
console.log('after a 200 ms step, downstream gets', budget.remaining, 'ms');
t = performance.now();
try { await fetch(slowUrl, {signal: budget.signal()}); }
catch (e) { console.log(`second call aborted after ${Math.round(performance.now()-t)} ms (not a fresh 500)`); }

// one signal cancels everything it started
const ac = new AbortController();
const child = async (name) => {
  try { await delay(2000, null, {signal: ac.signal}); return `${name} finished`; }
  catch { return `${name} cancelled`; }
};
const all = Promise.all([child('db'), child('cache'), child('webhook')]);
setTimeout(() => ac.abort(new Error('client disconnected')), 100);
console.log('deadline propagation ->', await all);
console.log('abort reason:', ac.signal.reason.message);
slow.close();

// ---------- scheduled job drift ----------
const ticks = [];
const start = Date.now();
await new Promise((resolve) => {
  const id = setInterval(() => {
    const t0 = Date.now();
    while (Date.now() - t0 < 30) {}          // job takes 30 ms
    ticks.push(Date.now() - start);
    if (ticks.length === 8) { clearInterval(id); resolve(); }
  }, 100);
});
console.log('setInterval(100) with a 30 ms job ->', ticks.join(', '));
console.log(`8 ticks should end at 800 ms; ended at ${ticks.at(-1)} ms — drift ${ticks.at(-1) - 800} ms`);

// ---------- time on the server ----------
process.env.TZ = 'Asia/Kolkata';
const paidAt = new Date('2026-08-10T18:45:00Z');
console.log('stored (UTC):', paidAt.toISOString());
console.log('server-local toString():', paidAt.toString());
console.log('naive "date" via toISOString().slice(0,10):', paidAt.toISOString().slice(0, 10),
            '| what the user in IST sees:', new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata'}).format(paidAt),
            '<- a whole day apart');
const trialStart = new Date('2026-03-07T12:00:00Z');
const plus7ms = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
console.log('trial +7 days by arithmetic:', new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', dateStyle:'short', timeStyle:'short'}).format(plus7ms),
            '<- DST moved the wall-clock hour');
console.log('midnight "end of day" for a user in Asia/Kolkata, in UTC:',
  new Date(Date.UTC(2026, 7, 11, 0, 0) - 5.5 * 3600 * 1000).toISOString());
process.exit(0);
