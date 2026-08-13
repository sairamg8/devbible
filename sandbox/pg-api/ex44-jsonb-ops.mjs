// Phase 12 pages 01-04 — jsonb operators, what each index kind can actually
// serve, and the column-versus-document decision measured.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const timed = async (n, fn) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};
const planLines = async (sql, re = /Scan|Index Cond|Filter|Buffers|Rows Removed|Heap/) =>
  (await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`))
    .rows.map((r) => r['QUERY PLAN']).filter((l) => re.test(l))
    .map((l) => '    ' + l.trim()).join('\n');

// --- 1. every operator, on one document -----------------------------------
line('1. the operator set');
{
  const doc = `{"sku":"a1","qty":3,"tags":["new","sale"],
                "dims":{"w":10,"h":20},"discount":null}`;
  const cases = [
    [`-> 'dims'      (object, returns jsonb)`, `$1::jsonb -> 'dims'`],
    [`->> 'sku'      (text)`,                  `$1::jsonb ->> 'sku'`],
    [`-> 'tags' -> 0 (array element)`,         `$1::jsonb -> 'tags' -> 0`],
    [`->> 'tags'     (whole array as text)`,   `$1::jsonb ->> 'tags'`],
    [`#> '{dims,w}'  (path, jsonb)`,           `$1::jsonb #> '{dims,w}'`],
    [`#>> '{dims,w}' (path, text)`,            `$1::jsonb #>> '{dims,w}'`],
    [`@> '{"qty":3}' (contains)`,              `$1::jsonb @> '{"qty":3}'`],
    [`<@ (is contained by)`,                   `'{"qty":3}'::jsonb <@ $1::jsonb`],
    [`? 'sku'        (key exists)`,            `$1::jsonb ? 'sku'`],
    [`? 'discount'   (key exists, value null)`, `$1::jsonb ? 'discount'`],
    [`?| array['x','sku'] (any key)`,          `$1::jsonb ?| array['x','sku']`],
    [`?& array['sku','qty'] (all keys)`,       `$1::jsonb ?& array['sku','qty']`],
    [`|| (shallow merge)`,                     `$1::jsonb || '{"qty":9}'::jsonb`],
    [`- 'tags'       (remove key)`,            `$1::jsonb - 'tags'`],
    [`#- '{dims,w}'  (remove path)`,           `$1::jsonb #- '{dims,w}'`],
    [`@? '$.dims.w ? (@ > 5)' (path exists)`,  `$1::jsonb @? '$.dims.w ? (@ > 5)'`],
    [`@@ '$.qty == 3' (path predicate)`,       `$1::jsonb @@ '$.qty == 3'`],
  ];
  for (const [label, expr] of cases) {
    const r = await q(`SELECT (${expr})::text AS v`, [doc]);
    console.log(`${label.padEnd(38)} → ${r.rows[0].v}`);
  }
  const jp = await q(
    `SELECT jsonb_path_query_array($1::jsonb, '$.tags[*]')::text AS v`, [doc]);
  console.log(`${'jsonb_path_query_array $.tags[*]'.padEnd(38)} → ${jp.rows[0].v}`);
}

// --- 2. the two kinds of missing ------------------------------------------
line('2. missing key vs JSON null vs SQL NULL');
{
  const r = await q(`
    SELECT ('{"a":null}'::jsonb ->> 'a')       IS NULL AS json_null_is_sqlnull,
           ('{"a":null}'::jsonb ->  'a')::text AS json_null_arrow,
           ('{"a":null}'::jsonb ? 'a')         AS key_exists_when_null,
           ('{}'::jsonb ->> 'a')               IS NULL AS missing_is_sqlnull,
           ('{}'::jsonb ? 'a')                 AS key_exists_when_missing,
           ('{"a":null}'::jsonb @> '{"a":null}') AS contains_null`);
  console.log(r.rows[0]);
  console.log('↑ ->> gives SQL NULL for BOTH a missing key and a JSON null.');
  console.log('  Only ? (or -> returning the text "null") tells them apart.');
}

