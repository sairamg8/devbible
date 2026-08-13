// Phase 2 pages 01-08 — integers, numeric vs float, text types, timestamptz,
// time zones, NULL semantics, uuid, jsonb vs json.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;
const bytes = async (rel) => Number((await q(`SELECT pg_relation_size($1) AS s`, [rel])).rows[0].s);
const tryq = async (label, sql, params) => {
  try { const r = await q(sql, params); console.log(`${label.padEnd(46)} ok  ${JSON.stringify(r.rows[0] ?? {})}`); }
  catch (e) { console.log(`${label.padEnd(46)} ->  ${err(e)}`); }
};

// --- 1. integers ------------------------------------------------------------
line('1. integer widths, their limits, and what happens past them');
{
  const r = await q(`SELECT
      pg_column_size(1::smallint) AS smallint_bytes,
      pg_column_size(1::int)      AS int_bytes,
      pg_column_size(1::bigint)   AS bigint_bytes,
      (-32768)::smallint AS smallint_min, 32767::smallint AS smallint_max,
      (-2147483648)::int AS int_min, 2147483647::int AS int_max,
      9223372036854775807::bigint AS bigint_max`);
  console.log(JSON.stringify(r.rows[0]));

  await tryq('int at its maximum + 1', `SELECT 2147483647::int + 1 AS v`);
  await tryq('smallint from a too-large literal', `SELECT 40000::smallint AS v`);
  await tryq('bigint at its maximum + 1', `SELECT 9223372036854775807::bigint + 1 AS v`);

  // how much does bigint actually cost on disk?
  for (const [t, name] of [['int', 'ty_int'], ['bigint', 'ty_bigint']]) {
    await q(`DROP TABLE IF EXISTS ${name}`);
    await q(`CREATE TABLE ${name} (id ${t} PRIMARY KEY, v ${t} NOT NULL)`);
    await q(`INSERT INTO ${name} SELECT g, g FROM generate_series(1, 500000) g`);
    await q(`VACUUM ANALYZE ${name}`);
    console.log(`500k rows of ${t.padEnd(7)}: table ${await size(name)}, pk index ${await size(name + '_pkey')}`);
  }

  // the int4 primary key that runs out
  await q(`DROP TABLE IF EXISTS ty_seq`);
  await q(`CREATE TABLE ty_seq (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v text)`);
  await q(`SELECT setval(pg_get_serial_sequence('ty_seq','id'), 2147483646)`);
  await q(`INSERT INTO ty_seq (v) VALUES ('last one')`);
  await tryq('identity int past 2147483647', `INSERT INTO ty_seq (v) VALUES ('one too many') RETURNING id`);
}

// --- 2. numeric vs float ----------------------------------------------------
line('2. numeric vs double precision — money, and why');
{
  const r = await q(`SELECT
      0.1::float8 + 0.2::float8            AS float_sum,
      (0.1::float8 + 0.2::float8) = 0.3    AS float_equals_point3,
      0.1::numeric + 0.2::numeric          AS numeric_sum,
      (0.1::numeric + 0.2::numeric) = 0.3  AS numeric_equals_point3`);
  console.log(JSON.stringify(r.rows[0]));

  // accumulate a price 1000 times
  const acc = await q(`
    SELECT sum(v::float8)::text AS float_total, sum(v::numeric)::text AS numeric_total
    FROM (SELECT 0.01 AS v FROM generate_series(1,1000)) s`);
  console.log('1000 x 0.01 summed:', JSON.stringify(acc.rows[0]));

  await tryq('numeric(10,2) given 12345678901', `SELECT 12345678901::numeric(10,2) AS v`);
  console.log('rounding:', JSON.stringify((await q(
    `SELECT 2.5::numeric(2,0) AS num_half, 2.5::float8::int AS float_half,
            1.005::numeric(4,2) AS num_1005, round(1.005::float8::numeric, 2) AS float_1005`)).rows[0]));

  // what each arrives as in JS
  const js = await q(`SELECT 1.1::numeric AS n, 1.1::float8 AS f, 1.1::float4 AS r,
                             9007199254740993::bigint AS big, 42::int AS i`);
  const row = js.rows[0];
  console.log('JS types:', Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, `${typeof v} ${JSON.stringify(v)}`])));

  // arithmetic cost
  await q(`DROP TABLE IF EXISTS ty_money`);
  await q(`CREATE TABLE ty_money (n numeric(12,2), f float8, c bigint)`);
  await q(`INSERT INTO ty_money SELECT g/100.0, g/100.0, g FROM generate_series(1,300000) g`);
  for (const col of ['n', 'f', 'c']) {
    const t0 = process.hrtime.bigint();
    await q(`SELECT sum(${col} * 3 + 1) FROM ty_money`);
    console.log(`sum over 300k ${col === 'n' ? 'numeric(12,2)' : col === 'f' ? 'float8       ' : 'bigint cents '}: ${ms(t0)} ms`);
  }
  console.log('storage:', JSON.stringify((await q(
    `SELECT pg_column_size(1234.56::numeric(12,2)) AS numeric_b,
            pg_column_size(1234.56::float8) AS float8_b,
            pg_column_size(123456::bigint) AS bigint_b`)).rows[0]));
}

