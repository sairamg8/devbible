import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { openJobs, searchJobs, facets, meta, jobByUrl } from './search.mjs';

export function createApp({ pool, jobsDb, jwtSecret, secureCookie = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } } }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
  const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);
  const sign = (id) => jwt.sign({ sub: String(id) }, jwtSecret, { expiresIn: '14d' });
  const setCookie = (res, id) => res.cookie('jm', sign(id), { httpOnly: true, sameSite: 'lax', secure: secureCookie, maxAge: 14 * 864e5, path: '/' });
  const needUser = (req, res, next) => {
    try { req.uid = jwt.verify(req.cookies.jm ?? '', jwtSecret).sub; next(); } catch { res.status(401).json({ error: 'Sign in first.' }); }
  };
  // Cookie auth + JSON bodies: refuse cross-site writes outright (SameSite=Lax already blocks most; this is the second lock).
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const o = req.get('origin'); if (o && new URL(o).host !== req.get('host')) return res.status(403).json({ error: 'Cross-site request refused.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Send JSON.' });
    next();
  });

  // ---- public job data (SQLite, read-only) ----
  app.get('/api/meta', (req, res) => res.json(meta(jobsDb)));
  app.get('/api/jobs', (req, res) => res.json({ ...searchJobs(jobsDb, req.query), facets: facets(jobsDb, req.query) }));

  // ---- accounts (Postgres) ----
  const emailOk = (e) => typeof e === 'string' && e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  app.post('/api/auth/register', authLimiter, asyncH(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Use a password of 10 to 128 characters.' });
    const hash = await bcrypt.hash(password, 12);
    try {
      const { rows } = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email.trim(), hash]);
      setCookie(res, rows[0].id); res.status(201).json({ id: rows[0].id, email: rows[0].email });
    } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'That email already has an account.' }); throw e; }
  }));
  app.post('/api/auth/login', authLimiter, asyncH(async (req, res) => {
    const { email, password } = req.body ?? {};
    const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1)', [String(email ?? '')]);
    const ok = await bcrypt.compare(String(password ?? ''), rows[0]?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'); // constant work when the user is unknown
    if (!rows[0] || !ok) return res.status(401).json({ error: 'Email or password is wrong.' });
    setCookie(res, rows[0].id); res.json({ id: rows[0].id, email: rows[0].email });
  }));
  app.post('/api/auth/logout', (req, res) => { res.clearCookie('jm', { path: '/' }); res.json({ ok: true }); });
  app.get('/api/me', needUser, asyncH(async (req, res) => {
    const { rows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.uid]);
    rows[0] ? res.json(rows[0]) : res.status(401).json({ error: 'Sign in first.' });
  }));

  // ---- saved jobs ----
  const STATUS = ['saved', 'applied', 'interview', 'offer', 'rejected'];
  app.get('/api/saved', needUser, asyncH(async (req, res) => {
    const { rows } = await pool.query('SELECT job_url AS url, title, company, location, country, status, notes, saved_at AS "savedAt", updated_at AS "updatedAt" FROM saved_jobs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1000', [req.uid]);
    res.json(rows);
  }));
  app.put('/api/saved', needUser, asyncH(async (req, res) => {
    const job = jobByUrl(jobsDb, String(req.body?.url ?? ''));
    if (!job) return res.status(404).json({ error: 'That job is not in the current crawl.' });
    await pool.query(`INSERT INTO saved_jobs (user_id, job_url, title, company, location, country) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id, job_url) DO NOTHING`, [req.uid, job.url, job.title, job.company, job.location, job.country]);
    res.status(201).json({ ok: true });
  }));
  app.patch('/api/saved', needUser, asyncH(async (req, res) => {
    const { url, status, notes } = req.body ?? {};
    if (status !== undefined && !STATUS.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 4000)) return res.status(400).json({ error: 'Notes are limited to 4000 characters.' });
    const r = await pool.query('UPDATE saved_jobs SET status = COALESCE($3, status), notes = COALESCE($4, notes), updated_at = now() WHERE user_id = $1 AND job_url = $2', [req.uid, String(url ?? ''), status ?? null, notes ?? null]);
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Not in your saved jobs.' });
  }));
  app.delete('/api/saved', needUser, asyncH(async (req, res) => {
    await pool.query('DELETE FROM saved_jobs WHERE user_id = $1 AND job_url = $2', [req.uid, String(req.body?.url ?? '')]);
    res.json({ ok: true });
  }));

  // ---- saved searches ----
  app.get('/api/searches', needUser, asyncH(async (req, res) => res.json((await pool.query('SELECT id, name, filters FROM saved_searches WHERE user_id = $1 ORDER BY id DESC LIMIT 50', [req.uid])).rows)));
  app.post('/api/searches', needUser, asyncH(async (req, res) => {
    const { name, filters } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.length > 80 || typeof filters !== 'object' || filters === null || JSON.stringify(filters).length > 2000) return res.status(400).json({ error: 'Give the search a short name.' });
    const { rows } = await pool.query('INSERT INTO saved_searches (user_id, name, filters) VALUES ($1,$2,$3) RETURNING id', [req.uid, name.trim(), filters]);
    res.status(201).json({ id: rows[0].id });
  }));
  app.delete('/api/searches/:id', needUser, asyncH(async (req, res) => { await pool.query('DELETE FROM saved_searches WHERE user_id = $1 AND id = $2', [req.uid, req.params.id]); res.json({ ok: true }); }));

  app.use(express.static(fileURLToPath(new URL('./public/', import.meta.url))));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Try again.' }); });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const need = (k) => { if (!process.env[k]) { console.error(`Set ${k}`); process.exit(1); } return process.env[k]; };
  const secret = need('JWT_SECRET');
  if (secret.length < 32) { console.error('JWT_SECRET must be at least 32 characters'); process.exit(1); }
  const pool = new pg.Pool({ connectionString: need('DATABASE_URL') });
  const app = createApp({ pool, jobsDb: openJobs(process.env.SQLITE_PATH ?? fileURLToPath(new URL('../jobs.sqlite', import.meta.url))), jwtSecret: secret, secureCookie: process.env.NODE_ENV === 'production' });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`Job Map on http://localhost:${port}`));
}
