// Phase 13 pages 01, 03 — roles, GRANT/REVOKE, ownership, default privileges.
// Everything here is caused for real: each denial is a live 42501 from a session
// connected AS that role, not a description of one.
import pg from 'pg';

const SUPER = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const admin = new pg.Pool({connectionString: SUPER, max: 5});
const q = (...a) => admin.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// run one statement as a given role on its own connection, report OK or SQLSTATE
const asRole = async (role, pw, label, sql, params) => {
  const c = new pg.Client({
    host: '127.0.0.1', port: 55432, database: 'devbible', user: role, password: pw,
  });
  // a WARNING is not an error: VACUUM without MAINTAIN skips, and only a notice
  // listener reveals it. Buffer them so each prints under its own result line.
  const notices = [];
  c.on('notice', (n) => notices.push(`${n.severity}: ${n.message}`));
  const flush = () => notices.splice(0).forEach((n) => console.log(`${''.padEnd(54)}↳ ${n}`));
  try {
    await c.connect();
    const r = await c.query(sql, params);
    const last = Array.isArray(r) ? r[r.length - 1] : r;   // multi-statement returns an array
    console.log(`${label.padEnd(52)} → OK${last.rows?.length ? ` (${last.rows.length} rows)` : ''}`);
    flush();
    return last;
  } catch (e) {
    console.log(`${label.padEnd(52)} → ${e.code} ${e.message.split('\n')[0]}`);
    flush();
    return null;
  } finally { try { await c.end(); } catch {} }
};

const tryAdmin = async (label, sql) => {
  try { await q(sql); console.log(`${label.padEnd(52)} → OK`); }
  catch (e) { console.log(`${label.padEnd(52)} → ${e.code} ${e.message.split('\n')[0]}`); }
};

// ---------------------------------------------------------------- setup
line('0. who am I, and is the sandbox user a superuser?');
console.log((await q(`SELECT current_user, rolsuper, rolcreatedb, rolcreaterole
                        FROM pg_roles WHERE rolname = current_user`)).rows[0]);

await q(`DROP SCHEMA IF EXISTS app CASCADE`);
for (const r of ['p13_app', 'p13_owner', 'p13_ro', 'p13_analyst'])
  await q(`DROP OWNED BY ${r} CASCADE; DROP ROLE IF EXISTS ${r}`).catch(() => {});
for (const r of ['p13_app', 'p13_owner', 'p13_ro', 'p13_analyst'])
  await q(`DROP ROLE IF EXISTS ${r}`).catch(() => {});

// p13_owner owns the schema; p13_app is the application login; p13_ro is a group.
await q(`CREATE ROLE p13_owner  LOGIN PASSWORD 'pw'`);
await q(`CREATE ROLE p13_app    LOGIN PASSWORD 'pw'`);
await q(`CREATE ROLE p13_analyst LOGIN PASSWORD 'pw'`);
await q(`CREATE ROLE p13_ro NOLOGIN`);                 // group role, no login
await q(`CREATE SCHEMA app AUTHORIZATION p13_owner`);

line('1. role attributes — what a role IS before any GRANT');
console.log((await q(`SELECT rolname, rolsuper AS super, rolinherit AS inherit,
                             rolcanlogin AS login, rolcreatedb AS createdb,
                             rolconnlimit AS connlimit
                        FROM pg_roles WHERE rolname LIKE 'p13%' ORDER BY rolname`)).rows);
console.log('↑ CREATE ROLE ... LOGIN is what CREATE USER expands to; there is one object type');

// owner creates the tables
const own = new pg.Client({host:'127.0.0.1',port:55432,database:'devbible',user:'p13_owner',password:'pw'});
await own.connect();
await own.query(`CREATE TABLE app.customers (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email   text NOT NULL,
  ssn     text NOT NULL,
  created timestamptz NOT NULL DEFAULT now())`);
await own.query(`INSERT INTO app.customers (email, ssn)
                 SELECT 'u'||g||'@example.com', 'ssn-'||g FROM generate_series(1,50) g`);
await own.query(`CREATE TABLE app.orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES app.customers(id),
  total numeric(10,2) NOT NULL)`);
await own.query(`INSERT INTO app.orders (customer_id, total)
                 SELECT 1 + (g % 50), (g % 400 + 10)::numeric FROM generate_series(1,200) g`);

line('2. a brand-new role can connect but sees nothing');
await asRole('p13_app', 'pw', 'SELECT 1 (connect at all)', 'SELECT 1');
await asRole('p13_app', 'pw', 'SELECT from app.customers', 'SELECT * FROM app.customers LIMIT 1');
console.log('↑ CONNECT on the database is granted to PUBLIC by default — the table is not');

