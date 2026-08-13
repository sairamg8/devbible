import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs/postgresql/pages';
const V = 'Verified: 2026-08 on **PostgreSQL 18.4** / **Node 24** / **`pg`**.';

function w(dir, file, content) {
  fs.mkdirSync(path.join(ROOT, dir), {recursive: true});
  fs.writeFileSync(path.join(ROOT, dir, file), content);
}

function mkPhase(dir, phaseTitle, syllabusLink, rows, gate) {
  rows.forEach((r, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const next = i < rows.length - 1 ? rows[i + 1] : null;
    const label = `${String(i + 1).padStart(2, '0')} · ${r.short || r.title}`.slice(0, 48);
    const iq =
      r.iq ||
      `**★ One-line takeaway?**  
${r.lead}

**Node angle?**  
Issue the same SQL via \`pg\` with \`$1\` placeholders; verify first in \`psql\`.`;
    w(
      dir,
      r.file,
      `---
title: "${r.title}"
sidebar_label: "${label.replace(/"/g, '')}"
sidebar_position: ${i + 1}
---

<span className="db-tier t-${r.tk}">${r.tier}</span>

**${r.lead}**

${r.body}

## Interview questions

${iq}

---

${prev ? `← [${prev.title}](${prev.file})` : `← [Phase index](README.md)`} · ${next ? `Next → [${next.title}](${next.file})` : `[Phase index](README.md)`}
`,
    );
  });
  w(
    dir,
    'README.md',
    `---
title: "${phaseTitle}"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · \`pg\`.**

| # | Page | Tier | In one line |
|---|---|---|---|
${rows
  .map(
    (r, i) =>
      `| ${String(i + 1).padStart(2, '0')} | **[${r.title}](${r.file})** | <span className="db-tier t-${r.tk}">${r.tier}</span> | ${r.one} |`,
  )
  .join('\n')}

## Phase gate

${gate}

---

← Syllabus: [${syllabusLink[0]}](${syllabusLink[1]}) · Start → [${rows[0].title}](${rows[0].file})
`,
  );
  return rows.length;
}

function R(file, title, short, tier, tk, one, lead, body, iq) {
  return {file, title, short, tier, tk, one, lead, body, iq};
}