// --- 3. text vs varchar vs char --------------------------------------------
line('3. text, varchar(n) and char(n)');
{
  await q(`DROP TABLE IF EXISTS ty_text`);
  await q(`CREATE TABLE ty_text (t text, v varchar(50), c char(50))`);
  await q(`INSERT INTO ty_text VALUES ('abc','abc','abc')`);
  console.log('stored:', JSON.stringify((await q(
    `SELECT t, v, c, length(t) AS t_len, length(v) AS v_len, length(c) AS c_len,
            pg_column_size(t) AS t_bytes, pg_column_size(v) AS v_bytes, pg_column_size(c) AS c_bytes,
            (c = 'abc') AS char_equals_abc, ('abc' || c || '|') AS char_concat
     FROM ty_text`)).rows[0]));

  // the cast truncates silently; the COLUMN rejects. Both matter.
  console.log('CAST to varchar(50) of 60 chars  ->', 'length',
    (await q(`SELECT length(repeat('x',60)::varchar(50)) AS l`)).rows[0].l, '(silently truncated)');
  await tryq('INSERT 60 chars into a varchar(50) col', `INSERT INTO ty_text (v) VALUES (repeat('x',60))`);
  await tryq('INSERT 60 chars into the text col', `INSERT INTO ty_text (t) VALUES (repeat('x',60)) RETURNING length(t) AS len`);
  await tryq('char(50) compared ignoring trailing spaces',
    `SELECT ('abc'::char(50) = 'abc'::char(50)) AS eq, ('abc '::text = 'abc'::text) AS text_eq`);

  // is varchar(n) faster than text?
  for (const [t, name] of [['text', 'ty_s_text'], ['varchar(50)', 'ty_s_vc'], ['char(50)', 'ty_s_ch']]) {
    await q(`DROP TABLE IF EXISTS ${name}`);
    await q(`CREATE TABLE ${name} (v ${t})`);
    await q(`INSERT INTO ${name} SELECT 'value-'||g FROM generate_series(1,300000) g`);
    await q(`VACUUM ANALYZE ${name}`);
    const t0 = process.hrtime.bigint();
    await q(`SELECT count(*) FROM ${name} WHERE v = 'value-200000'`);
    console.log(`${t.padEnd(12)}: ${(await size(name)).padStart(7)}, equality scan ${ms(t0)} ms`);
  }

  // widening a varchar vs a text column
  await q(`DROP TABLE IF EXISTS ty_alter`);
  await q(`CREATE TABLE ty_alter (a varchar(20), b text)`);
  await q(`INSERT INTO ty_alter SELECT 'x'||g, 'y'||g FROM generate_series(1,200000) g`);
  let t0 = process.hrtime.bigint();
  await q(`ALTER TABLE ty_alter ALTER COLUMN a TYPE varchar(40)`);
  console.log(`widen varchar(20)->varchar(40): ${ms(t0)} ms`);
  t0 = process.hrtime.bigint();
  await q(`ALTER TABLE ty_alter ALTER COLUMN a TYPE varchar(10) USING left(a,10)`);
  console.log(`narrow varchar(40)->varchar(10): ${ms(t0)} ms (rewrites)`);
}