line('3. USAGE on the schema is a separate grant from SELECT on the table');
await q(`GRANT SELECT ON app.customers TO p13_app`);
await asRole('p13_app', 'pw', 'SELECT after GRANT SELECT, no schema USAGE',
  'SELECT * FROM app.customers LIMIT 1');
await q(`GRANT USAGE ON SCHEMA app TO p13_app`);
await asRole('p13_app', 'pw', 'SELECT after GRANT USAGE ON SCHEMA',
  'SELECT * FROM app.customers LIMIT 1');

line('4. the grants an app actually needs, one verb at a time');
await asRole('p13_app', 'pw', 'INSERT (only SELECT granted)',
  `INSERT INTO app.customers (email, ssn) VALUES ('x@example.com','ssn-x')`);
await q(`GRANT INSERT, UPDATE, DELETE ON app.customers TO p13_app`);
await asRole('p13_app', 'pw', 'INSERT after GRANT INSERT',
  `INSERT INTO app.customers (email, ssn) VALUES ('x@example.com','ssn-x')`);
await asRole('p13_app', 'pw', 'UPDATE after GRANT UPDATE',
  `UPDATE app.customers SET email = 'y@example.com' WHERE email = 'x@example.com'`);
await asRole('p13_app', 'pw', 'DELETE after GRANT DELETE',
  `DELETE FROM app.customers WHERE email = 'y@example.com'`);
await asRole('p13_app', 'pw', 'TRUNCATE (not covered by DELETE)', `TRUNCATE app.orders`);

line('5. identity columns need USAGE on the sequence — or do they?');
console.log((await q(`SELECT c.relname, c.relkind FROM pg_class c
                        JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE n.nspname='app' AND c.relkind='S'`)).rows);
await asRole('p13_app', 'pw', 'INSERT into GENERATED ALWAYS AS IDENTITY',
  `INSERT INTO app.customers (email, ssn) VALUES ('seq@example.com','ssn-seq')`);
console.log('↑ identity sequences are owned by the column: no separate GRANT USAGE needed.');
console.log('  A serial/nextval() DEFAULT is the case that DOES need GRANT USAGE ON SEQUENCE.');

line('6. column-level grants');
await q(`GRANT SELECT (id, email) ON app.customers TO p13_analyst`);
await q(`GRANT USAGE ON SCHEMA app TO p13_analyst`);
await asRole('p13_analyst', 'pw', 'SELECT * with column grant on (id,email)',
  'SELECT * FROM app.customers LIMIT 1');
await asRole('p13_analyst', 'pw', 'SELECT id, email',
  'SELECT id, email FROM app.customers LIMIT 1');
await asRole('p13_analyst', 'pw', 'SELECT ssn (not granted)',
  'SELECT ssn FROM app.customers LIMIT 1');
await asRole('p13_analyst', 'pw', 'WHERE ssn = ... (predicate on ungranted col)',
  `SELECT id FROM app.customers WHERE ssn = 'ssn-1'`);
await asRole('p13_analyst', 'pw', 'count(*) — needs no column privilege',
  'SELECT count(*) FROM app.customers');

line('7. ON ALL TABLES covers only the tables that exist NOW');
await q(`GRANT SELECT ON ALL TABLES IN SCHEMA app TO p13_ro`);
await q(`GRANT USAGE ON SCHEMA app TO p13_ro`);
await q(`GRANT p13_ro TO p13_analyst`);
await asRole('p13_analyst', 'pw', 'SELECT app.orders via group p13_ro',
  'SELECT count(*) FROM app.orders');
await own.query(`CREATE TABLE app.invoices (id int PRIMARY KEY, amount numeric)`);
await asRole('p13_analyst', 'pw', 'SELECT a table created AFTER the grant',
  'SELECT count(*) FROM app.invoices');

line('8. ALTER DEFAULT PRIVILEGES fixes it — for future tables only');
await q(`ALTER DEFAULT PRIVILEGES FOR ROLE p13_owner IN SCHEMA app
         GRANT SELECT ON TABLES TO p13_ro`);
await own.query(`CREATE TABLE app.receipts (id int PRIMARY KEY, amount numeric)`);
await asRole('p13_analyst', 'pw', 'table created after ALTER DEFAULT PRIVILEGES',
  'SELECT count(*) FROM app.receipts');
await asRole('p13_analyst', 'pw', 'app.invoices (created before it) still',
  'SELECT count(*) FROM app.invoices');
