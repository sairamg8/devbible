// Phase 2 pages 09-16 — boolean/date/interval, arrays, enum vs CHECK vs lookup,
// casting, bytea, network/geometric/citext, domains and composites, ranges.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;
const tryq = async (label, sql, params) => {
  try { const r = await q(sql, params); console.log(`${label.padEnd(48)} ok  ${JSON.stringify(r.rows[0] ?? {})}`); }
  catch (e) { console.log(`${label.padEnd(48)} ->  ${err(e)}`); }
};
const plan1 = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
  return [(p.split('\n').find(l => /Scan/.test(l)) ?? '?').trim().split('  (')[0],
          p.match(/Execution Time: ([\d.]+) ms/)?.[1]];
};

// --- 9. boolean, date, interval --------------------------------------------
line('9. boolean, date and interval');
{
  console.log('boolean inputs:', JSON.stringify((await q(
    `SELECT 't'::boolean AS t, 'yes'::boolean AS yes, 'on'::boolean AS on_, '1'::boolean AS one,
            'false'::boolean AS f, pg_column_size(true) AS bytes`)).rows[0]));
  await tryq(`'maybe'::boolean`, `SELECT 'maybe'::boolean AS v`);
  console.log('boolean + NULL in a count:', JSON.stringify((await q(
    `SELECT count(*) FILTER (WHERE b) AS true_count, count(b) AS non_null, count(*) AS all_rows
     FROM (VALUES (true),(false),(NULL::boolean)) v(b)`)).rows[0]));

  console.log('date arithmetic:', JSON.stringify((await q(
    `SELECT (date '2026-03-01' - date '2026-02-01') AS date_minus_date,
            (date '2026-03-01' + 30) AS date_plus_int,
            (date '2026-03-01' + interval '1 month')::text AS date_plus_interval,
            (date '2026-01-31' + interval '1 month')::text AS jan31_plus_month,
            (date '2026-03-31' + interval '1 month')::text AS mar31_plus_month`)).rows[0]));

  console.log('interval:', JSON.stringify((await q(
    `SELECT (interval '1 month' = interval '30 days') AS month_eq_30d,
            (interval '1 day' = interval '24 hours') AS day_eq_24h,
            justify_interval(interval '90 days')::text AS justified,
            extract(epoch FROM interval '1 month') AS month_seconds,
            pg_column_size(interval '1 day') AS bytes`)).rows[0]));

  console.log('age vs subtraction:', JSON.stringify((await q(
    `SELECT age(timestamptz '2026-08-12', timestamptz '2025-02-28')::text AS age,
            (timestamptz '2026-08-12' - timestamptz '2025-02-28')::text AS subtraction`)).rows[0]));

  const iv = await q(`SELECT interval '3 days 4 hours' AS i, date '2026-06-15' AS d`);
  console.log('to JS:', JSON.stringify(iv.rows[0].i), '| date ->', iv.rows[0].d instanceof Date ? 'Date' : typeof iv.rows[0].d);
}

