// Smoke test against a real Postgres + the real jobs.sqlite.  DATABASE_URL=postgres://jobmap:jobmap_local@localhost/jobmap_test node test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createApp } from './server.mjs';
import { openJobs } from './search.mjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://jobmap:jobmap_local@localhost/jobmap_test' });
await pool.query('DROP TABLE IF EXISTS saved_searches, saved_jobs, users CASCADE');
await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const app = createApp({ pool, jobsDb: openJobs(fileURLToPath(new URL('../jobs.sqlite', import.meta.url))), jwtSecret: 'x'.repeat(40) });
const server = app.listen(0); const base = `http://localhost:${server.address().port}`;
let cookie = '';
const call = async (method, path, body, hdr = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie, ...hdr }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
};
let n = 0; const ok = (name) => console.log(`ok ${++n} ${name}`);

// public search
let r = await call('GET', '/api/meta'); assert.equal(r.status, 200); assert(r.body.jobs > 1000); ok('meta');
r = await call('GET', '/api/jobs?q=kyc%20OR%20aml&country=DE'); assert.equal(r.status, 200); assert(r.body.total > 0 && r.body.rows.every((x) => x.country === 'DE')); ok(`FTS + country (${r.body.total} hits)`);
r = await call('GET', `/api/jobs?q=${encodeURIComponent('"); DROP TABLE jobs; --')}`); assert.equal(r.status, 200); ok('hostile q is just text');
r = await call('GET', `/api/jobs?country=${encodeURIComponent("IN' OR '1'='1")}&fn=engineering&position=frontend`); assert.equal(r.status, 200); assert.equal(r.body.total, (await call('GET', '/api/jobs?fn=engineering&position=frontend')).body.total); ok('bad country value ignored, not injected');
r = await call('GET', '/api/jobs?limit=100000'); assert.equal(r.body.rows.length, 100); ok('limit capped at 100');
const job = (await call('GET', '/api/jobs?fn=compliance&limit=1')).body.rows[0] ?? (await call('GET', '/api/jobs?limit=1')).body.rows[0];

// auth gates
assert.equal((await call('GET', '/api/saved')).status, 401); ok('saved needs login');
assert.equal((await call('POST', '/api/auth/register', { email: 'bad', password: 'longenoughpass' })).status, 400); ok('bad email refused');
assert.equal((await call('POST', '/api/auth/register', { email: 'a@b.co', password: 'short' })).status, 400); ok('short password refused');
r = await call('POST', '/api/auth/register', { email: 'Sis@Example.com', password: 'correct horse battery' }); assert.equal(r.status, 201); ok('register');
assert.equal((await call('POST', '/api/auth/register', { email: 'sis@example.com', password: 'another long pass' })).status, 409); ok('duplicate email (case-insensitive)');
assert.equal((await call('GET', '/api/me')).body.email, 'Sis@Example.com'); ok('me via cookie');
const hash = (await pool.query('SELECT password_hash h FROM users')).rows[0].h; assert(hash.startsWith('$2') && !hash.includes('correct')); ok('password stored as bcrypt hash');

// saved jobs
assert.equal((await call('PUT', '/api/saved', { url: 'https://nope.invalid/x' })).status, 404); ok('cannot save unknown job');
assert.equal((await call('PUT', '/api/saved', { url: job.url })).status, 201); ok('save job');
assert.equal((await call('PUT', '/api/saved', { url: job.url })).status, 201); ok('saving twice is harmless');
assert.equal((await call('PATCH', '/api/saved', { url: job.url, status: 'applied', notes: 'sent CV' })).status, 200); ok('set status + notes');
assert.equal((await call('PATCH', '/api/saved', { url: job.url, status: 'hired??' })).status, 400); ok('bad status refused');
r = await call('GET', '/api/saved'); assert.equal(r.body.length, 1); assert.equal(r.body[0].status, 'applied'); assert.equal(r.body[0].title, job.title); ok('list saved (snapshot kept)');
r = await call('POST', '/api/searches', { name: 'KYC Paris', filters: { q: 'kyc', loc: 'paris' } }); assert.equal(r.status, 201); ok('saved search');
assert.equal((await call('GET', '/api/searches')).body[0].filters.q, 'kyc'); ok('list saved searches');

// isolation + CSRF
const mine = cookie; cookie = '';
await call('POST', '/api/auth/register', { email: 'other@example.com', password: 'a different long pass' });
assert.equal((await call('GET', '/api/saved')).body.length, 0); ok("another user sees none of my saved jobs");
assert.equal((await call('PATCH', '/api/saved', { url: job.url, status: 'offer' })).status, 404); ok("cannot edit someone else's job");
cookie = mine;
assert.equal((await call('POST', '/api/searches', { name: 'x', filters: {} }, { origin: 'https://evil.example' })).status, 403); ok('cross-site write refused');
r = await fetch(base + '/api/searches', { method: 'POST', headers: { 'content-type': 'text/plain', cookie }, body: '{}' }); assert.equal(r.status, 415); ok('non-JSON write refused');

// login / logout
cookie = ''; assert.equal((await call('POST', '/api/auth/login', { email: 'sis@example.com', password: 'wrong password!!' })).status, 401); ok('wrong password');
assert.equal((await call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'wrong password!!' })).status, 401); ok('unknown user same answer');
assert.equal((await call('POST', '/api/auth/login', { email: 'SIS@example.com', password: 'correct horse battery' })).status, 200); ok('login');
assert.equal((await call('DELETE', '/api/saved', { url: job.url })).status, 200); assert.equal((await call('GET', '/api/saved')).body.length, 0); ok('remove saved job');
assert((await fetch(base + '/')).headers.get('content-security-policy')); ok('CSP header present');
server.close(); await pool.end(); console.log(`\nall ${n} checks passed`);