// Phase 4
const p4 = [
  R('01-select-shape.md','The SELECT shape','SELECT','Master','master','list FROM WHERE ORDER LIMIT',
    'Every read is a SELECT with a stable clause order — learn the shape cold.',
    `\`\`\`sql
SELECT id, email
FROM measure_users
WHERE balance >= 0
ORDER BY id
LIMIT 10;
\`\`\`

## Gotchas

**Symptom:** SELECT * in APIs  
**Cause:** Convenience  
**Fix:** Project only columns the client needs`),
  R('02-where-predicates.md','WHERE predicates','WHERE','Master','master','BETWEEN IN LIKE ILIKE',
    'Filter with predicates you can index; prefer equality and ranges over leading-wildcard LIKE.',
    `Use \`IS DISTINCT FROM\`, \`ILIKE\`, and regex \`~\` carefully. Leading wildcards need trigram/FTS later.

## Gotchas

**Symptom:** Index ignored on search  
**Cause:** \`WHERE col LIKE '%x%'\`  
**Fix:** Phase 10/12 patterns`),
  R('03-limit-offset.md','LIMIT and OFFSET','LIMIT OFFSET','Master','master','OFFSET degrades',
    'OFFSET pagination gets slower as the offset grows; prefer keyset later.',
    `Deep pages still pay for skipped rows. Phase 9 covers keyset pagination.`),
  R('04-insert.md','INSERT','INSERT','Master','master','single multi-row SELECT',
    'INSERT one row, many rows, or INSERT ... SELECT for bulk from a query.',
    `\`\`\`sql
INSERT INTO measure_users (email) VALUES ('d@x.com'), ('e@x.com');
\`\`\``),
  R('05-returning.md','RETURNING','RETURNING','Master','master','ids without second query',
    'RETURNING gives generated columns back in one round trip.',
    `\`\`\`sql
INSERT INTO measure_users (email) VALUES ('f@x.com') RETURNING id, email;
\`\`\`

## From Node

\`const {rows} = await pool.query(sql, [email]);\``),
  R('06-on-conflict.md','ON CONFLICT','ON CONFLICT','Master','master','upsert',
    'ON CONFLICT DO NOTHING/UPDATE is PostgreSQL upsert — name the conflict target.',
    `\`\`\`sql
INSERT INTO measure_users (email) VALUES ('a@x.com')
ON CONFLICT (email) DO UPDATE SET balance = EXCLUDED.balance
RETURNING *;
\`\`\``),
  R('07-update.md','UPDATE','UPDATE','Master','master','SET WHERE FROM RETURNING',
    'Always WHERE; use FROM for join-updates; RETURNING for the new row.',
    `## Gotchas

**Symptom:** Entire table updated  
**Cause:** Missing WHERE  
**Fix:** Require WHERE in reviews; test with RETURNING count`),
  R('08-parameters.md','Parameterized queries','Parameters','Master','master','never string-build values',
    'Never string-build user values into SQL; use $1 placeholders. Driver details in Phase 7.',
    `\`\`\`js
await pool.query('select * from measure_users where email = $1', [email]);
\`\`\`

Identifiers cannot be bound — allowlist sort/filter columns (Phase 9).`),
  R('09-logical-order.md','Logical query processing order','Query order','Understand','understand','FROM before SELECT',
    'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT explains alias failures.',
    `You cannot use a SELECT alias in WHERE — it is not computed yet.`),
  R('10-order-by.md','ORDER BY','ORDER BY','Understand','understand','NULLS FIRST LAST',
    'Stable sorts need explicit columns; NULLS FIRST/LAST control null placement.',
    `Pagination requires deterministic ORDER BY including a unique tie-breaker.`),
  R('11-delete.md','DELETE','DELETE','Understand','understand','soft vs hard',
    'DELETE removes rows; soft delete uses a column — choose deliberately.',
    `RETURNING works on DELETE. Soft delete interacts with UNIQUE and indexes.`),
  R('12-distinct-on.md','DISTINCT and DISTINCT ON','DISTINCT ON','Understand','understand','PostgreSQL DISTINCT ON',
    'DISTINCT ON (expr) picks one row per group — pair with matching ORDER BY.',
    `Powerful and easy to misuse; verify with fixtures.`),
  R('13-merge.md','MERGE','MERGE','Understand','understand','SQL-standard upsert',
    'MERGE is the standard upsert; ON CONFLICT remains idiomatic in many PG apps.',
    `Pick the form that reads clearer for your branches.`),
  R('14-truncate.md','TRUNCATE vs DELETE','TRUNCATE','Understand','understand','speed and FKs',
    'TRUNCATE is bulk-fast; FK and identity restart behavior differ from DELETE.',
    `Common in test cleanup — use CASCADE only with care.`),
  R('15-expressions.md','Expressions and CASE','Expressions','Understand','understand','CASE COALESCE',
    'CASE, COALESCE, GREATEST/LEAST shape projections without app loops.',
    `Keep core business rules centralized — SQL expressions are not a free-for-all.`),
  R('16-string-functions.md','String functions','Strings','Understand','understand','lower trim split_part',
    'lower, trim, substring, split_part, format, concat_ws cover most string shaping.',
    `Pair case-insensitive search with expression indexes (Phase 10).`),
  R('17-datetime-functions.md','Date/time functions','Date functions','Understand','understand','date_trunc extract',
    'date_trunc, age, extract, to_char — and now() is transaction-stable.',
    `Use clock_timestamp() when you need wall time mid-transaction.`),
  R('18-generate-series.md','generate_series and helpers','generate_series','Understand','understand','test data',
    'generate_series builds rows for tests and reports; random() is for fixtures not security.',
    `\`\`\`sql
SELECT * FROM generate_series(1, 3);
\`\`\``),
  R('19-values-unnest.md','VALUES and unnest','VALUES unnest','Understand','understand','bulk param bridge',
    'VALUES and unnest turn arrays into relations — the bridge to bulk insert from Node.',
    `Phase 8 uses unnest($1::text[]) patterns for multi-row inserts.`),
  R('20-tuple-comparison.md','Row constructors and keyset','Tuple compare','Understand','understand','keyset primitive',
    '(created_at, id) < ($1, $2) is the keyset pagination primitive.',
    `Needs a matching composite index (Phases 9–10).`),
];