// --- 3. what each index can serve -----------------------------------------
const N = 200_000;
await q(`DROP TABLE IF EXISTS jb_docs`);
await q(`CREATE TABLE jb_docs (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc  jsonb NOT NULL,
  tag  text NOT NULL,          -- the same value as doc->>'tag', as a column
  qty  int  NOT NULL)`);
await q(`INSERT INTO jb_docs (doc, tag, qty)
         SELECT jsonb_build_object(
                  'tag', 't' || (g % 1000),
                  'qty', g % 50,
                  'name', 'item ' || g,
                  'attrs', jsonb_build_object('color', 'c' || (g % 7), 'w', g % 30)),
                't' || (g % 1000), g % 50
           FROM generate_series(1,$1) g`, [N]);
await q(`VACUUM ANALYZE jb_docs`);
console.log(`\nseeded ${N} rows, 1000 distinct tags (${N / 1000} rows per tag)`);

line('3. GIN jsonb_ops vs jsonb_path_ops vs an expression index');
{
  const sizes = async () => (await q(`
    SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
      FROM pg_stat_user_indexes WHERE relname='jb_docs'
       AND indexrelname LIKE 'jb_%' ORDER BY indexrelname`)).rows;

  const containment = `SELECT count(*) FROM jb_docs WHERE doc @> '{"tag":"t42"}'`;
  const arrowEq     = `SELECT count(*) FROM jb_docs WHERE doc->>'tag' = 't42'`;
  const keyExists   = `SELECT count(*) FROM jb_docs WHERE doc ? 'tag'`;

  console.log('\n-- no index --');
  console.log(`@> containment   ${(await timed(3, () => q(containment))).toFixed(1).padStart(8)} ms`);
  console.log(`->> equality     ${(await timed(3, () => q(arrowEq))).toFixed(1).padStart(8)} ms`);

  await q(`CREATE INDEX jb_gin_default ON jb_docs USING gin (doc)`);
  await q(`ANALYZE jb_docs`);
  console.log('\n-- GIN (default jsonb_ops) --');
  console.log(`@> containment   ${(await timed(5, () => q(containment))).toFixed(1).padStart(8)} ms`);
  console.log(await planLines(containment));
  console.log(`->> equality     ${(await timed(5, () => q(arrowEq))).toFixed(1).padStart(8)} ms`);
  console.log(await planLines(arrowEq));
  console.log(`? key exists     ${(await timed(5, () => q(keyExists))).toFixed(1).padStart(8)} ms`);

  await q(`DROP INDEX jb_gin_default`);
  await q(`CREATE INDEX jb_gin_pathops ON jb_docs USING gin (doc jsonb_path_ops)`);
  await q(`ANALYZE jb_docs`);
  console.log('\n-- GIN (jsonb_path_ops) --');
  console.log(`@> containment   ${(await timed(5, () => q(containment))).toFixed(1).padStart(8)} ms`);
  const ke = await q(`EXPLAIN (COSTS OFF) ${keyExists}`);
  console.log(`? key exists     → ${ke.rows.map((r) => r['QUERY PLAN']).find((l) => /Scan/.test(l)).trim()}`);

  await q(`CREATE INDEX jb_gin_default ON jb_docs USING gin (doc)`);
  await q(`CREATE INDEX jb_expr_tag ON jb_docs ((doc->>'tag'))`);
  await q(`CREATE INDEX jb_col_tag ON jb_docs (tag)`);
  await q(`ANALYZE jb_docs`);
  console.log('\n-- with an expression index on the one hot key --');
  console.log(`->> equality     ${(await timed(5, () => q(arrowEq))).toFixed(1).padStart(8)} ms`);
  console.log(await planLines(arrowEq));

  console.log('\nindex sizes:');
  for (const r of await sizes()) console.log(`  ${r.indexrelname.padEnd(18)} ${r.size}`);
}

