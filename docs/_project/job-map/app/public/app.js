const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const api = async (method, path, body) => {
  const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status });
  return data;
};
const FN = [['compliance', 'Compliance / AML / KYC'], ['finance', 'Finance & banking'], ['risk', 'Risk & audit'], ['engineering', 'Engineering'], ['data', 'Data'], ['product', 'Product & projects'], ['sales', 'Sales'], ['marketing', 'Marketing'], ['hr', 'HR'], ['legal', 'Legal'], ['design', 'Design'], ['support', 'Support'], ['ops', 'Operations'], ['other', 'Other']];
const POS = [['frontend', 'Frontend / UI'], ['fullstack', 'Full-stack'], ['backend', 'Backend'], ['software', 'General software']];
const STK = [['java', 'Java / Spring'], ['node', 'Node.js'], ['ui', 'React / Angular / JS'], ['none', 'Stack not stated']];
const LEVELS = [['', 'Any seniority'], ['intern', 'Intern / graduate'], ['junior', 'Junior'], ['mid', 'Mid'], ['senior', 'Senior / Lead'], ['staff+', 'Staff+']];
const STATUS = ['saved', 'applied', 'interview', 'offer', 'rejected'];
const NAMES = { IN: 'India', US: 'USA', CA: 'Canada', DE: 'Germany', GB: 'United Kingdom', FR: 'France', NL: 'Netherlands', IE: 'Ireland', ES: 'Spain', IT: 'Italy', CH: 'Switzerland', SE: 'Sweden', SG: 'Singapore', AE: 'UAE', AU: 'Australia', LU: 'Luxembourg', REMOTE: 'Remote', OTHER: 'Other / unclear' };
const F = { q: '', loc: '', country: 'IN', level: '', category: '', tier: '', fn: new Set(), position: new Set(), stack: new Set(), fresh: false };
let user = null, saved = new Map(), offset = 0, total = 0, tab = 'search', statusFilter = '';

function params(extra = {}) {
  const p = new URLSearchParams();
  for (const k of ['q', 'loc', 'country', 'level', 'category', 'tier']) if (F[k]) p.set(k, F[k]);
  for (const k of ['fn', 'position', 'stack']) if (F[k].size) p.set(k, [...F[k]].join(','));
  if (F.fresh) p.set('since', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}
function toggles(host, items, set, then) {
  host.innerHTML = '';
  for (const [k, t] of items) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k; b.dataset.t = t; b.setAttribute('aria-pressed', set.has(k)); b.textContent = t; b.onclick = () => { set.has(k) ? set.delete(k) : set.add(k); then(); }; host.append(b); }
}
const sync = (host, set, counts) => host.querySelectorAll('.chip').forEach((b) => { b.setAttribute('aria-pressed', set.has(b.dataset.k)); b.innerHTML = esc(b.dataset.t) + (counts?.[b.dataset.k] != null ? `<span class="n">${counts[b.dataset.k]}</span>` : ''); });