// --- 4/5. timestamptz, timestamp and time zones -----------------------------
line('4. timestamptz vs timestamp — what is actually stored');
{
  console.log('server TimeZone:', (await q(`SHOW TimeZone`)).rows[0].TimeZone,
    '| client TZ:', process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

  await q(`DROP TABLE IF EXISTS ty_time`);
  await q(`CREATE TABLE ty_time (tz timestamptz, notz timestamp, d date)`);
  await q(`INSERT INTO ty_time VALUES
             ('2026-06-15 10:00:00+05:30', '2026-06-15 10:00:00+05:30', '2026-06-15')`);
  console.log('sizes:', JSON.stringify((await q(
    `SELECT pg_column_size(tz) AS tz_b, pg_column_size(notz) AS notz_b, pg_column_size(d) AS d_b FROM ty_time`)).rows[0]));

  for (const zone of ['UTC', 'Asia/Kolkata', 'America/New_York']) {
    const c = await pool.connect();
    await c.query(`SET TIME ZONE '${zone}'`);
    const r = await c.query(`SELECT tz::text AS tz, notz::text AS notz FROM ty_time`);
    console.log(`displayed in ${zone.padEnd(17)}: timestamptz ${r.rows[0].tz.padEnd(28)} timestamp ${r.rows[0].notz}`);
    await c.query('RESET ALL');
    c.release();
  }
  console.log('  the timestamptz value moved with the session zone; the timestamp did not');

  // AT TIME ZONE both directions
  console.log('AT TIME ZONE:', JSON.stringify((await q(
    `SELECT (timestamptz '2026-06-15 10:00:00+00' AT TIME ZONE 'Asia/Kolkata')::text AS tz_to_local,
            (timestamp   '2026-06-15 10:00:00'    AT TIME ZONE 'Asia/Kolkata')::text AS local_to_tz`)).rows[0]));

  // the three "now"s
  const c = await pool.connect();
  await c.query('BEGIN');
  const n1 = await c.query(`SELECT now()::text AS now, statement_timestamp()::text AS stmt, clock_timestamp()::text AS clock`);
  await new Promise(r => setTimeout(r, 200));
  const n2 = await c.query(`SELECT now()::text AS now, statement_timestamp()::text AS stmt, clock_timestamp()::text AS clock`);
  console.log('now() 200ms apart in one tx  :', n1.rows[0].now === n2.rows[0].now ? 'IDENTICAL' : 'changed');
  console.log('clock_timestamp() 200ms apart:', n1.rows[0].clock === n2.rows[0].clock ? 'identical' : 'CHANGED');
  await c.query('COMMIT'); c.release();

  // DST
  console.log('DST arithmetic:', JSON.stringify((await q(
    `SELECT (timestamptz '2026-03-08 01:30:00 America/New_York' + interval '1 hour')::text AS plus_1h,
            (timestamptz '2026-03-08 01:30:00 America/New_York' + interval '1 day')::text  AS plus_1d,
            (timestamptz '2026-03-08 01:30:00 America/New_York' + interval '24 hours')::text AS plus_24h`)).rows[0]));

  // the session zone decides which DAY a timestamptz falls in
  await q(`DROP TABLE IF EXISTS ty_events`);
  await q(`CREATE TABLE ty_events (at timestamptz)`);
  await q(`INSERT INTO ty_events VALUES ('2026-06-15 21:00:00+00'), ('2026-06-15 23:30:00+00')`);
  for (const zone of ['UTC', 'Asia/Kolkata']) {
    const cc = await pool.connect();
    await cc.query(`SET TIME ZONE '${zone}'`);
    const g = await cc.query(`SELECT date_trunc('day', at)::text AS day, count(*)::int AS n
                              FROM ty_events GROUP BY 1 ORDER BY 1`);
    console.log(`GROUP BY day in ${zone.padEnd(13)}:`, JSON.stringify(g.rows));
    const cd = await cc.query(`SELECT current_date::text AS d, (at::date)::text AS cast_date FROM ty_events LIMIT 1`);
    console.log(`  current_date ${cd.rows[0].d}, first event at::date ${cd.rows[0].cast_date}`);
    await cc.query('RESET ALL'); cc.release();
  }
  console.log('  same two rows, different day buckets and counts - the session zone decided');

  // what pg gives JS
  const jsr = await q(`SELECT tz, notz, d FROM ty_time`);
  console.log('to JS:', JSON.stringify(Object.fromEntries(
    Object.entries(jsr.rows[0]).map(([k, v]) => [k, v instanceof Date ? `Date ${v.toISOString()}` : `${typeof v} ${v}`]))));
}

// --- 6. NULL ----------------------------------------------------------------
line('6. NULL — three-valued logic');
{
  console.log(JSON.stringify((await q(`SELECT
      (NULL = NULL)      AS eq_null,
      (NULL <> NULL)     AS ne_null,
      (NULL IS NULL)     AS is_null,
      (NULL IS NOT DISTINCT FROM NULL) AS not_distinct,
      (1 IN (1, NULL))   AS in_with_null,
      (2 IN (1, NULL))   AS in_no_match_null,
      (2 NOT IN (1, NULL)) AS not_in_with_null,
      (true AND NULL)    AS true_and_null,
      (false AND NULL)   AS false_and_null,
      (true OR NULL)     AS true_or_null`)).rows[0], null, 0));

  await q(`DROP TABLE IF EXISTS ty_null`);
  await q(`CREATE TABLE ty_null (id int, v int, t text)`);
  await q(`INSERT INTO ty_null VALUES (1,10,'a'),(2,NULL,'b'),(3,30,NULL),(4,NULL,NULL)`);
  console.log('aggregates ignore NULL:', JSON.stringify((await q(
    `SELECT count(*) AS count_star, count(v) AS count_v, sum(v) AS sum_v, avg(v)::text AS avg_v,
            coalesce(sum(v),0) AS sum_coalesced FROM ty_null`)).rows[0]));
  console.log('sum over all-NULL       :', JSON.stringify((await q(
    `SELECT sum(v) AS s, count(v) AS c FROM ty_null WHERE v IS NULL`)).rows[0]), '<- sum is NULL, not 0');
  console.log('WHERE v <> 30 skips NULLs:', JSON.stringify((await q(
    `SELECT array_agg(id ORDER BY id) AS ids FROM ty_null WHERE v <> 30`)).rows[0]));
  console.log('WHERE v IS DISTINCT FROM 30:', JSON.stringify((await q(
    `SELECT array_agg(id ORDER BY id) AS ids FROM ty_null WHERE v IS DISTINCT FROM 30`)).rows[0]));

  // unique and NULL
  await q(`DROP TABLE IF EXISTS ty_uniq`);
  await q(`CREATE TABLE ty_uniq (v int UNIQUE)`);
  await q(`INSERT INTO ty_uniq VALUES (NULL),(NULL),(NULL)`);
  console.log('rows in a UNIQUE column, all NULL:', (await q(`SELECT count(*)::int AS n FROM ty_uniq`)).rows[0].n);
  await q(`DROP TABLE IF EXISTS ty_uniq2`);
  await q(`CREATE TABLE ty_uniq2 (v int UNIQUE NULLS NOT DISTINCT)`);
  await q(`INSERT INTO ty_uniq2 VALUES (NULL)`);
  await tryq('second NULL with NULLS NOT DISTINCT', `INSERT INTO ty_uniq2 VALUES (NULL)`);

  console.log('ordering:', JSON.stringify((await q(
    `SELECT array_agg(v ORDER BY v) AS asc_default, array_agg(v ORDER BY v DESC) AS desc_default,
            array_agg(v ORDER BY v NULLS FIRST) AS asc_nulls_first
     FROM ty_null`)).rows[0]));
  console.log("'' is not NULL:", JSON.stringify((await q(
    `SELECT (''::text IS NULL) AS empty_is_null, ('' = NULL) AS empty_eq_null,
            length('') AS len, (NULL || 'x') AS concat_null,
            concat(NULL, 'x') AS concat_fn`)).rows[0]));
}

// --- 7. uuid ----------------------------------------------------------------
line('7. uuid — v4 vs PostgreSQL 18 uuidv7, and the index cost');
{
  const g = await q(`SELECT gen_random_uuid() AS v4, uuidv7() AS v7, uuidv4() AS v4b,
                            uuid_extract_version(uuidv7()) AS v7_version,
                            uuid_extract_timestamp(uuidv7())::text AS v7_time`);
  console.log(JSON.stringify(g.rows[0]));

  const specs = [
    ['bigint identity', 'ty_k_bigint', 'id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY'],
    ['uuid v4       ', 'ty_k_v4', 'id uuid PRIMARY KEY DEFAULT gen_random_uuid()'],
    ['uuid v7       ', 'ty_k_v7', 'id uuid PRIMARY KEY DEFAULT uuidv7()'],
  ];
  for (const [label, name, pk] of specs) {
    await q(`DROP TABLE IF EXISTS ${name}`);
    await q(`CREATE TABLE ${name} (${pk}, payload text NOT NULL)`);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 20; i++) {
      await q(`INSERT INTO ${name} (payload) SELECT repeat('p',40) FROM generate_series(1,10000)`);
    }
    const insMs = ms(t0);
    await q(`VACUUM ANALYZE ${name}`);
    console.log(`${label}: 200k inserts ${insMs.padStart(8)} ms | table ${(await size(name)).padStart(7)} | ` +
      `pk index ${(await size(name + '_pkey')).padStart(7)} (${await bytes(name + '_pkey')} bytes)`);
  }
  console.log('column sizes:', JSON.stringify((await q(
    `SELECT pg_column_size(gen_random_uuid()) AS uuid_b, pg_column_size(1::bigint) AS bigint_b,
            pg_column_size(gen_random_uuid()::text) AS uuid_as_text_b`)).rows[0]));
}

