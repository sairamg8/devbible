import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {summarise} from '@site/src/data/progress';
import {LAYERS as STACK} from '@site/src/data/stack';
import styles from './index.module.css';

/**
 * The stack, with live numbers attached.
 *
 * The grouping and the card copy come from `src/data/stack.js`, which the docs
 * sidebar rail reads too — so a technology added there shows up in both places or
 * neither. Before the split this array lived here, and the rail would have had to
 * import a page component or keep a second copy of the list.
 *
 * The numbers come from `summarise()`, at module scope, so the homepage can never
 * drift from what is actually written. `name` and `to` are read from
 * `progress.js` as well rather than restated — one place decides what a
 * technology is called and where it lives.
 *
 * There is deliberately no roll-up strip above these cards and no
 * "moved most recently" row. Both were removed on the user's instruction
 * (2026-08-31): a single site-wide coverage percentage averages thirty unrelated
 * tracks into a number that means nothing, and naming the three freshest
 * languages put whichever one a session happened to touch at the top of the page
 * as if it were the point. The per-card numbers below are the honest version —
 * they say what is written, technology by technology.
 */
const LAYERS = STACK.map((layer) => ({
  ...layer,
  items: layer.items.map((item) => {
    // A parked entry carries no `key` because it has no pages. It keeps its own
    // hand-written name, gets no numbers, and renders as a disabled card — so the
    // page never promises a page that isn't there.
    if (!item.key) return item;
    const data = summarise(item.key);
    return {...item, name: data.label, to: data.docsPath, data};
  }),
}));

/**
 * One word for where a technology stands. This is what the filter chips filter
 * on and what colours the card, so it is computed once, here, rather than
 * re-derived from three different flags at three different call sites.
 *
 * `imported` is provenance, not progress: it stays on a track for as long as its
 * pages came in from the `frontend-bible` import, and the card's percentage says
 * how far the validation pass has got through them. Both now come from the same
 * place — `progress.js`, via `summarise()` — because provenance belongs next to
 * the numbers that measure the conversion, not restated beside the card copy
 * where it could disagree.
 */
function statusOf(item, layer) {
  if (layer.parked) return 'parked';
  if (item.done) return 'complete';
  if (item.data?.imported) return 'imported';
  if (item.data) return 'writing';
  return 'planned';
}

const STATUS_LABEL = {
  complete: 'Complete',
  writing: 'In progress',
  imported: 'Imported',
  parked: 'Someday',
  planned: 'Planned',
};

const FILTERS = [
  {key: 'all', label: 'Everything'},
  {key: 'complete', label: 'Complete'},
  {key: 'writing', label: 'In progress'},
  {key: 'imported', label: 'Imported'},
];

function Bar({percent, tone}) {
  return (
    <div className={styles.bar} aria-hidden="true">
      <div
        className={`${styles.barFill} ${tone === 'complete' ? styles.barDone : ''}`}
        style={{width: `${percent}%`}}
      />
    </div>
  );
}

