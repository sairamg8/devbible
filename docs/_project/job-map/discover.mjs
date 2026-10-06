// For each careers URL, render it and report which job-board / API hosts it talks to.
// Usage: node discover.mjs "Name|https://careers.url" ...
import { chromium } from 'playwright';
const KNOWN = /greenhouse|lever\.co|ashbyhq|smartrecruiters|workday|myworkdayjobs|keka|zohorecruit|zoho\.com\/recruit|freshteam|darwinbox|icims|taleo|successfactors|oraclecloud|eightfold|phenom|avature|jobvite|breezy|recruitee|workable|pinpoint|rippling|comeet|teamtailor|hirist|greythr|skillate|joinsuperset|careers-page/i;
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
for (const arg of process.argv.slice(2)) {
  const [name, url] = arg.split('|');
  const p = await b.newPage(); const hosts = new Map();
  p.on('request', (r) => { const u = new URL(r.url()); if (KNOWN.test(r.url())) hosts.set(u.host + u.pathname.split('/').slice(0, 3).join('/'), 1); });
  let status = 'ok';
  try { await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); await p.waitForTimeout(2000); } catch (e) { status = e.message.slice(0, 50); }
  const out = await p.$$eval('a[href],iframe[src]', (els) => els.map((e) => e.href || e.src).filter((h) => /greenhouse|lever\.co|ashby|smartrecruiters|myworkdayjobs|keka|zoho|freshteam|darwinbox|icims|eightfold|oraclecloud|workable|recruitee/i.test(h)).slice(0, 3)).catch(() => []);
  console.log(name.padEnd(14), status.padEnd(8), [...hosts.keys()].slice(0, 3).join(' ; ') || '-', '|', out.join(' ; ') || '-');
  await p.close();
}
await b.close();