// --- 8. jsonb vs json -------------------------------------------------------
line('8. json vs jsonb');
{
  const src = `{"b": 1, "a": 2, "a": 3,   "nested": {"x": [1,2,3]}}`;
  const r = await q(`SELECT $1::json::text AS as_json, $1::jsonb::text AS as_jsonb,
                            pg_column_size($1::json) AS json_b, pg_column_size($1::jsonb) AS jsonb_b`, [src]);
  console.log('input :', src);
  console.log('json  :', r.rows[0].as_json, `(${r.rows[0].json_b} bytes)`);
  console.log('jsonb :', r.rows[0].as_jsonb, `(${r.rows[0].jsonb_b} bytes)`);
  console.log('  jsonb dropped the duplicate key, reordered, and normalised whitespace');

  await tryq('json = json comparison', `SELECT ('{"a":1}'::json = '{"a":1}'::json) AS eq`);
  await tryq('jsonb = jsonb comparison', `SELECT ('{"a":1}'::jsonb = '{"a":1}'::jsonb) AS eq`);

  await q(`DROP TABLE IF EXISTS ty_json`);
  await q(`CREATE TABLE ty_json (id int, j json, b jsonb)`);
  await q(`INSERT INTO ty_json
           SELECT g, json_build_object('id',g,'tag','t'||(g%100),'meta',json_build_object('n',g)),
                     jsonb_build_object('id',g,'tag','t'||(g%100),'meta',jsonb_build_object('n',g))
           FROM generate_series(1,200000) g`);
  await q(`VACUUM ANALYZE ty_json`);
  console.log('table with both columns:', await size('ty_json'));

  for (const [label, sql] of [
    ['json  ->> filter (no index possible)', `SELECT count(*) FROM ty_json WHERE j->>'tag' = 't42'`],
    ['jsonb ->> filter, no index          ', `SELECT count(*) FROM ty_json WHERE b->>'tag' = 't42'`],
    ['jsonb @> containment, no index      ', `SELECT count(*) FROM ty_json WHERE b @> '{"tag":"t42"}'`],
  ]) {
    const t0 = process.hrtime.bigint();
    await q(sql);
    console.log(`${label}: ${ms(t0)} ms`);
  }
  await q(`CREATE INDEX ty_json_gin ON ty_json USING gin (b)`);
  await q(`ANALYZE ty_json`);
  let t0 = process.hrtime.bigint();
  await q(`SELECT count(*) FROM ty_json WHERE b @> '{"tag":"t42"}'`);
  console.log(`jsonb @> WITH a GIN index           : ${ms(t0)} ms | index ${await size('ty_json_gin')}`);
  await tryq('the same GIN index on the json column', `CREATE INDEX ty_json_gin_j ON ty_json USING gin (j)`);

  // what arrives in JS
  const js = await q(`SELECT j, b FROM ty_json WHERE id = 1`);
  console.log('to JS:', typeof js.rows[0].j, JSON.stringify(js.rows[0].j), '|', typeof js.rows[0].b);
}

await pool.end();