async function search(append = false) {
  if (!append) { offset = 0; $('results').innerHTML = '<div class="empty">Searching…</div>'; }
  let d;
  try { d = await api('GET', '/api/jobs?' + params({ limit: 25, offset })); } catch (e) { $('results').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  total = d.total;
  const counts = Object.fromEntries(d.facets.fn.map((x) => [x.key, x.n]));
  sync($('fn'), F.fn, counts);
  $('pos').hidden = $('stack').hidden = !F.fn.has('engineering');
  $('summary').innerHTML = `<strong>${total.toLocaleString()} roles</strong><span class="sub">${esc(NAMES[F.country] || F.country || 'Anywhere')}</span>`;
  const html = d.rows.map(jobHtml).join('');
  $('results').innerHTML = append ? $('results').innerHTML + html : html || '<div class="empty">No roles match. Try another country, remove the city, or choose fewer functions.</div>';
  offset += d.rows.length; $('more').hidden = offset >= total;
}
const jobHtml = (j) => `<article class="job"><div><a class="title" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>
  <div class="co">${esc(j.company)} · ${esc(j.location || '—')} ${j.firstSeen >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10) ? '<span class="new">NEW</span>' : ''}</div>
  <div><span class="pill">${esc((FN.find((f) => f[0] === j.fn) || [])[1] || j.fn)}</span><span class="sub">${esc(j.level)}</span></div></div>
  <button class="star" data-url="${esc(j.url)}" aria-pressed="${saved.has(j.url)}" aria-label="Save job" title="Save job">${saved.has(j.url) ? '★' : '☆'}</button></article>`;

$('results').onclick = async (e) => {
  const b = e.target.closest('.star'); if (!b) return;
  if (!user) return openLogin();
  const url = b.dataset.url, on = saved.has(url);
  try { on ? await api('DELETE', '/api/saved', { url }) : await api('PUT', '/api/saved', { url }); await loadSaved(); b.setAttribute('aria-pressed', !on); b.textContent = on ? '☆' : '★'; } catch (err) { alert_(err.message); }
};
const alert_ = (m) => { $('summary').insertAdjacentHTML('beforeend', `<span class="err">${esc(m)}</span>`); };

// ---- account ----
function drawAuth() {
  $('auth').innerHTML = user ? `<span class="sub">${esc(user.email)}</span> <button class="btn" id="out">Sign out</button>` : '<button class="btn primary" id="in">Sign in</button>';
  if (user) $('out').onclick = async () => { await api('POST', '/api/auth/logout', {}); user = null; saved = new Map(); drawAuth(); showTab('search'); search(); }; else $('in').onclick = openLogin;
}
let mode = 'login';
function openLogin() { setMode('login'); $('loginErr').textContent = ''; $('login').showModal(); $('email').focus(); }
function setMode(m) { mode = m; $('loginTitle').textContent = m === 'login' ? 'Sign in' : 'Create an account'; $('loginGo').textContent = m === 'login' ? 'Sign in' : 'Create account'; $('loginSwitch').textContent = m === 'login' ? 'Create an account' : 'I have an account'; $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password'; }
$('loginSwitch').onclick = () => setMode(mode === 'login' ? 'register' : 'login');
$('loginClose').onclick = () => $('login').close();
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try { user = await api('POST', mode === 'login' ? '/api/auth/login' : '/api/auth/register', { email: $('email').value, password: $('password').value }); $('password').value = ''; $('login').close(); drawAuth(); await loadSaved(); search(); loadSearches(); }
  catch (err) { $('loginErr').textContent = err.message; }
};
async function loadSaved() {
  if (!user) return;
  const rows = await api('GET', '/api/saved'); saved = new Map(rows.map((r) => [r.url, r])); $('savedCount').textContent = rows.length ? `(${rows.length})` : '';
  if (tab === 'saved') drawSaved();
}
function drawSaved() {
  const rows = [...saved.values()].filter((r) => !statusFilter || r.status === statusFilter);
  toggles($('statusFilter'), [['', 'All'], ...STATUS.map((s) => [s, s[0].toUpperCase() + s.slice(1)])], new Set([statusFilter]), () => {});
  $('statusFilter').querySelectorAll('.chip').forEach((b) => (b.onclick = () => { statusFilter = b.dataset.k; drawSaved(); }));
  if (!user) { $('saved').innerHTML = '<div class="empty">Sign in to keep a list of jobs, mark where you applied and add notes.</div>'; return; }
  $('saved').innerHTML = rows.length ? rows.map((r) => `<div class="saved-item" data-url="${esc(r.url)}"><div><a class="title" href="${esc(r.url)}" target="_blank" rel="noopener"><strong>${esc(r.title)}</strong></a><div class="co sub">${esc(r.company)} · ${esc(r.location || '—')}</div></div>
    <div class="row"><select class="st" aria-label="Status">${STATUS.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn rm">Remove</button></div>
    <textarea class="notes" placeholder="Notes" maxlength="4000" aria-label="Notes">${esc(r.notes)}</textarea></div>`).join('') : '<div class="empty">Nothing here yet. Star a job in Search to add it.</div>';
}
$('saved').onchange = async (e) => { const it = e.target.closest('.saved-item'); if (e.target.classList.contains('st')) { const rec = saved.get(it.dataset.url); if (rec) rec.status = e.target.value; await api('PATCH', '/api/saved', { url: it.dataset.url, status: e.target.value }).catch(() => alert_('Could not change the status.')); } };
$('saved').addEventListener('focusout', async (e) => { if (e.target.classList.contains('notes')) { const it = e.target.closest('.saved-item'); const rec = saved.get(it.dataset.url); if (rec && rec.notes === e.target.value) return; if (rec) rec.notes = e.target.value; await api('PATCH', '/api/saved', { url: it.dataset.url, notes: e.target.value }).catch(() => alert_('Could not save the note.')); } });
$('saved').onclick = async (e) => { if (e.target.classList.contains('rm')) { await api('DELETE', '/api/saved', { url: e.target.closest('.saved-item').dataset.url }); await loadSaved(); drawSaved(); } };
function showTab(t) { tab = t; $('searchView').hidden = t !== 'search'; $('savedView').hidden = t !== 'saved'; $('tab-search').setAttribute('aria-selected', t === 'search'); $('tab-saved').setAttribute('aria-selected', t === 'saved'); if (t === 'saved') drawSaved(); }
$('tab-search').onclick = () => showTab('search'); $('tab-saved').onclick = () => (user ? showTab('saved') : openLogin());

// ---- saved searches ----
async function loadSearches() {
  if (!user) { $('searches').innerHTML = ''; return; }
  const rows = await api('GET', '/api/searches').catch(() => []);
  $('searches').innerHTML = rows.slice(0, 6).map((s) => `<button class="chip" data-id="${s.id}" data-f='${esc(JSON.stringify(s.filters))}'>${esc(s.name)}</button>`).join('');
}
$('searches').onclick = (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  const f = JSON.parse(b.dataset.f); Object.assign(F, { q: f.q ?? '', loc: f.loc ?? '', country: f.country ?? '', level: f.level ?? '', category: f.category ?? '', tier: f.tier ?? '', fresh: !!f.fresh, fn: new Set(f.fn ?? []), position: new Set(f.position ?? []), stack: new Set(f.stack ?? []) });
  fillControls(); search();
};
$('saveSearch').onclick = async () => {
  if (!user) return openLogin();
  const name = [F.q, F.loc, NAMES[F.country] || F.country, [...F.fn].join('+')].filter(Boolean).join(' · ').slice(0, 80) || 'My search';
  await api('POST', '/api/searches', { name, filters: { q: F.q, loc: F.loc, country: F.country, level: F.level, category: F.category, tier: F.tier, fresh: F.fresh, fn: [...F.fn], position: [...F.position], stack: [...F.stack] } });
  loadSearches();
};

function fillControls() { $('q').value = F.q; $('loc').value = F.loc; $('country').value = F.country; $('level').value = F.level; $('cat').value = F.category; $('tier').value = F.tier; $('fresh').checked = F.fresh; sync($('fn'), F.fn); sync($('pos'), F.position); sync($('stack'), F.stack); }
let timer; const later = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 250); };
$('q').oninput = () => { F.q = $('q').value; later(() => search()); };
$('loc').oninput = () => { F.loc = $('loc').value; later(() => search()); };
for (const [id, k] of [['country', 'country'], ['level', 'level'], ['cat', 'category'], ['tier', 'tier']]) $(id).onchange = () => { F[k] = $(id).value; search(); };
$('fresh').onchange = () => { F.fresh = $('fresh').checked; search(); };
$('more').onclick = () => search(true);