function Card({item, layer}) {
  const status = statusOf(item, layer);
  const {data} = item;

  const body = (
    <>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{item.name}</h3>
        {data ? (
          // An imported track keeps its provenance tag next to the number: the
          // percentage alone would read as "0% written", which is the one thing
          // it does not mean.
          <span className={styles.cardStat}>
            {status === 'imported' && (
              <span className={styles.cardTag}>{STATUS_LABEL[status]}</span>
            )}
            <span className={styles.cardPercent}>{data.percent}%</span>
          </span>
        ) : (
          <span className={styles.cardTag}>{STATUS_LABEL[status]}</span>
        )}
      </div>
      <p className={styles.cardDesc}>{item.desc}</p>
      {data && <Bar percent={data.percent} tone={status} />}
      {data && (
        // An imported track counts different things, so it says so rather than
        // borrowing the written-track wording: its chapters are not phases, and
        // its pages all exist already — what moves is how many are validated.
        <p className={styles.cardMeta}>
          {data.imported ? (
            <>
              <span>{data.phasesTotal} chapters</span>
              <span>
                {data.pagesWritten} {data.pagesWritten === 1 ? 'page' : 'pages'}
              </span>
              <span>
                {data.pagesValidated}/{data.pagesWritten} validated
              </span>
            </>
          ) : (
            <>
              <span>
                {data.phasesDone}/{data.phasesTotal} phases
              </span>
              <span>{data.topicsTotal} topics</span>
              <span>
                {data.pagesWritten} {data.pagesWritten === 1 ? 'page' : 'pages'}
              </span>
            </>
          )}
        </p>
      )}
      {data?.imported && !data.inFlight && (
        <p className={styles.cardNote}>
          {data.percent === 100
            ? 'Validated to the page contract'
            : 'Draft · validation not started'}
        </p>
      )}
      {data?.inFlight && (
        <p className={styles.cardNow}>
          {data.imported ? 'Validating' : 'Writing'} · {data.inFlight.name}
        </p>
      )}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`${styles.card} ${styles[status]}`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={`${styles.card} ${styles[status]}`} aria-disabled="true">
      {body}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  /**
   * Filtering happens over the whole tree at once so a layer that matches
   * nothing disappears entirely — a page of empty section headings is worse
   * than no sections at all.
   */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LAYERS.map((layer) => ({
      ...layer,
      items: layer.items.filter((item) => {
        if (filter !== 'all' && statusOf(item, layer) !== filter) return false;
        if (!q) return true;
        return `${item.name} ${item.desc}`.toLowerCase().includes(q);
      }),
    })).filter((layer) => layer.items.length > 0);
  }, [query, filter]);

  const matches = shown.reduce((n, layer) => n + layer.items.length, 0);
  const filtering = filter !== 'all' || query.trim() !== '';

  return (
    <Layout
      title="Dev Bible"
      description="A central reference for building fullstack applications with MERN and PERN.">
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>MERN · PERN</p>
          <h1 className={styles.title}>Dev Bible</h1>
          <p className={styles.lede}>
            One reference for building fullstack applications — frontend through
            deployment. Every topic carries a priority tier, so you always know
            what to master and what to leave until a project asks for it.
          </p>
        </header>

        <div className={styles.controls} role="search">
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter — try “grid”, “streams”, “aggregation”"
            aria-label="Filter technologies"
          />
          <div className={styles.chips}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {filtering && (
            <p className={styles.matchCount} role="status">
              {matches} {matches === 1 ? 'match' : 'matches'}
            </p>
          )}
        </div>

        {shown.length === 0 && (
          <p className={styles.empty}>
            Nothing matches “{query}”. The search box reads the technology name
            and its one-line summary — for anything inside a page, use the site
            search in the header.
          </p>
        )}

        {shown.map((layer) => (
          <section
            key={layer.name}
            className={`${styles.layer} ${layer.parked ? styles.layerParked : ''}`}>
            <div className={styles.layerHead}>
              <h2 className={styles.layerTitle}>{layer.name}</h2>
              <p className={styles.layerNote}>{layer.note}</p>
            </div>
            <div className={styles.grid}>
              {layer.items.map((item) => (
                <Card key={item.name} item={item} layer={layer} />
              ))}
            </div>
          </section>
        ))}

        <section className={styles.tiers}>
          <p className={styles.sectionLabel}>How topics are tiered</p>
          <div className={styles.tierRow}>
            <div className={styles.tierItem}>
              <span className="db-tier t-master">Master</span>
              <span>Use it with no documentation open</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-understand">Understand</span>
              <span>Know how it works; look up signatures</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-know">Know</span>
              <span>Know what, why, and when</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-when">When Needed</span>
              <span>Don't study it upfront</span>
            </div>
          </div>
        </section>

        <footer className={styles.foot}>
          Content verified August 2026 · Node 26.7.0 current, Node 24 active LTS
        </footer>
      </main>
    </Layout>
  );
}