// --- 10. arrays -------------------------------------------------------------
line('10. arrays — and when a child table is better');
{
  await q(`DROP TABLE IF EXISTS ty_arr`);
  await q(`CREATE TABLE ty_arr (id int PRIMARY KEY, tags text[])`);
  await q(`INSERT INTO ty_arr SELECT g, ARRAY['t'||(g%50), 'common', 'x'||(g%7)]
           FROM generate_series(1,200000) g`);
  await q(`VACUUM ANALYZE ty_arr`);
  console.log('table:', await size('ty_arr'));

  console.log('basics:', JSON.stringify((await q(
    `SELECT tags[1] AS first_element, array_length(tags,1) AS len,
            cardinality(tags) AS card, ('common' = ANY(tags)) AS has_common,
            (tags @> ARRAY['common']) AS contains_common
     FROM ty_arr WHERE id = 1`)).rows[0]));
  console.log('1-based indexing:', JSON.stringify((await q(
    `SELECT (ARRAY['a','b','c'])[1] AS idx1, (ARRAY['a','b','c'])[0] AS idx0,
            (ARRAY['a','b','c'])[99] AS idx99`)).rows[0]), '<- out of range is NULL, not an error');

  let [node, t] = await plan1(`SELECT count(*) FROM ty_arr WHERE tags @> ARRAY['t42']`);
  console.log(`@> without an index : ${node} ${t} ms`);
  await q(`CREATE INDEX ty_arr_gin ON ty_arr USING gin (tags)`);
  await q(`ANALYZE ty_arr`);
  [node, t] = await plan1(`SELECT count(*) FROM ty_arr WHERE tags @> ARRAY['t42']`);
  console.log(`@> with a GIN index : ${node} ${t} ms | index ${await size('ty_arr_gin')}`);
  [node, t] = await plan1(`SELECT count(*) FROM ty_arr WHERE 't42' = ANY(tags)`);
  console.log(`= ANY() with the same index: ${node} ${t} ms  <- ANY does NOT use GIN`);

  console.log('unnest to rows:', JSON.stringify((await q(
    `SELECT tag, count(*)::int AS n FROM ty_arr, unnest(tags) tag
     WHERE id <= 1000 GROUP BY tag ORDER BY n DESC LIMIT 3`)).rows));
  await tryq('a foreign key from an array element', `CREATE TABLE ty_arr_fk (ids int[] REFERENCES ty_arr(id))`);
}

// --- 11. enum vs CHECK vs lookup -------------------------------------------
line('11. enum vs CHECK vs lookup table');
{
  await q(`DROP TABLE IF EXISTS ty_enum, ty_check, ty_lookup_use, ty_lookup CASCADE`);
  await q(`DROP TYPE IF EXISTS ty_status`);
  await q(`CREATE TYPE ty_status AS ENUM ('open','paid','shipped')`);
  await q(`CREATE TABLE ty_enum (id int, s ty_status)`);
  await q(`CREATE TABLE ty_check (id int, s text CHECK (s IN ('open','paid','shipped')))`);
  await q(`CREATE TABLE ty_lookup (code text PRIMARY KEY, label text)`);
  await q(`INSERT INTO ty_lookup VALUES ('open','Open'),('paid','Paid'),('shipped','Shipped')`);
  await q(`CREATE TABLE ty_lookup_use (id int, s text REFERENCES ty_lookup(code))`);
  for (const t of ['ty_enum', 'ty_check', 'ty_lookup_use']) {
    await q(`INSERT INTO ${t} SELECT g, (ARRAY['open','paid','shipped'])[1+(g%3)]::${t === 'ty_enum' ? 'ty_status' : 'text'}
             FROM generate_series(1,200000) g`);
    await q(`VACUUM ANALYZE ${t}`);
  }
  console.log('sizes:', (await Promise.all(['ty_enum','ty_check','ty_lookup_use'].map(async t => `${t} ${await size(t)}`))).join(' | '));
  console.log('storage per value:', JSON.stringify((await q(
    `SELECT pg_column_size('open'::ty_status) AS enum_b, pg_column_size('open'::text) AS text_b`)).rows[0]));

  await tryq('insert a value not in the enum', `INSERT INTO ty_enum VALUES (0,'cancelled')`);
  await tryq('insert a value not in the CHECK', `INSERT INTO ty_check VALUES (0,'cancelled')`);
  await tryq('insert a value not in the lookup', `INSERT INTO ty_lookup_use VALUES (0,'cancelled')`);

  // adding a value to each
  let t0 = process.hrtime.bigint();
  await q(`ALTER TYPE ty_status ADD VALUE 'cancelled'`);
  console.log(`ALTER TYPE ... ADD VALUE            : ${ms(t0)} ms`);
  t0 = process.hrtime.bigint();
  await q(`ALTER TABLE ty_check DROP CONSTRAINT ty_check_s_check`);
  await q(`ALTER TABLE ty_check ADD CONSTRAINT ty_check_s_check CHECK (s IN ('open','paid','shipped','cancelled'))`);
  console.log(`DROP + ADD CHECK (validates the table): ${ms(t0)} ms`);
  t0 = process.hrtime.bigint();
  await q(`INSERT INTO ty_lookup VALUES ('cancelled','Cancelled')`);
  console.log(`INSERT into the lookup table         : ${ms(t0)} ms`);

  await tryq('remove a value from an enum', `ALTER TYPE ty_status DROP VALUE 'cancelled'`);
  await tryq('rename an enum value', `ALTER TYPE ty_status RENAME VALUE 'paid' TO 'settled'`);
  console.log('enum sorts in declaration order, not alphabetically:', JSON.stringify((await q(
    `SELECT array_agg(DISTINCT s ORDER BY s) AS enum_order FROM ty_enum`)).rows[0]));
  console.log('the same values as text sort alphabetically      :', JSON.stringify((await q(
    `SELECT array_agg(DISTINCT s ORDER BY s) AS text_order FROM ty_check`)).rows[0]));
  await tryq('compare an enum against text directly', `SELECT count(*) FROM ty_enum WHERE s = 'open'`);
  await tryq('ADD VALUE inside a transaction, then use it',
    `DO $$ BEGIN ALTER TYPE ty_status ADD VALUE 'held'; PERFORM 'held'::ty_status; END $$`);
}

