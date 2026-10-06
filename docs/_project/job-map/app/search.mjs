// Read-only job search over jobs.sqlite. Everything user-supplied goes through bound parameters.
import { DatabaseSync } from 'node:sqlite';

export const EUROPE = ['GB', 'FR', 'NL', 'IE', 'ES', 'IT', 'PT', 'PL', 'SE', 'DK', 'NO', 'FI', 'CH', 'AT', 'BE', 'LU', 'EE', 'LT', 'LV', 'CZ', 'RO', 'HU', 'GR', 'BG', 'UA', 'RS', 'HR', 'DE', 'EUROPE'];
const FUNCTIONS = ['compliance', 'legal', 'data', 'engineering', 'design', 'product', 'risk', 'finance', 'hr', 'sales', 'marketing', 'support', 'ops', 'other'];
const POSITIONS = ['frontend', 'fullstack', 'backend', 'software'];
const STACKS = ['java', 'node', 'ui', 'none'];
const LEVELS = ['intern', 'junior', 'mid', 'senior', 'staff+', 'unspecified'];

export function openJobs(path) { return new DatabaseSync(path, { readOnly: true }); }

const list = (v) => (v == null || v === '' ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const only = (arr, allowed) => arr.filter((x) => allowed.includes(x));
const marks = (n) => Array(n).fill('?').join(',');
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
/** "kyc paris" -> "kyc"* "paris"* (prefix, AND).  "kyc OR aml" -> ("kyc"*) OR ("aml"*).  Only quoted tokens reach FTS, so user text cannot inject operators. */
export const ftsQuery = (q) => {
  const groups = String(q ?? '').toLowerCase().split(/\s+or\s+/).map((g) => g.match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) ?? []).filter((g) => g.length).slice(0, 5);
  return groups.map((g) => '(' + g.map((t) => `"${t}"*`).join(' ') + ')').join(' OR ');
};

export function buildWhere(f) {
  const w = [], p = [];
  const country = list(f.country).map((c) => c.toUpperCase());
  const countries = country.flatMap((c) => (c === 'EUROPE' ? EUROPE : [c])).filter((c) => /^[A-Z]{2,6}$/.test(c));
  if (countries.length) { w.push(`j.country IN (${marks(countries.length)})`); p.push(...countries); }
  const fn = only(list(f.fn), FUNCTIONS); if (fn.length) { w.push(`j.fn IN (${marks(fn.length)})`); p.push(...fn); }
  const pos = only(list(f.position), POSITIONS); if (pos.length) { w.push(`(j.fn <> 'engineering' OR j.position IN (${marks(pos.length)}))`); p.push(...pos); }
  const st = only(list(f.stack), STACKS);
  if (st.length) { const real = st.filter((s) => s !== 'none'); const parts = []; if (real.length) { parts.push(`j.stack IN (${marks(real.length)})`); p.push(...real); } if (st.includes('none')) parts.push('j.stack IS NULL'); w.push(`(j.fn <> 'engineering' OR ${parts.join(' OR ')})`); }
  const lv = only(list(f.level), LEVELS); if (lv.length) { w.push(`j.level IN (${marks(lv.length)})`); p.push(...lv); }
  const tier = list(f.tier).map(Number).filter((n) => [0, 1, 2, 3].includes(n)); if (tier.length) { w.push(`c.tier IN (${marks(tier.length)})`); p.push(...tier); }
  const cat = list(f.category).filter((c) => /^[a-z]{2,20}$/.test(c)); if (cat.length) { w.push(`c.category IN (${marks(cat.length)})`); p.push(...cat); }
  if (f.company) { w.push(`c.name LIKE ? ESCAPE '\\' COLLATE NOCASE`); p.push(`%${likeEscape(String(f.company).slice(0, 80))}%`); }
  if (f.loc) { w.push(`j.location LIKE ? ESCAPE '\\' COLLATE NOCASE`); p.push(`%${likeEscape(String(f.loc).slice(0, 80))}%`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.since ?? '')) { w.push('j.first_seen >= ?'); p.push(f.since); }
  const fts = ftsQuery(f.q); if (fts) { w.push('j.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)'); p.push(fts); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

export function searchJobs(db, f) {
  const { where, params } = buildWhere(f);
  const limit = Math.min(Math.max(parseInt(f.limit, 10) || 50, 1), 100), offset = Math.max(parseInt(f.offset, 10) || 0, 0);
  const from = `FROM jobs j JOIN companies c ON c.id = j.company_id ${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params).n;
  const rows = db.prepare(`SELECT j.id, j.title, j.fn, j.position, j.stack, j.level, j.location, j.country, j.url, j.from_careers AS fromCareers, j.first_seen AS firstSeen,
      c.name AS company, c.tier, c.category, c.careers_url AS careersUrl ${from}
      ORDER BY CASE WHEN c.tier = 0 THEN 9 ELSE c.tier END, c.name COLLATE NOCASE, j.id LIMIT ? OFFSET ?`).all(...params, limit, offset);
  return { total, limit, offset, rows };
}

export function facets(db, f) {
  const { where, params } = buildWhere({ ...f, fn: undefined });
  const from = `FROM jobs j JOIN companies c ON c.id = j.company_id ${where}`;
  return { fn: db.prepare(`SELECT j.fn AS key, COUNT(*) AS n ${from} GROUP BY j.fn ORDER BY n DESC`).all(...params) };
}

export function meta(db) {
  return {
    crawled: db.prepare("SELECT value FROM meta WHERE key='crawled'").get()?.value,
    companies: db.prepare('SELECT COUNT(*) n FROM companies').get().n,
    jobs: db.prepare('SELECT COUNT(*) n FROM jobs').get().n,
    countries: db.prepare('SELECT country AS key, COUNT(*) AS n FROM jobs GROUP BY country ORDER BY n DESC').all(),
    categories: db.prepare('SELECT category AS key, COUNT(*) AS n FROM companies GROUP BY category ORDER BY n DESC').all(),
  };
}

export const jobByUrl = (db, url) => db.prepare('SELECT j.title, j.location, j.country, j.url, c.name AS company FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.url = ?').get(url);
