import React from 'react';
import Link from '@docusaurus/Link';
import {summarise, phaseStatus} from '@site/src/data/progress';

const STATE_LABEL = {written: 'Written', writing: 'Writing', planned: 'Planned'};
import styles from './styles.module.css';

/**
 * Written-so-far indicator for one language.
 *
 * Every number comes from `src/data/progress.js` — bumping a phase's `pages`
 * there is the only edit needed when a phase lands.
 *
 * Two shapes:
 *   <Progress lang="nodejs" />            full — bar, counters, phase grid
 *   <Progress lang="nodejs" compact />    bar and one line of counters only
 */
export default function Progress({lang = 'nodejs', compact = false}) {
  const s = summarise(lang);

  return (
    <section className={styles.wrap} aria-label={`${s.label} progress`}>
      <div className={styles.head}>
        <p className={styles.label}>Explanations written</p>
        <p className={styles.pct}>{s.percent}%</p>
      </div>

      <div
        className={styles.bar}
        role="progressbar"
        aria-valuenow={s.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${s.topicsDone} of ${s.topicsTotal} topics explained`}>
        <div className={styles.fill} style={{width: `${s.percent}%`}} />
      </div>

      <dl className={styles.counters}>
        <div className={styles.counter}>
          <dt>Phases</dt>
          <dd>
            {s.phasesDone} <span className={styles.of}>of {s.phasesTotal}</span>
          </dd>
        </div>
        <div className={styles.counter}>
          <dt>Topics</dt>
          <dd>
            {s.topicsDone} <span className={styles.of}>of {s.topicsTotal}</span>
          </dd>
        </div>
        <div className={styles.counter}>
          <dt>Pages</dt>
          <dd>{s.pagesWritten}</dd>
        </div>
        <div className={styles.counter}>
          <dt>{s.inFlight ? 'In progress' : 'Next'}</dt>
          <dd className={styles.next}>
            {s.nextPhase ? `Phase ${s.nextPhase.n} · ${s.nextPhase.name}` : 'Complete'}
          </dd>
        </div>
      </dl>

      {!compact && (
        <ol className={styles.phases}>
          {s.phases.map((p) => {
            const status = phaseStatus(p);
            const linked = status !== 'planned';
            return (
              <li
                key={p.n}
                className={`${styles.phase} ${linked ? styles.phaseDone : styles.phaseTodo}`}>
                <span className={styles.phaseNum}>{String(p.n).padStart(2, '0')}</span>
                <span className={styles.phaseName}>
                  {linked ? (
                    <Link to={`${s.pagesPath}/${p.slug}/`}>{p.name}</Link>
                  ) : (
                    p.name
                  )}
                </span>
                <span className={styles.phaseMeta}>
                  {status === 'written' && `${p.pages} pages`}
                  {status === 'writing' && `${p.pages} of ~${p.pagesPlanned} pages`}
                  {status === 'planned' && `${p.topics} topics`}
                </span>
                <span
                  className={`${styles.phaseState} ${status === 'writing' ? styles.phaseStateWriting : ''}`}>
                  {STATE_LABEL[status]}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