// --- 12. casting ------------------------------------------------------------
line('12. casting — the three kinds, and the one that kills an index');
{
  await q(`DROP TABLE IF EXISTS ty_cast`);
  await q(`CREATE TABLE ty_cast (id bigint PRIMARY KEY, acct text, n int, created timestamptz)`);
  await q(`INSERT INTO ty_cast SELECT g, g::text, g, now() - (g || ' seconds')::interval
           FROM generate_series(1,400000) g`);
  await q(`CREATE INDEX ON ty_cast (acct)`);
  await q(`CREATE INDEX ON ty_cast (created)`);
  await q(`VACUUM ANALYZE ty_cast`);

  let [node, t] = await plan1(`SELECT count(*) FROM ty_cast WHERE acct = '12345'`);
  console.log(`acct = '12345'          : ${node} ${t} ms`);
  [node, t] = await plan1(`SELECT count(*) FROM ty_cast WHERE acct::bigint = 12345`);
  console.log(`acct::bigint = 12345    : ${node} ${t} ms  <- cast on the COLUMN`);
  await tryq('acct = 12345 with no cast at all', `SELECT count(*) FROM ty_cast WHERE acct = 12345`);
  [node, t] = await plan1(`SELECT count(*) FROM ty_cast WHERE created > now() - interval '1 hour'`);
  console.log(`created > now() - 1h    : ${node} ${t} ms`);
  [node, t] = await plan1(`SELECT count(*) FROM ty_cast WHERE created::date = current_date`);
  console.log(`created::date = today   : ${node} ${t} ms  <- cast on the COLUMN`);

  console.log('implicit vs explicit:', JSON.stringify((await q(
    `SELECT (1 + 1.5) AS int_plus_numeric, pg_typeof(1 + 1.5)::text AS result_type,
            ('5' || 5) AS text_concat_int, pg_typeof(5::text)::text AS cast_type`)).rows[0]));
  await tryq(`'abc'::int`, `SELECT 'abc'::int AS v`);
  await tryq(`'  42  '::int (whitespace)`, `SELECT '  42  '::int AS v`);
  await tryq(`'42.7'::int`, `SELECT '42.7'::int AS v`);
  await tryq(`42.7::int (rounds)`, `SELECT 42.7::int AS v`);
  await tryq(`'2026-13-01'::date`, `SELECT '2026-13-01'::date AS v`);
  console.log('cast styles are equivalent:', JSON.stringify((await q(
    `SELECT '42'::int AS pg_style, CAST('42' AS int) AS sql_style, int4('42') AS function_style`)).rows[0]));
}