// --- 4. the same query against a real column ------------------------------
line('4. jsonb key vs a plain column, same data');
{
  const viaJson = `SELECT count(*) FROM jb_docs WHERE doc->>'tag' = 't42'`;
  const viaCol  = `SELECT count(*) FROM jb_docs WHERE tag = 't42'`;
  console.log(`doc->>'tag' (expression index)  ${(await timed(5, () => q(viaJson))).toFixed(2).padStart(8)} ms`);
  console.log(`tag         (column index)      ${(await timed(5, () => q(viaCol))).toFixed(2).padStart(8)} ms`);

  const rangeJson = `SELECT count(*) FROM jb_docs WHERE (doc->>'qty')::int > 45`;
  const rangeCol  = `SELECT count(*) FROM jb_docs WHERE qty > 45`;
  console.log(`(doc->>'qty')::int > 45         ${(await timed(3, () => q(rangeJson))).toFixed(1).padStart(8)} ms`);
  console.log(`qty > 45                        ${(await timed(3, () => q(rangeCol))).toFixed(1).padStart(8)} ms`);
  console.log('  plan for the jsonb range:');
  console.log(await planLines(rangeJson));

  const st = await q(`
    SELECT pg_size_pretty(sum(pg_column_size(doc))) AS doc_bytes,
           pg_size_pretty(sum(pg_column_size(tag) + pg_column_size(qty))) AS col_bytes
      FROM jb_docs`);
  console.log('\nstorage for the same two facts:', st.rows[0]);
}

// --- 5. what a column can enforce that a document cannot ------------------
line('5. constraints and types');
{
  const tries = [
    ['NOT NULL on a jsonb key',
      `ALTER TABLE jb_docs ADD CONSTRAINT c1 CHECK (doc ? 'tag')`],
    ['a typed CHECK on a jsonb key',
      `ALTER TABLE jb_docs ADD CONSTRAINT c2 CHECK (((doc->>'qty')::int) BETWEEN 0 AND 49)`],
    ['a FOREIGN KEY from a jsonb key',
      `ALTER TABLE jb_docs ADD CONSTRAINT c3 FOREIGN KEY ((doc->>'tag')) REFERENCES jb_docs(id)`],
  ];
  for (const [label, sql] of tries) {
    try { await q(sql); console.log(`${label.padEnd(34)} → OK`); }
    catch (e) { console.log(`${label.padEnd(34)} → ${e.code} ${e.message.split('\n')[0]}`); }
  }
  // and the type looseness
  const t = await q(`
    SELECT jsonb_typeof('{"a":1}'::jsonb->'a')     AS num,
           jsonb_typeof('{"a":"1"}'::jsonb->'a')   AS str,
           ('{"a":1}'::jsonb->>'a') = ('{"a":"1"}'::jsonb->>'a') AS same_as_text`);
  console.log('\n1 vs "1" inside jsonb:', t.rows[0]);
  console.log('↑ ->> flattens both to the text "1" — the distinction survives only via jsonb_typeof');
  await q(`ALTER TABLE jb_docs DROP CONSTRAINT IF EXISTS c1, DROP CONSTRAINT IF EXISTS c2`);
}

// --- 6. building JSON in SQL ----------------------------------------------
line('6. building JSON');
{
  const r = await q(`
    SELECT jsonb_build_object('id', id, 'tag', tag)::text AS build,
           to_jsonb(t)::text                              AS to_jsonb_row,
           row_to_json(t)::text                           AS row_to_json
      FROM (SELECT id, tag, qty FROM jb_docs ORDER BY id LIMIT 1) t`);
  for (const [k, v] of Object.entries(r.rows[0])) console.log(`${k.padEnd(14)} ${v}`);

  const agg = await q(`
    SELECT jsonb_agg(jsonb_build_object('id', id))::text AS a,
           jsonb_object_agg(tag, qty)::text              AS o
      FROM (SELECT id, tag, qty FROM jb_docs ORDER BY id LIMIT 3) t`);
  console.log(`jsonb_agg      ${agg.rows[0].a}`);
  console.log(`jsonb_object_agg ${agg.rows[0].o}`);

  // and the reverse: a document back into rows
  const rs = await q(`
    SELECT * FROM jsonb_to_recordset('[{"a":1,"b":"x"},{"a":2,"b":"y"}]')
                    AS t(a int, b text)`);
  console.log('jsonb_to_recordset →', JSON.stringify(rs.rows));
}

await q(`DROP TABLE IF EXISTS jb_docs`);
await pool.end();