console.log((await q(`SELECT pg_get_userbyid(defaclrole) AS for_role,
                             n.nspname AS schema, defaclobjtype AS objtype,
                             defaclacl::text AS acl
                        FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace`)).rows);
console.log('↑ FOR ROLE matters: defaults are recorded per creating role, not per schema');

line('9. reading the ACL — what \\dp actually shows');
console.log((await q(`SELECT relname, relacl::text
                        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE n.nspname='app' AND relkind='r' ORDER BY relname`)).rows);
console.log('  grantee=verbs/grantor · r=SELECT w=UPDATE a=INSERT d=DELETE D=TRUNCATE x=REFERENCES t=TRIGGER');
console.log((await q(`SELECT has_table_privilege('p13_app','app.customers','SELECT') AS app_select,
                             has_table_privilege('p13_app','app.customers','TRUNCATE') AS app_truncate,
                             has_column_privilege('p13_analyst','app.customers','ssn','SELECT') AS analyst_ssn`)).rows[0]);
console.log('↑ analyst_ssn is now TRUE, and in section 6 the same read was denied. Nothing about');
console.log('  the column grant changed — section 7 made p13_analyst a member of p13_ro, which');
console.log('  holds table-wide SELECT. Re-running the section-6 read to confirm:');
await asRole('p13_analyst', 'pw', 'SELECT ssn — denied in §6, after group membership',
  'SELECT ssn FROM app.customers LIMIT 1');
console.log('  Column grants are ADDITIVE, never a ceiling: privileges are the UNION over every');
console.log('  role you inherit. A column restriction is undone by any table-wide grant elsewhere.');

line('10. REVOKE, and the two things it does not undo');
await q(`REVOKE SELECT ON app.customers FROM p13_app`);
await asRole('p13_app', 'pw', 'SELECT after REVOKE SELECT', 'SELECT * FROM app.customers LIMIT 1');
await asRole('p13_app', 'pw', 'UPDATE ... WHERE id = 1 (UPDATE still granted)',
  `UPDATE app.customers SET email = 'z@example.com' WHERE id = 1`);
await asRole('p13_app', 'pw', 'UPDATE with no WHERE, constant value',
  `UPDATE app.customers SET email = 'z@example.com'`);
await asRole('p13_app', 'pw', 'UPDATE ... SET email = email (reads the column)',
  `UPDATE app.customers SET email = email`);
console.log('↑ UPDATE alone only covers writing. A WHERE clause, or a SET that reads any column,');
console.log('  needs SELECT on those columns too — so revoking SELECT breaks most real UPDATEs.');
await q(`GRANT SELECT ON app.customers TO p13_app`);
await tryAdmin('REVOKE SELECT ... FROM p13_owner (the owner)',
  `REVOKE SELECT ON app.customers FROM p13_owner`);
await asRole('p13_owner', 'pw', 'owner SELECT after revoking its own SELECT',
  'SELECT count(*) FROM app.customers');
console.log('↑ REVOKE from the owner "succeeds" and changes nothing you can rely on:');
console.log('  ownership carries the right to GRANT it straight back. Ownership ≠ a privilege.');

line('11. why the app role must not own the schema');
await asRole('p13_app', 'pw', 'app role: DROP TABLE app.receipts', 'DROP TABLE app.receipts');
await asRole('p13_app', 'pw', 'app role: ALTER TABLE ... DROP COLUMN',
  'ALTER TABLE app.customers DROP COLUMN ssn');
await asRole('p13_app', 'pw', 'app role: CREATE TABLE in app', 'CREATE TABLE app.evil (id int)');
await asRole('p13_owner', 'pw', 'owner: ALTER TABLE ... ADD COLUMN',
  'ALTER TABLE app.customers ADD COLUMN note text');
console.log('↑ A SQL-injected DROP TABLE is a 42501 for the app role and a completed');
console.log('  migration for an owner role. That difference is the whole point.');

line('12. the public schema in PostgreSQL 15+');
await asRole('p13_app', 'pw', 'CREATE TABLE public.t (PG15+ default)', 'CREATE TABLE public.t_p13 (id int)');
console.log((await q(`SELECT nspname, nspacl::text FROM pg_namespace WHERE nspname='public'`)).rows[0]);
console.log('↑ PUBLIC keeps USAGE on public but lost CREATE in PG 15 — pre-15 every role could');
console.log('  create objects there, which is how "it worked before we upgraded" happens');