// --- 13. bytea --------------------------------------------------------------
line('13. bytea');
{
  await q(`DROP TABLE IF EXISTS ty_bin`);
  await q(`CREATE TABLE ty_bin (id int PRIMARY KEY, data bytea)`);
  const buf = Buffer.alloc(100 * 1024, 7);
  await q(`INSERT INTO ty_bin VALUES (1, $1)`, [buf]);
  const back = await q(`SELECT data, length(data) AS len, pg_column_size(data) AS stored,
                               octet_length(data) AS octets, substring(data from 1 for 4) AS first4
                        FROM ty_bin WHERE id = 1`);
  const r = back.rows[0];
  console.log(`sent ${buf.length} bytes -> length ${r.len}, pg_column_size ${r.stored} (TOAST compressed),`,
    `back as ${Buffer.isBuffer(r.data) ? 'Buffer' : typeof r.data} of ${r.data.length} bytes,`,
    `round trip identical: ${buf.equals(r.data)}`);
  console.log('hex format:', JSON.stringify((await q(
    `SELECT encode('\\x48690a'::bytea, 'hex') AS hex, encode('\\x48690a'::bytea,'base64') AS b64,
            decode('4869','hex')::text AS decoded, '\\x4869'::bytea::text AS as_text`)).rows[0]));
  console.log('text over the wire is ~2x:', JSON.stringify((await q(
    `SELECT length('\\x4869'::bytea::text) AS text_len, octet_length('\\x4869'::bytea) AS real_len`)).rows[0]));
  console.log('storage strategy:', JSON.stringify((await q(
    `SELECT attstorage FROM pg_attribute WHERE attrelid='ty_bin'::regclass AND attname='data'`)).rows[0]));
}

// --- 14. network, geometric, citext ----------------------------------------
line('14. inet/cidr, macaddr, point, citext');
{
  console.log('inet vs cidr:', JSON.stringify((await q(
    `SELECT '192.168.1.10/24'::inet AS inet_keeps_host,
            '192.168.1.0/24'::cidr AS cidr_network,
            masklen('192.168.1.10/24'::inet) AS masklen,
            host('192.168.1.10/24'::inet) AS host,
            ('192.168.1.10'::inet << '192.168.1.0/24'::cidr) AS is_inside,
            ('10.0.0.1'::inet << '192.168.1.0/24'::cidr) AS outside,
            pg_column_size('192.168.1.10'::inet) AS inet_b,
            pg_column_size('192.168.1.10'::text) AS text_b`)).rows[0]));
  await tryq(`'192.168.1.10/24'::cidr (host bits set)`, `SELECT '192.168.1.10/24'::cidr AS v`);
  await tryq(`'999.1.1.1'::inet`, `SELECT '999.1.1.1'::inet AS v`);
  console.log('ipv6 and macaddr:', JSON.stringify((await q(
    `SELECT '2001:db8::1'::inet AS v6, pg_column_size('2001:db8::1'::inet) AS v6_b,
            '08:00:2b:01:02:03'::macaddr AS mac, '08:00:2b:01:02:03:04:05'::macaddr8 AS mac8`)).rows[0]));
  console.log('geometric:', JSON.stringify((await q(
    `SELECT point(1,2) AS p, (point(0,0) <-> point(3,4)) AS distance,
            box '((0,0),(2,2))' AS b, (box '((0,0),(2,2))' @> point(1,1)) AS box_contains`)).rows[0]));

  await tryq('CREATE EXTENSION citext', `CREATE EXTENSION IF NOT EXISTS citext`);
  await q(`DROP TABLE IF EXISTS ty_ci`);
  await q(`CREATE TABLE ty_ci (e citext UNIQUE, t text)`);
  await q(`INSERT INTO ty_ci VALUES ('User@Example.com','User@Example.com')`);
  console.log('citext:', JSON.stringify((await q(
    `SELECT (e = 'user@example.com') AS citext_matches, (t = 'user@example.com') AS text_matches FROM ty_ci`)).rows[0]));
  await tryq('insert a case-variant into a citext UNIQUE', `INSERT INTO ty_ci VALUES ('USER@EXAMPLE.COM','x')`);
  console.log('the alternative without citext:', JSON.stringify((await q(
    `SELECT (lower('User@Example.com') = lower('user@example.com')) AS lower_matches`)).rows[0]));
}

