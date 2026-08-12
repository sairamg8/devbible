import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Progress from '@site/src/components/Progress';
import {summarise} from '@site/src/data/progress';
import styles from './index.module.css';

/** Live counts, so the homepage can never drift from what is actually written. */
const node = summarise('nodejs');
const express = summarise('expressjs');
const postgres = summarise('postgresql');

/**
 * The stack, grouped by the layer it lives in. `to` is set only for
 * technologies that actually have content — everything else renders as a
 * disabled card, so the page never promises a page that isn't there.
 *
 * `parked: true` marks a layer that is outside the committed eleven in
 * instructions.md §2 — visible so the map is honest about what exists beyond
 * the brief, styled so nobody mistakes it for scheduled work.
 */
const LAYERS = [
  {
    name: 'Frontend',
    note: 'What the browser runs',
    items: [
      {n: '01', name: 'CSS', desc: 'Flexbox, Grid, container queries, and the 2026 feature set'},
      {n: '02', name: 'JavaScript', desc: 'Language core, Web APIs, and a full DSA track'},
      {n: '03', name: 'TypeScript', desc: 'Narrowing, generics, mapped and conditional types'},
      {n: '04', name: 'React', desc: 'Hooks, Server Components, Actions, Suspense'},
    ],
  },
  {
    name: 'Backend',
    note: 'What the server runs',
    items: [
      {
        n: '05',
        name: 'Node.js',
        desc: 'Runtime model, event loop, streams, security, production',
        to: '/docs/nodejs',
        active: true,
        stats: `${node.topicsTotal} topics · ${node.phasesTotal} phases · ${node.phasesDone} phases explained · ${node.pagesWritten} pages`,
        progress: node.percent,
      },
      {
        n: '06',
        name: 'Express',
        desc: 'Routing, middleware, error handling, auth, layering',
        to: '/docs/expressjs',
        active: true,
        stats: `${express.topicsTotal} topics · ${express.phasesTotal} phases · ${express.phasesDone} phases explained · ${express.pagesWritten} pages`,
        progress: express.percent,
      },
    ],
  },
  {
    name: 'Data',
    note: 'Where state lives',
    items: [
      {n: '07', name: 'MongoDB', desc: 'Document model, aggregation, indexes, Mongoose'},
      {
        n: '08',
        name: 'PostgreSQL',
        desc: 'SQL, psql, indexes, MVCC, raw pg from Node',
        to: '/docs/postgresql',
        active: true,
        stats: `${postgres.topicsTotal} topics · ${postgres.phasesTotal} phases · ${postgres.phasesDone} phases explained · ${postgres.pagesWritten} pages`,
        progress: postgres.percent,
      },
      {n: '09', name: 'Redis', desc: 'Data types, caching patterns, sessions, streams'},
    ],
  },
  {
    name: 'Infrastructure',
    note: 'How it ships and stays up',
    items: [
      {n: '10', name: 'Docker & Podman', desc: 'Images, multi-stage builds, Compose, rootless'},
      {n: '11', name: 'Nginx', desc: 'Reverse proxy, load balancing, TLS, caching'},
    ],
  },
  {
    name: 'Beyond the core stack',
    note: 'Not committed — parked for later',
    parked: true,
    items: [
      {n: '12', name: 'Git', desc: 'Branching, rebase vs merge, history repair, workflows'},
      {n: '13', name: 'GraphQL', desc: 'Schema design, resolvers, N+1 and DataLoader'},
      {n: '14', name: 'tRPC', desc: 'End-to-end typed RPC for TypeScript stacks'},
      {n: '15', name: 'Kubernetes', desc: 'Pods, services, probes, scaling, rollouts'},
    ],
  },
];

function Card({item, parked}) {
  const pill = item.active
    ? {className: styles.pillActive, label: 'In progress'}
    : parked
      ? {className: styles.pillParked, label: 'Someday'}
      : {className: styles.pillSoon, label: 'Planned'};

  const inner = (
    <>
      <div className={styles.cardHead}>
        <span className={styles.cardNum}>{item.n}</span>
        <span className={pill.className}>{pill.label}</span>
      </div>
      <h3 className={styles.cardTitle}>{item.name}</h3>
      <p className={styles.cardDesc}>{item.desc}</p>
      {item.progress != null && (
        <div className={styles.cardBar} aria-hidden="true">
          <div className={styles.cardBarFill} style={{width: `${item.progress}%`}} />
        </div>
      )}
      {item.stats && <p className={styles.cardStats}>{item.stats}</p>}
      {item.to && <span className={styles.cardGo}>Open the syllabus →</span>}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`${styles.card} ${styles.cardLive}`}>
        {inner}
      </Link>
    );
  }
  return (
    <div
      className={`${styles.card} ${parked ? styles.cardParked : styles.cardDim}`}
      aria-disabled="true">
      {inner}
    </div>
  );
}

export default function Home() {
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

        <section className={styles.focus}>
          <div className={styles.focusBar} />
          <div className={styles.focusBody}>
            <p className={styles.focusLabel}>Current focus</p>
            <h2 className={styles.focusTitle}>Node.js explanations · Express syllabus</h2>
            <p className={styles.focusText}>
              Node.js: {node.topicsTotal} topics ·{' '}
              <strong>
                {node.phasesDone} of {node.phasesTotal} phases explained
              </strong>
              ({node.pagesWritten} pages). Express.js syllabus is live:{' '}
              {express.topicsTotal} topics across {express.phasesTotal} phases —
              explanations start at Phase 0. Other technologies stay planned.
            </p>
            <Progress lang="nodejs" compact />
            <Progress lang="expressjs" compact />
            <Link className={styles.focusCta} to="/docs/nodejs">
              Node.js syllabus →
            </Link>
            <Link className={styles.focusCtaAlt} to="/docs/expressjs">
              Express.js syllabus →
            </Link>
            <Link className={styles.focusCtaAlt} to="/docs/nodejs/pages">
              Node explanations →
            </Link>
          </div>
        </section>

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

        {LAYERS.map((layer) => (
          <section
            key={layer.name}
            className={`${styles.layer} ${layer.parked ? styles.layerParked : ''}`}>
            <div className={styles.layerHead}>
              <h2 className={styles.layerTitle}>{layer.name}</h2>
              <p className={styles.layerNote}>{layer.note}</p>
            </div>
            <div className={styles.grid}>
              {layer.items.map((item) => (
                <Card key={item.name} item={item} parked={layer.parked} />
              ))}
            </div>
          </section>
        ))}

        <footer className={styles.foot}>
          Content verified August 2026 · Node 26.7.0 current, Node 24 active LTS
        </footer>
      </main>
    </Layout>
  );
}
