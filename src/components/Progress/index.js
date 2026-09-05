import React from 'react';
import Link from '@docusaurus/Link';
import {summarise, phaseStatus} from '@site/src/data/progress';

const STATE_LABEL = {
  written: 'Written',
  writing: 'Writing',
  // Imported tracks: the pages exist, so the state describes the *validation*
  // pass over them, not whether there is text on the page.
  validating: 'Validating',
  imported: 'Draft',
  parked: 'Parked',
  planned: 'Planned',
};
import styles from './styles.module.css';

/**
 * Written-so-far indicator for one language.
 *
 * Every number comes from `src/data/progress.js` — bumping a phase's `pages`
 * there is the only edit needed when a phase lands.
 *
 * On an imported track (`imported: true` there) the same block reads as a
 * *validation* meter instead: the percentage is pages carrying a tier badge and
 * a dated `> Verified:` line, and the phase rows say "not yet validated" rather
 * than claiming a chapter is written. Nothing here decides that — it follows
 * the `verified` field, so a track converts by re-measuring, not by editing
 * this component.
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
        <p className={styles.label}>
          {s.imported ? 'Pages validated' : 'Explanations written'}
        </p>
        <p className={styles.pct}>{s.percent}%</p>
      </div>

      <div
        className={styles.bar}
        role="progressbar"
        aria-valuenow={s.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          s.imported
            ? `${s.topicsDone} of ${s.topicsTotal} pages validated`
            : `${s.topicsDone} of ${s.topicsTotal} topics explained`
        }>
        <div className={styles.fill} style={{width: `${s.percent}%`}} />
      </div>

      <dl className={styles.counters}>
        <div className={styles.counter}>
          <dt>{s.imported ? 'Chapters' : 'Phases'}</dt>
          <dd>
            {s.phasesDone} <span className={styles.of}>of {s.phasesTotal}</span>
          </dd>
        </div>
        <div className={styles.counter}>
          <dt>{s.imported ? 'Validated' : 'Topics'}</dt>
          <dd>
            {s.topicsDone} <span className={styles.of}>of {s.topicsTotal}</span>
          </dd>
        </div>
        <div className={styles.counter}>
          <dt>Pages</dt>
          <dd>{s.pagesWritten}</dd>
        </div>
        {s.parkedTopicsLeft > 0 && (
          <div className={styles.counter}>
            <dt>Parked</dt>
            <dd>
              {s.parkedTopicsLeft}{' '}
              <span className={styles.of}>
                topics · {s.parkedPhases} {s.parkedPhases === 1 ? 'phase' : 'phases'}
              </span>
            </dd>
          </div>
        )}
        <div className={styles.counter}>
          <dt>{s.inFlight ? 'In progress' : 'Next'}</dt>
          <dd className={styles.next}>
            {s.nextPhase
              ? `${s.imported ? 'Chapter' : 'Phase'} ${s.nextPhase.n} · ${s.nextPhase.name}`
              : 'Complete'}
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
                  {status === 'written' &&
                    (p.verified === undefined
                      ? `${p.pages} pages`
                      : `${p.pages} ${p.pages === 1 ? 'page' : 'pages'} · validated`)}
                  {status === 'writing' && `${p.pages} of ~${p.pagesPlanned} pages`}
                  {status === 'validating' && `${p.verified} of ${p.pages} pages validated`}
                  {status === 'imported' &&
                    `${p.pages} ${p.pages === 1 ? 'page' : 'pages'} · not yet validated`}
                  {status === 'parked' && `${p.pages} of ${p.topics} topics · rest set aside`}
                  {status === 'planned' && `${p.topics} topics`}
                </span>
                <span
                  className={`${styles.phaseState} ${status === 'writing' || status === 'validating' ? styles.phaseStateWriting : ''} ${status === 'parked' || status === 'imported' ? styles.phaseStateParked : ''}`}>
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