// --- 15. domains and composite types ---------------------------------------
line('15. domains and composite types');
{
  await q(`DROP TABLE IF EXISTS ty_dom`);
  await q(`DROP DOMAIN IF EXISTS ty_email CASCADE`);
  await q(`DROP TYPE IF EXISTS ty_addr CASCADE`);
  await q(`CREATE DOMAIN ty_email AS citext
           CHECK (VALUE ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$')`);
  await q(`CREATE TYPE ty_addr AS (street text, city text, postcode text)`);
  await q(`CREATE TABLE ty_dom (id int PRIMARY KEY, email ty_email NOT NULL, addr ty_addr)`);
  await q(`INSERT INTO ty_dom VALUES (1, 'a@b.com', ROW('1 High St','London','E1 6AN')::ty_addr)`);
  console.log('composite access:', JSON.stringify((await q(
    `SELECT email::text AS email, (addr).city AS city, (addr).postcode AS postcode, addr::text AS whole
     FROM ty_dom`)).rows[0]));
  await tryq('a value failing the domain CHECK', `INSERT INTO ty_dom VALUES (2, 'not-an-email', NULL)`);
  await tryq('the domain still inherits citext case-insensitivity',
    `SELECT ('A@B.com'::ty_email = 'a@b.com'::ty_email) AS eq`);
  await tryq('NOT NULL on a domain vs on a column', `INSERT INTO ty_dom VALUES (3, NULL, NULL)`);
  console.log('composite in JS:', JSON.stringify((await q(`SELECT addr FROM ty_dom WHERE id=1`)).rows[0]));
  await tryq('adding a CHECK to a domain in use',
    `ALTER DOMAIN ty_email ADD CONSTRAINT no_test CHECK (VALUE !~ '@test\\.')`);
}

// --- 16. range types --------------------------------------------------------
line('16. ranges and exclusion constraints');
{
  console.log('range basics:', JSON.stringify((await q(
    `SELECT int4range(1,10) AS half_open, int4range(1,10,'[]')::text AS inclusive,
            upper(int4range(1,10)) AS upper_bound,
            (int4range(1,10) @> 5) AS contains5, (int4range(1,10) @> 10) AS contains10,
            (int4range(1,5) && int4range(4,8)) AS overlaps,
            isempty(int4range(5,5)) AS empty_range,
            pg_column_size(int4range(1,10)) AS bytes`)).rows[0]));

  await q(`DROP TABLE IF EXISTS ty_book`);
  await q(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
  await q(`CREATE TABLE ty_book (
             id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             room int NOT NULL,
             during tstzrange NOT NULL,
             EXCLUDE USING gist (room WITH =, during WITH &&))`);
  await q(`INSERT INTO ty_book (room, during) VALUES (1, tstzrange('2026-06-01 09:00+00','2026-06-01 11:00+00'))`);
  await tryq('an overlapping booking for the same room',
    `INSERT INTO ty_book (room, during) VALUES (1, tstzrange('2026-06-01 10:00+00','2026-06-01 12:00+00'))`);
  await tryq('the same times in a different room',
    `INSERT INTO ty_book (room, during) VALUES (2, tstzrange('2026-06-01 10:00+00','2026-06-01 12:00+00'))`);
  await tryq('a booking that starts exactly when the other ends',
    `INSERT INTO ty_book (room, during) VALUES (1, tstzrange('2026-06-01 11:00+00','2026-06-01 12:00+00'))`);
  console.log('  half-open ranges make back-to-back bookings legal automatically');

  await tryq('union of two ranges with a gap between them',
    `SELECT (int4range(1,5) + int4range(10,15))::text AS v`);
  await tryq('union of two ranges that touch',
    `SELECT (int4range(1,5) + int4range(5,15))::text AS v`);
  console.log('multirange handles the gap:', JSON.stringify((await q(
    `SELECT (int4multirange(int4range(1,5)) + int4multirange(int4range(10,15)))::text AS v,
            (datemultirange(daterange('2026-01-01','2026-02-01')) @> '2026-01-15'::date) AS contains`)).rows[0]));

  const jsr = await q(`SELECT int4range(1,10) AS r, tstzrange(now(), now()+interval '1 day') AS tr`);
  console.log('to JS:', typeof jsr.rows[0].r, JSON.stringify(jsr.rows[0].r));
}

await pool.end();