const p5 = [
  R('01-inner-join.md','INNER JOIN','INNER JOIN','Master','master','mental model',
    'INNER JOIN keeps rows with matches on both sides — the default relationship read.',
    `\`\`\`sql
SELECT u.email, o.total
FROM measure_users u
INNER JOIN measure_orders o ON o.user_id = u.id;
\`\`\``),
  R('02-left-join.md','LEFT JOIN','LEFT JOIN','Master','master','WHERE bug',
    'LEFT JOIN keeps left rows; filtering the right table in WHERE turns it into an inner join.',
    `## Gotchas

**Symptom:** Users without orders disappear  
**Cause:** \`WHERE o.id IS NOT NULL\` or predicate on right cols in WHERE  
**Fix:** Put right-side filters in ON, or accept inner semantics deliberately`),
  R('03-semi-anti.md','Semi and anti joins','EXISTS','Master','master','EXISTS NOT IN trap',
    'EXISTS/NOT EXISTS are the safe semi/anti patterns; NOT IN breaks with NULLs.',
    `Prefer NOT EXISTS over NOT IN (subquery) when nulls are possible.`),
  R('04-multi-join.md','Multi-table joins','Multi joins','Understand','understand','readability',
    'Text join order is not execution order; format long queries for humans.',
    `Alias every table; one join per line.`),
  R('05-nn-join-table.md','Reading N-N relationships','N-N','Understand','understand','join table',
    'Traverse N-N through the join table with two joins or EXISTS.',
    `Do not denormalize arrays of ids until measured.`),
  R('06-outer-joins.md','RIGHT and FULL OUTER','OUTER','Understand','understand','rare but real',
    'RIGHT is LEFT with sides flipped; FULL keeps non-matches from both.',
    `Most app SQL needs LEFT, not RIGHT.`),
  R('07-cross-join.md','CROSS JOIN','CROSS JOIN','Understand','understand','cartesian accidents',
    'CROSS JOIN multiplies rows — intentional for grids, catastrophic as a bug.',
    `Missing join conditions are the usual accident.`),
  R('08-on-using-natural.md','ON vs USING vs NATURAL','ON vs USING','Understand','understand','never NATURAL',
    'Prefer ON; USING is ok for same column names; avoid NATURAL JOIN.',
    `NATURAL silently joins on all same-named columns — a schema-change time bomb.`),
  R('09-self-join.md','Self joins','Self joins','Understand','understand','hierarchies',
    'Join a table to itself for hierarchies and pairwise comparisons.',
    `Alias both sides clearly.`),
  R('10-lateral.md','LATERAL','LATERAL','Understand','understand','top-N-per-group',
    'LATERAL subqueries see the current row — great for top-N-per-group.',
    `Often clearer than window + filter for "latest order per user".`),
  R('11-set-ops.md','UNION INTERSECT EXCEPT','Set ops','Understand','understand','UNION ALL cost',
    'UNION dedups (costly); UNION ALL keeps duplicates; INTERSECT/EXCEPT for set math.',
    `Prefer UNION ALL when duplicates are impossible or irrelevant.`),
  R('12-alias-discipline.md','Alias discipline','Aliases','Understand','understand','qualify columns',
    'Qualify every column in multi-table queries — ambiguity errors are gifts.',
    `Use u.id not bare id once two tables appear.`),
  R('13-join-expressions.md','Joining on expressions','Join expressions','Know','know','ranges',
    'You can join on expressions and ranges; indexes may not follow — measure.',
    `Date-range joins need careful indexing (Phase 10).`),
];

