# Job Map app

Express API + a small web front end. Job data is read from `../jobs.sqlite` (read-only, built by `../build-sqlite.mjs`).
Accounts, saved jobs and saved searches live in Postgres (`schema.sql`).

```bash
cd docs/_project/job-map && node build-sqlite.mjs          # produces jobs.sqlite from the latest crawl
cd app && npm i
psql "$DATABASE_URL" -f schema.sql                          # once; safe to re-run
DATABASE_URL=... JWT_SECRET=... npm start                   # http://localhost:3000
DATABASE_URL=... npm test                                   # 29 checks against a real Postgres + the real SQLite file
```

API: `GET /api/meta`, `GET /api/jobs?q=&country=&fn=&position=&stack=&level=&tier=&category=&loc=&since=&limit=&offset=`
(`q` supports prefix search and `OR`, e.g. `kyc OR aml`; `country=EUROPE` expands to all European countries),
`/api/auth/{register,login,logout}`, `/api/me`, `/api/saved` (GET/PUT/PATCH/DELETE), `/api/searches`.

Security: bcrypt (cost 12) password hashes, JWT in an httpOnly SameSite=Lax cookie (`Secure` when `NODE_ENV=production`),
login/register rate limit, same-origin check on writes, JSON-only writes, all SQL parameterised, CSP via helmet.
Run it behind HTTPS. Rebuilding `jobs.sqlite` and restarting the server is all a data refresh needs.