(async function init() {
  toggles($('fn'), FN, F.fn, () => search()); toggles($('pos'), POS, F.position, () => { sync($('pos'), F.position); search(); }); toggles($('stack'), STK, F.stack, () => { sync($('stack'), F.stack); search(); });
  $('level').innerHTML = LEVELS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('tier').innerHTML = '<option value="">All tiers</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option><option value="0">New (size unknown)</option>';
  const m = await api('GET', '/api/meta');
  $('meta').textContent = `crawled ${m.crawled} · ${m.companies.toLocaleString()} companies · ${m.jobs.toLocaleString()} roles`;
  $('country').innerHTML = '<option value="">Anywhere</option><option value="EUROPE">All Europe</option>' + m.countries.filter((c) => !['OTHER'].includes(c.key)).map((c) => `<option value="${esc(c.key)}">${esc(NAMES[c.key] || c.key)} (${c.n.toLocaleString()})</option>`).join('');
  $('cat').innerHTML = '<option value="">All company types</option>' + m.categories.filter((c) => c.key).map((c) => `<option value="${esc(c.key)}">${esc(c.key)} (${c.n})</option>`).join('');
  if (!m.countries.some((c) => c.key === 'IN')) F.country = '';
  fillControls();
  try { user = await api('GET', '/api/me'); await loadSaved(); loadSearches(); } catch { user = null; }
  drawAuth(); search();
})();