line('13. INHERIT vs NOINHERIT, and SET ROLE');
await q(`CREATE ROLE p13_noinh LOGIN NOINHERIT PASSWORD 'pw'`).catch(()=>{});
await q(`GRANT p13_ro TO p13_noinh`);
await asRole('p13_noinh', 'pw', 'NOINHERIT member of p13_ro: SELECT app.orders',
  'SELECT count(*) FROM app.orders');
await asRole('p13_noinh', 'pw', 'same, after SET ROLE p13_ro',
  'SET ROLE p13_ro; SELECT count(*) FROM app.orders');
console.log((await q(`SELECT r.rolname AS member, g.rolname AS granted_role, m.admin_option, m.inherit_option
                        FROM pg_auth_members m
                        JOIN pg_roles r ON r.oid=m.member JOIN pg_roles g ON g.oid=m.roleid
                       WHERE g.rolname='p13_ro' ORDER BY 1`)).rows);

line('14. CONNECTION LIMIT and VALID UNTIL are role attributes, not grants');
await q(`ALTER ROLE p13_analyst CONNECTION LIMIT 1`);
const c1 = new pg.Client({host:'127.0.0.1',port:55432,database:'devbible',user:'p13_analyst',password:'pw'});
await c1.connect();
await asRole('p13_analyst', 'pw', 'second connection with CONNECTION LIMIT 1', 'SELECT 1');
await c1.end();
await q(`ALTER ROLE p13_analyst CONNECTION LIMIT -1`);
await q(`ALTER ROLE p13_analyst VALID UNTIL '2020-01-01'`);
await asRole('p13_analyst', 'pw', 'login after VALID UNTIL 2020-01-01', 'SELECT 1');
await q(`ALTER ROLE p13_analyst VALID UNTIL 'infinity'`);
await asRole('p13_analyst', 'pw', 'login after VALID UNTIL infinity', 'SELECT 1');

line('15. dropping a role that owns or is granted things');
await tryAdmin('DROP ROLE p13_owner (owns tables)', 'DROP ROLE p13_owner');
console.log((await q(`SELECT 'REASSIGN OWNED BY p13_owner TO devbible; DROP OWNED BY p13_owner; DROP ROLE p13_owner;' AS the_three_steps`)).rows[0]);

line('16. password encryption and what the server stores');
console.log((await q(`SHOW password_encryption`)).rows[0]);
console.log((await q(`SELECT rolname, left(rolpassword, 14) || '...' AS stored
                        FROM pg_authid WHERE rolname='p13_app'`)).rows[0]);
console.log('↑ SCRAM-SHA-256: the server stores a verifier, not the password, and never the plaintext.');
console.log('  The statement text still contains it — see the log-leak measurement in ex51.');

await own.end();
await admin.end();

// ------- appended: claims that would otherwise be written from memory -------
line('17. MAINTAIN (PG17+) and the default EXECUTE grant on functions');
const admin2 = new pg.Pool({connectionString: SUPER, max: 3});
const q2 = (...a) => admin2.query(...a);
await q2(`CREATE TABLE IF NOT EXISTS app.m_probe (id int)`).catch(()=>{});
try { await q2(`GRANT MAINTAIN ON app.m_probe TO p13_app`); console.log('GRANT MAINTAIN'.padEnd(52) + ' → OK (privilege exists on 18.4)'); }
catch (e) { console.log('GRANT MAINTAIN'.padEnd(52) + ` → ${e.code} ${e.message.split('\n')[0]}`); }
await asRole('p13_app','pw','VACUUM app.m_probe with MAINTAIN granted','VACUUM app.m_probe');
await q2(`REVOKE MAINTAIN ON app.m_probe FROM p13_app`);
await asRole('p13_app','pw','VACUUM after REVOKE MAINTAIN','VACUUM app.m_probe');
console.log((await q2(`SELECT has_table_privilege('p13_app','app.m_probe','MAINTAIN') AS after_revoke`)).rows[0]);

await q2(`CREATE OR REPLACE FUNCTION app.f_probe() RETURNS int LANGUAGE sql AS $$ SELECT 42 $$`);
console.log((await q2(`SELECT proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                        WHERE n.nspname='app' AND proname='f_probe'`)).rows[0]);
await asRole('p13_app','pw','EXECUTE a function with NO grant written','SELECT app.f_probe()');
await q2(`REVOKE EXECUTE ON FUNCTION app.f_probe() FROM PUBLIC`);
await asRole('p13_app','pw','same function after REVOKE ... FROM PUBLIC','SELECT app.f_probe()');
console.log('↑ proacl NULL = default ACL = EXECUTE to PUBLIC. Only after an explicit REVOKE');
console.log('  does the ACL materialise and the call get denied.');
await admin2.end();