const p6 = [
  R('01-group-by.md','GROUP BY and aggregates','GROUP BY','Master','master','count sum avg',
    'GROUP BY collapses rows; aggregates compute per group.',
    `\`\`\`sql
SELECT user_id, count(*), sum(total)
FROM measure_orders
GROUP BY user_id;
\`\`\``),
  R('02-count-variants.md','count variants','count','Master','master','three different questions',
    'count(*) counts rows; count(col) skips NULL; count(DISTINCT col) dedups.',
    `Pick deliberately — they answer different questions.`),
  R('03-having.md','HAVING vs WHERE','HAVING','Master','master','filter groups',
    'WHERE filters rows before grouping; HAVING filters groups after.',
    `Push predicates to WHERE when they do not depend on aggregates.`),
  R('04-filter-clause.md','FILTER WHERE aggregates','FILTER','Understand','understand','conditional aggregates',
    'count(*) FILTER (WHERE status = paid) beats CASE piles for conditional aggregates.',
    `Readable conditional aggregation without nested queries.`),
  R('05-json-agg.md','jsonb_agg and friends','jsonb_agg','Understand','understand','shape API in SQL',
    'string_agg, array_agg, jsonb_agg build payloads the API can return directly.',
    `Trade-off: SQL complexity vs Node assembly (Phase 9).`),
  R('06-windows-intro.md','Window functions intro','Windows','Understand','understand','OVER vs GROUP BY',
    'Windows compute across related rows without collapsing the result set.',
    `Running total: sum(total) OVER (PARTITION BY user_id ORDER BY id).`),
  R('07-ranking.md','Ranking functions','Ranking','Understand','understand','row_number rank',
    'row_number is unique per partition; rank and dense_rank handle ties differently.',
    `Top-N per group: filter row_number in an outer query.`),
  R('08-lag-lead.md','lag lead first_value','lag lead','Understand','understand','neighbor rows',
    'lag/lead look at other rows in the partition for deltas and sessions.',
    `Mind default frames for first_value/last_value.`),
  R('09-ctes.md','CTEs WITH','CTEs','Understand','understand','readability MATERIALIZED',
    'WITH names subqueries; PostgreSQL 12+ inlines CTEs unless MATERIALIZED.',
    `Use CTEs for clarity; do not assume an optimization barrier without MATERIALIZED.`),
  R('10-modifying-ctes.md','Data-modifying CTEs','Modifying CTEs','Understand','understand','DELETE RETURNING chain',
    'WITH moved AS (DELETE ... RETURNING *) INSERT ... chains set-based workflows.',
    `Keep transaction boundaries obvious from Node.`),
  R('11-subqueries.md','Subqueries','Subqueries','Understand','understand','correlated cost',
    'Scalar, row, and correlated subqueries — correlated can be N+1 inside one statement.',
    `Often rewriteable as joins or windows; EXPLAIN to compare.`),
  R('12-pagination-counts.md','Counting for pagination','Pagination counts','Understand','understand','limit plus one',
    'Exact count(*) is expensive; fetching limit+1 detects hasMore without totals.',
    `Many products do not need total page counts.`),
  R('13-ordered-set.md','Ordered-set aggregates','Percentiles','Know','know','percentile_cont',
    'percentile_cont and friends compute stats — know they exist.',
    `More analytics than CRUD APIs.`),
  R('14-frames.md','Window frames','Frames','Know','know','ROWS BETWEEN',
    'Frame clauses control which rows enter the window aggregate.',
    `Read the docs when running totals look sticky.`),
  R('15-recursive-cte.md','Recursive CTEs','Recursive CTE','Know','know','trees graphs',
    'WITH RECURSIVE walks trees and graphs; guard cycles and cap depth.',
    `Org charts and category trees are the classic use.`),
  R('16-grouping-sets.md','GROUPING SETS ROLLUP CUBE','ROLLUP','When Needed','when','multi aggregates',
    'GROUPING SETS, ROLLUP, and CUBE produce multiple aggregations in one pass.',
    `Reporting workloads more than request/response APIs.`),
];

const counts = {
  p4: mkPhase('phase-4-crud', 'Phase 4 — CRUD and DML', ['Part 2', '../../syllabus/02-sql.md'], p4,
    'Move on when you can INSERT...RETURNING, UPDATE with WHERE, and parameterize every user value.'),
  p5: mkPhase('phase-5-joins', 'Phase 5 — Joins and set operations', ['Part 2', '../../syllabus/02-sql.md'], p5,
    'Move on when you can explain the LEFT JOIN + WHERE bug and avoid NOT IN null traps.'),
  p6: mkPhase('phase-6-aggregation', 'Phase 6 — Aggregation, windows and CTEs', ['Part 2', '../../syllabus/02-sql.md'], p6,
    'Move on when you can GROUP BY correctly and write a basic window.'),
};
console.log(counts);
