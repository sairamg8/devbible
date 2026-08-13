// Phase 12 pages 05-06 — full-text search and pg_trgm: what each one can find,
// what it cannot, and the index each needs.
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
const scanNode = async (sql) => (await q(`EXPLAIN (COSTS OFF) ${sql}`))
  .rows.map((r) => r['QUERY PLAN']).find((l) => /Scan/.test(l)).trim();
const size = async (rel) => (await q(
  `SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;

await q(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

// ===========================================================================
// 05 · FULL-TEXT SEARCH
// ===========================================================================

line('1. what to_tsvector actually produces');
{
  const sentence = 'The running dogs were quickly jumping over the lazy foxes';
  for (const cfg of ['english', 'simple']) {
    const r = await q(`SELECT to_tsvector($1::regconfig, $2)::text AS v`, [cfg, sentence]);
    console.log(`${cfg.padEnd(8)}: ${r.rows[0].v}`);
  }
  console.log('↑ english stems (running→run, foxes→fox) and drops stop words (the, were, over)');
  console.log('  simple lowercases and keeps everything, including "the"');

  const one = await q(`SELECT to_tsvector($1) IS NOT NULL AS ok`, [sentence]);
  console.log('\nthe one-argument form works in a query:', one.rows[0].ok);
  console.log('default_text_search_config =',
    (await q(`SHOW default_text_search_config`)).rows[0].default_text_search_config);
}

line('2. the four query parsers, on the same user input');
{
  const input = 'running foxes';
  for (const fn of ['to_tsquery', 'plainto_tsquery', 'phraseto_tsquery', 'websearch_to_tsquery']) {
    try {
      const r = await q(`SELECT ${fn}('english', $1)::text AS v`, [input]);
      console.log(`${fn.padEnd(22)} '${input}' → ${r.rows[0].v}`);
    } catch (e) { console.log(`${fn.padEnd(22)} → ${e.code} ${e.message}`); }
  }
  console.log('');
  // what happens when raw user input reaches to_tsquery
  for (const raw of ['fox & dog', 'fox dog', 'cheap "red shoes" -blue', "it's a fox!"]) {
    for (const fn of ['to_tsquery', 'websearch_to_tsquery']) {
      try {
        const r = await q(`SELECT ${fn}('english', $1)::text AS v`, [raw]);
        console.log(`${fn.padEnd(22)} ${JSON.stringify(raw).padEnd(24)} → ${r.rows[0].v}`);
      } catch (e) {
        console.log(`${fn.padEnd(22)} ${JSON.stringify(raw).padEnd(24)} → ${e.code} ${e.message.split('\n')[0]}`);
      }
    }
  }
  console.log('↑ to_tsquery raises on ordinary user text; websearch_to_tsquery never does');
}

// --- the corpus ------------------------------------------------------------
const N = 200_000;
const NOUNS = ['fox', 'dog', 'shoe', 'lamp', 'chair', 'router', 'keyboard', 'bottle',
  'jacket', 'camera', 'monitor', 'blanket', 'kettle', 'printer', 'speaker'];
const ADJS = ['red', 'quick', 'lazy', 'wireless', 'wooden', 'heavy', 'compact',
  'vintage', 'portable', 'stainless'];
await q(`DROP TABLE IF EXISTS fts_products`);
await q(`CREATE TABLE fts_products (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  body  text NOT NULL)`);
await q(`INSERT INTO fts_products (title, body)
         SELECT ($1::text[])[1 + (g % 10)] || ' ' || ($2::text[])[1 + (g % 15)] || ' ' || g,
                'This ' || ($2::text[])[1 + (g % 15)] || ' is ' ||
                ($1::text[])[1 + ((g / 3) % 10)] ||
                ' and works well for running and jumping. Item ' || g
           FROM generate_series(1,$3) g`, [ADJS, NOUNS, N]);
// a few rows with a deliberate misspelling, for the trigram comparison
await q(`INSERT INTO fts_products (title, body) VALUES
  ('wireles routr special', 'a deliberately misspelled wireles routr for fuzzy matching'),
  ('wireless router special', 'a correctly spelled wireless router')`);
await q(`ANALYZE fts_products`);
console.log(`\nseeded ${N + 2} products`);

line('3. searching without an index');
{
  const sql = `SELECT count(*) FROM fts_products
                WHERE to_tsvector('english', body) @@ plainto_tsquery('english','running kettle')`;
  console.log(`no index  ${(await timed(3, () => q(sql))).toFixed(1).padStart(8)} ms  →`, await scanNode(sql));
}

line('4. the IMMUTABLE trap when indexing');
{
  try {
    await q(`CREATE INDEX fts_bad ON fts_products USING gin (to_tsvector(body))`);
    console.log('one-argument to_tsvector indexed → unexpected');
  } catch (e) {
    console.log('CREATE INDEX ... gin (to_tsvector(body)) →', e.code, e.message.split('\n')[0]);
    console.log('  ↑ the one-arg form depends on default_text_search_config, a session setting');
  }
  await q(`CREATE INDEX fts_body_gin ON fts_products USING gin (to_tsvector('english', body))`);
  console.log("with an explicit config it is accepted; index size:", await size('fts_body_gin'));
}

line('5. the same search with the index');
{
  const sql = `SELECT count(*) FROM fts_products
                WHERE to_tsvector('english', body) @@ plainto_tsquery('english','running kettle')`;
  console.log(`GIN index ${(await timed(5, () => q(sql))).toFixed(2).padStart(8)} ms  →`, await scanNode(sql));

  // the index is on the expression — a different config does not match it
  const other = `SELECT count(*) FROM fts_products
                  WHERE to_tsvector('simple', body) @@ plainto_tsquery('simple','running kettle')`;
  console.log(`'simple' config, same index →`, await scanNode(other));
}

line('6. a generated tsvector column instead of an expression index');
{
  await q(`ALTER TABLE fts_products ADD COLUMN tsv tsvector
           GENERATED ALWAYS AS (
             setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
             setweight(to_tsvector('english', coalesce(body ,'')), 'B')) STORED`);
  await q(`CREATE INDEX fts_tsv_gin ON fts_products USING gin (tsv)`);
  await q(`ANALYZE fts_products`);
  const sql = `SELECT count(*) FROM fts_products WHERE tsv @@ plainto_tsquery('english','running kettle')`;
  console.log(`generated column + GIN ${(await timed(5, () => q(sql))).toFixed(2).padStart(8)} ms →`, await scanNode(sql));
  console.log('column size on disk:', await size('fts_products'), '| tsv index:', await size('fts_tsv_gin'));

  const w = await q(`SELECT tsv::text AS v FROM fts_products WHERE title LIKE 'wireless router%' LIMIT 1`);
  console.log('a weighted tsvector:', w.rows[0].v.slice(0, 160), '...');
  console.log('↑ :A came from the title, :B from the body');
}

line('7. ranking');
{
  const r = await q(`
    SELECT title,
           round(ts_rank   (tsv, plainto_tsquery('english','wireless router'))::numeric, 4) AS rank,
           round(ts_rank_cd(tsv, plainto_tsquery('english','wireless router'))::numeric, 4) AS rank_cd
      FROM fts_products
     WHERE tsv @@ plainto_tsquery('english','wireless router')
     ORDER BY rank DESC LIMIT 5`);
  console.table(r.rows);
  const nw = await q(`
    SELECT round(ts_rank(tsv, plainto_tsquery('english','running'))::numeric,6) AS default_rank,
           round(ts_rank(tsv, plainto_tsquery('english','running'), 32)::numeric,6) AS norm_32
      FROM fts_products WHERE tsv @@ plainto_tsquery('english','running') LIMIT 1`);
  console.log('normalization flag 32 (rank/(rank+1)):', nw.rows[0]);
}

line('8. ts_headline for snippets');
{
  const r = await q(`
    SELECT ts_headline('english', body, plainto_tsquery('english','running jumping'),
                       'StartSel=<b>, StopSel=</b>, MaxWords=12, MinWords=5') AS snip
      FROM fts_products WHERE id = 1`);
  console.log(r.rows[0].snip);
  console.log('↑ ts_headline re-reads the original text, so it cannot use the index');
}

line('9. what full-text search cannot do');
{
  for (const [label, term] of [
    ['exact word          ', 'router'],
    ['stemmed variant     ', 'routers'],
    ['misspelling         ', 'routr'],
    ['prefix of a word    ', 'rout'],
  ]) {
    const r = await q(
      `SELECT count(*)::int c FROM fts_products WHERE tsv @@ plainto_tsquery('english', $1)`, [term]);
    console.log(`${label} '${term}' → ${r.rows[0].c} rows`);
  }
  const pre = await q(
    `SELECT count(*)::int c FROM fts_products WHERE tsv @@ to_tsquery('english', 'rout:*')`);
  console.log(`prefix query 'rout:*'  → ${pre.rows[0].c} rows  ← :* is how prefixes are done`);
}

// ===========================================================================
// 06 · pg_trgm
// ===========================================================================

line('10. trigrams, similarity and distance');
{
  const r = await q(`SELECT show_trgm('router')::text AS t`);
  console.log("show_trgm('router') →", r.rows[0].t);
  const pairs = [['router', 'router'], ['router', 'routr'], ['router', 'routers'],
    ['router', 'route'], ['router', 'kettle'], ['wireless router', 'wireles routr']];
  for (const [a, b] of pairs) {
    const s = await q(
      `SELECT round(similarity($1,$2)::numeric,3) AS sim,
              round(($1 <-> $2)::numeric,3)       AS dist,
              round(word_similarity($1,$2)::numeric,3) AS word_sim`, [a, b]);
    console.log(`${a.padEnd(16)} vs ${b.padEnd(16)} sim=${s.rows[0].sim} dist=${s.rows[0].dist} word_sim=${s.rows[0].word_sim}`);
  }
  console.log('\npg_trgm.similarity_threshold =',
    (await q(`SHOW pg_trgm.similarity_threshold`)).rows[0]['pg_trgm.similarity_threshold'],
    '← what the % operator uses');
}

line('11. % compares WHOLE strings — the trap');
{
  const target = 'wireles routr special';
  const s = await q(`
    SELECT round(similarity('routr', $1)::numeric,3)      AS whole_string,
           round(word_similarity('routr', $1)::numeric,3) AS word_level`, [target]);
  console.log(`query 'routr' vs title '${target}':`, s.rows[0]);
  console.log('thresholds → similarity:',
    (await q(`SHOW pg_trgm.similarity_threshold`)).rows[0]['pg_trgm.similarity_threshold'],
    '| word_similarity:',
    (await q(`SHOW pg_trgm.word_similarity_threshold`)).rows[0]['pg_trgm.word_similarity_threshold']);

  const pctOp  = await q(`SELECT count(*)::int c FROM fts_products WHERE title % 'routr'`);
  const wordOp = await q(`SELECT count(*)::int c FROM fts_products WHERE 'routr' <% title`);
  console.log(`\ntitle %  'routr'   (whole-string) → ${pctOp.rows[0].c} rows`);
  console.log(`'routr' <% title    (word-level)  → ${wordOp.rows[0].c} rows`);
  console.log("↑ % scores the query against the ENTIRE title, so one word inside a long");
  console.log('  title scores below the threshold. <% scores against the best word.');

  const best = await q(`
    SELECT title, round(similarity(title,'wireles routr')::numeric,3) AS sim
      FROM fts_products ORDER BY title <-> 'wireles routr' LIMIT 3`);
  console.table(best.rows);
}

line('12. the cost, and the index that fixes it');
{
  const sim  = `SELECT count(*) FROM fts_products WHERE title % 'routr'`;
  const like = `SELECT count(*) FROM fts_products WHERE title ILIKE '%routr%'`;
  console.log(`% similarity, no trgm index ${(await timed(3, () => q(sim))).toFixed(1).padStart(8)} ms →`, await scanNode(sim));
  console.log(`ILIKE '%routr%', no index   ${(await timed(3, () => q(like))).toFixed(1).padStart(8)} ms →`, await scanNode(like));

  await q(`CREATE INDEX fts_title_trgm ON fts_products USING gin (title gin_trgm_ops)`);
  await q(`ANALYZE fts_products`);
  console.log(`% similarity, GIN trgm      ${(await timed(5, () => q(sim))).toFixed(2).padStart(8)} ms →`, await scanNode(sim));
  console.log(`ILIKE '%routr%', GIN trgm   ${(await timed(5, () => q(like))).toFixed(2).padStart(8)} ms →`, await scanNode(like));
  console.log('trgm index size:', await size('fts_title_trgm'), '| fts tsv index:', await size('fts_tsv_gin'));

  // ordering by distance needs GiST, not GIN
  const ord = `SELECT title FROM fts_products ORDER BY title <-> 'wireles routr' LIMIT 5`;
  console.log(`\nORDER BY <-> with GIN only  →`, await scanNode(ord));
  await q(`CREATE INDEX fts_title_trgm_gist ON fts_products USING gist (title gist_trgm_ops)`);
  await q(`ANALYZE fts_products`);
  console.log(`ORDER BY <-> with GiST      →`, await scanNode(ord));
  console.log(`  ${(await timed(3, () => q(ord))).toFixed(1)} ms | gist size:`, await size('fts_title_trgm_gist'));
}

line("13. each one failing at the other's job");
{
  // the honest test: the user types the CORRECT spelling; one document is misspelled
  const misspelled = `title = 'wireles routr special'`;
  const ftsCorrect = await q(`
    SELECT count(*)::int c FROM fts_products
     WHERE ${misspelled} AND tsv @@ plainto_tsquery('english','router')`);
  const trgCorrect = await q(`
    SELECT count(*)::int c FROM fts_products
     WHERE ${misspelled} AND 'router' <% title`);
  const trgScore = await q(`
    SELECT round(word_similarity('router', title)::numeric,3) AS ws
      FROM fts_products WHERE ${misspelled}`);
  console.log("user types 'router'; the document says 'routr':");
  console.log(`  full-text @@  → ${ftsCorrect.rows[0].c} rows`);
  console.log(`  trigram   <%  → ${trgCorrect.rows[0].c} rows  (word_similarity = ${trgScore.rows[0].ws}, threshold 0.6)`);
  console.log('  ↑ the DEFAULT threshold is too strict for this typo. Lowering it:');
  const c = await pool.connect();
  for (const th of [0.6, 0.55, 0.5, 0.4]) {
    await c.query(`SET pg_trgm.word_similarity_threshold = ${th}`);
    const hit = await c.query(`
      SELECT count(*)::int c FROM fts_products
       WHERE ${misspelled} AND 'router' <% title`);
    const noise = await c.query(
      `SELECT count(*)::int c FROM fts_products WHERE 'router' <% title`);
    console.log(`    threshold ${th} → misspelled row found: ${hit.rows[0].c ? 'YES' : 'no '} · total rows matched: ${noise.rows[0].c}`);
  }
  await c.query(`RESET pg_trgm.word_similarity_threshold`);
  c.release();

  // and the reverse: stemming, which trigram has no concept of
  const ftsStem = await q(
    `SELECT count(*)::int c FROM fts_products WHERE tsv @@ plainto_tsquery('english','jumped')`);
  const trgStem = await q(
    `SELECT count(*)::int c FROM fts_products WHERE 'jumped' <% body`);
  console.log("\nuser types 'jumped'; the documents say 'jumping':");
  console.log(`  full-text @@  → ${ftsStem.rows[0].c} rows  (both stem to 'jump')`);
  console.log(`  trigram   <%  → ${trgStem.rows[0].c} rows`);
  console.log('↑ neither is a substitute for the other');
}

await q(`DROP TABLE IF EXISTS fts_products`);
await pool.end();
