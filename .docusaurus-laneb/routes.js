import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/devbible/docs',
    component: ComponentCreator('/devbible/docs', '130'),
    routes: [
      {
        path: '/devbible/docs',
        component: ComponentCreator('/devbible/docs', 'd23'),
        routes: [
          {
            path: '/devbible/docs',
            component: ComponentCreator('/devbible/docs', '92f'),
            routes: [
              {
                path: '/devbible/docs',
                component: ComponentCreator('/devbible/docs', '55b'),
                exact: true
              },
              {
                path: '/devbible/docs/babel',
                component: ComponentCreator('/devbible/docs/babel', '998'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages',
                component: ComponentCreator('/devbible/docs/babel/pages', '39a'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/authoring-custom-plugins/visitors-paths-types-and-testing',
                component: ComponentCreator('/devbible/docs/babel/pages/authoring-custom-plugins/visitors-paths-types-and-testing', 'a51'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/build-tool-integration/webpack-vite-jest-rollup',
                component: ComponentCreator('/devbible/docs/babel/pages/build-tool-integration/webpack-vite-jest-rollup', 'f32'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/cli-and-programmatic-tooling/cli-and-codemods',
                component: ComponentCreator('/devbible/docs/babel/pages/cli-and-programmatic-tooling/cli-and-codemods', '162'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/configuration-system/config-files-root-env-overrides',
                component: ComponentCreator('/devbible/docs/babel/pages/configuration-system/config-files-root-env-overrides', 'c72'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/core-compilation-pipeline/parse-transform-generate-and-api',
                component: ComponentCreator('/devbible/docs/babel/pages/core-compilation-pipeline/parse-transform-generate-and-api', '7e6'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/linter-and-type-checker-interop/babel-eslint-parser-and-tsc',
                component: ComponentCreator('/devbible/docs/babel/pages/linter-and-type-checker-interop/babel-eslint-parser-and-tsc', '65b'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/migration-and-decision-recipes/swc-esbuild-keep-or-audit',
                component: ComponentCreator('/devbible/docs/babel/pages/migration-and-decision-recipes/swc-esbuild-keep-or-audit', '974'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/monorepo-and-multi-package-strategies/shared-root-and-cross-package',
                component: ComponentCreator('/devbible/docs/babel/pages/monorepo-and-multi-package-strategies/shared-root-and-cross-package', '9c0'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/nodejs-backend-usage/register-and-esm-cjs',
                component: ComponentCreator('/devbible/docs/babel/pages/nodejs-backend-usage/register-and-esm-cjs', 'ff4'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/performance-and-caching/cost-caching-and-surface-reduction',
                component: ComponentCreator('/devbible/docs/babel/pages/performance-and-caching/cost-caching-and-surface-reduction', 'efc'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/plugin-ecosystem/syntax-transform-stage-macros',
                component: ComponentCreator('/devbible/docs/babel/pages/plugin-ecosystem/syntax-transform-stage-macros', '06b'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/presets/env-react-typescript-and-framework',
                component: ComponentCreator('/devbible/docs/babel/pages/presets/env-react-typescript-and-framework', '0bf'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/real-world-workflows-and-recipes/setup-debug-and-migrate',
                component: ComponentCreator('/devbible/docs/babel/pages/real-world-workflows-and-recipes/setup-debug-and-migrate', 'e78'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/source-maps-and-debugging/maps-and-inspecting-output',
                component: ComponentCreator('/devbible/docs/babel/pages/source-maps-and-debugging/maps-and-inspecting-output', 'd6c'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/typescript-and-jsx-handling/type-stripping-unsupported-and-jsx-runtime',
                component: ComponentCreator('/devbible/docs/babel/pages/typescript-and-jsx-handling/type-stripping-unsupported-and-jsx-runtime', '39f'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/babel/pages/why-babel-and-the-compiler-landscape/what-babel-is-and-when-it-matters',
                component: ComponentCreator('/devbible/docs/babel/pages/why-babel-and-the-compiler-landscape/what-babel-is-and-when-it-matters', 'db5'),
                exact: true,
                sidebar: "babelSidebar"
              },
              {
                path: '/devbible/docs/css',
                component: ComponentCreator('/devbible/docs/css', '198'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages',
                component: ComponentCreator('/devbible/docs/css/pages', 'c51'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs', '2dd'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/baseline-and-shipping',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/baseline-and-shipping', '1fd'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/css-fails-silently',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/css-fails-silently', '2ee'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/devtools-for-css',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/devtools-for-css', '09c'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/how-stylesheets-reach-the-page',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/how-stylesheets-reach-the-page', '5ce'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/render-blocking-css',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/render-blocking-css', '96b'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/resets-and-normalisers',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/resets-and-normalisers', '577'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/supports-feature-queries',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/supports-feature-queries', 'b51'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/the-at-rule-map',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/the-at-rule-map', '69b'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/the-rendering-pipeline',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/the-rendering-pipeline', '172'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/user-agent-stylesheets',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/user-agent-stylesheets', 'fca'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/vendor-prefixes',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/vendor-prefixes', '4af'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-0-how-css-runs/what-css-is',
                component: ComponentCreator('/devbible/docs/css/pages/phase-0-how-css-runs/what-css-is', 'f12'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors', '638'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/attribute-selectors',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/attribute-selectors', '8c1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/combinators',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/combinators', '8fc'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/form-state-pseudo-classes',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/form-state-pseudo-classes', '743'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/has',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/has', 'a4e'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/is-and-where',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/is-and-where', 'd88'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/nesting',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/nesting', 'b14'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/not-empty-root',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/not-empty-root', '5a1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/pseudo-elements',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/pseudo-elements', 'e83'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/scope',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/scope', '117'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/selector-lists',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/selector-lists', '952'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/selector-performance',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/selector-performance', '62f'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/shadow-dom-selectors',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/shadow-dom-selectors', '40a'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/state-pseudo-classes',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/state-pseudo-classes', '0ae'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/structural-pseudo-classes',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/structural-pseudo-classes', 'a43'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/styling-hooks',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/styling-hooks', 'd21'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-1-selectors/the-selector-families',
                component: ComponentCreator('/devbible/docs/css/pages/phase-1-selectors/the-selector-families', 'cea'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss', '17e'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/control-flow-and-extend',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/control-flow-and-extend', '0c4'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/loops-and-maps',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/loops-and-maps', '289'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/mixins',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/mixins', 'd83'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/nesting-and-ampersand',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/nesting-and-ampersand', '8f8'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/sass-functions',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/sass-functions', '10b'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/setting-up-and-compiling',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/setting-up-and-compiling', '5c2'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/use-and-forward',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/use-and-forward', 'd05'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-10-scss/variables-sass-vs-custom-properties',
                component: ComponentCreator('/devbible/docs/css/pages/phase-10-scss/variables-sass-vs-custom-properties', '2e1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade', '83d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/layer',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/layer', '768'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/layer/declaring-and-ordering',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/layer/declaring-and-ordering', 'ab3'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/layer/precedence-and-important',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/layer/precedence-and-important', '27a'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/specificity-counted-properly',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/specificity-counted-properly', '02c'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/the-shorthand-reset-trap',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/the-shorthand-reset-trap', '234'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-2-cascade/what-the-cascade-compares',
                component: ComponentCreator('/devbible/docs/css/pages/phase-2-cascade/what-the-cascade-compares', 'eae'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-3-custom-properties',
                component: ComponentCreator('/devbible/docs/css/pages/phase-3-custom-properties', 'e88'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-3-custom-properties/at-property',
                component: ComponentCreator('/devbible/docs/css/pages/phase-3-custom-properties/at-property', '832'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-3-custom-properties/clamp-min-max',
                component: ComponentCreator('/devbible/docs/css/pages/phase-3-custom-properties/clamp-min-max', 'acc'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-3-custom-properties/custom-properties-as-a-component-api',
                component: ComponentCreator('/devbible/docs/css/pages/phase-3-custom-properties/custom-properties-as-a-component-api', '76d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-3-custom-properties/units-that-matter',
                component: ComponentCreator('/devbible/docs/css/pages/phase-3-custom-properties/units-that-matter', 'c2a'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox', '1d0'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/flex-basis-vs-width',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/flex-basis-vs-width', '6a2'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/flexbox-and-text-overflow',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/flexbox-and-text-overflow', '5b9'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns', 'cb0'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns/bars-and-shells',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns/bars-and-shells', '562'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns/truncation-and-the-squeeze',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/flexbox-patterns/truncation-and-the-squeeze', '59d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/main-and-cross-axis',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/main-and-cross-axis', '887'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size', 'f28'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size/diagnosing-it',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size/diagnosing-it', '7b0'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size/why-items-refuse-to-shrink',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-automatic-minimum-size/why-items-refuse-to-shrink', '5a4'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand', 'a94'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand/choosing-a-basis',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand/choosing-a-basis', 'd23'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand/what-the-values-mean',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-shorthand/what-the-values-mean', '5de'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm', '725'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/base-sizes',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/base-sizes', '611'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/grow-and-shrink',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/grow-and-shrink', 'f4c'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/the-alignment-stage',
                component: ComponentCreator('/devbible/docs/css/pages/phase-4-flexbox/the-flex-sizing-algorithm/the-alignment-stage', '4a4'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid', '3ed'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/alignment-in-grid',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/alignment-in-grid', 'b97'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/explicit-vs-implicit-grid',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/explicit-vs-implicit-grid', 'f26'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/fr-and-track-sizing',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/fr-and-track-sizing', 'b6d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/grid-patterns',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/grid-patterns', '6a1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/grid-vs-flexbox-vs-flow',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/grid-vs-flexbox-vs-flow', '64d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/line-based-placement',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/line-based-placement', '750'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/named-areas',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/named-areas', '1e1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/repeat-minmax-autofit',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/repeat-minmax-autofit', '51b'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/subgrid',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/subgrid', '09b'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-5-grid/the-minmax-zero-fix',
                component: ComponentCreator('/devbible/docs/css/pages/phase-5-grid/the-minmax-zero-fix', '344'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-6-container-queries',
                component: ComponentCreator('/devbible/docs/css/pages/phase-6-container-queries', '6f5'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-6-container-queries/container-queries',
                component: ComponentCreator('/devbible/docs/css/pages/phase-6-container-queries/container-queries', '70e'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-6-container-queries/layouts-that-need-no-query',
                component: ComponentCreator('/devbible/docs/css/pages/phase-6-container-queries/layouts-that-need-no-query', '99a'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-6-container-queries/user-preference-queries',
                component: ComponentCreator('/devbible/docs/css/pages/phase-6-container-queries/user-preference-queries', '326'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-7-positioning',
                component: ComponentCreator('/devbible/docs/css/pages/phase-7-positioning', '1b2'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-7-positioning/position-sticky',
                component: ComponentCreator('/devbible/docs/css/pages/phase-7-positioning/position-sticky', '403'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-7-positioning/stacking-contexts',
                component: ComponentCreator('/devbible/docs/css/pages/phase-7-positioning/stacking-contexts', 'a82'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-7-positioning/the-clipped-dropdown-problem',
                component: ComponentCreator('/devbible/docs/css/pages/phase-7-positioning/the-clipped-dropdown-problem', 'cb0'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-7-positioning/z-index-in-practice',
                component: ComponentCreator('/devbible/docs/css/pages/phase-7-positioning/z-index-in-practice', '6ec'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-8-color-theming',
                component: ComponentCreator('/devbible/docs/css/pages/phase-8-color-theming', '89c'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-8-color-theming/color-mix',
                component: ComponentCreator('/devbible/docs/css/pages/phase-8-color-theming/color-mix', '449'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-8-color-theming/dark-mode-properly',
                component: ComponentCreator('/devbible/docs/css/pages/phase-8-color-theming/dark-mode-properly', 'd40'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-8-color-theming/oklch-and-perceptual-colour',
                component: ComponentCreator('/devbible/docs/css/pages/phase-8-color-theming/oklch-and-perceptual-colour', '45a'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-9-motion',
                component: ComponentCreator('/devbible/docs/css/pages/phase-9-motion', 'cf8'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-9-motion/prefers-reduced-motion',
                component: ComponentCreator('/devbible/docs/css/pages/phase-9-motion/prefers-reduced-motion', 'de1'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-9-motion/transition-traps',
                component: ComponentCreator('/devbible/docs/css/pages/phase-9-motion/transition-traps', 'f79'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/pages/phase-9-motion/what-is-cheap-to-animate',
                component: ComponentCreator('/devbible/docs/css/pages/phase-9-motion/what-is-cheap-to-animate', 'c28'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/syllabus/adaptive-and-visual',
                component: ComponentCreator('/devbible/docs/css/syllabus/adaptive-and-visual', '2a8'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/syllabus/at-scale',
                component: ComponentCreator('/devbible/docs/css/syllabus/at-scale', '329'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/syllabus/how-css-works',
                component: ComponentCreator('/devbible/docs/css/syllabus/how-css-works', '46d'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/css/syllabus/layout',
                component: ComponentCreator('/devbible/docs/css/syllabus/layout', 'efa'),
                exact: true,
                sidebar: "cssSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint',
                component: ComponentCreator('/devbible/docs/eslint-oxlint', '957'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages', '128'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/ci-monorepos-and-performance-engineering/ci-monorepos-and-perf',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/ci-monorepos-and-performance-engineering/ci-monorepos-and-perf', '699'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/coexistence-eslint-and-oxlint/dual-run-overlap-and-retirement',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/coexistence-eslint-and-oxlint/dual-run-overlap-and-retirement', '705'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/custom-eslint-rules-and-processors/authoring-testing-and-processors',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/custom-eslint-rules-and-processors/authoring-testing-and-processors', '22e'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-cli-output-cache-and-fixes/cli-and-programmatic-usage',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-cli-output-cache-and-fixes/cli-and-programmatic-usage', 'db0'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-core-architecture/pipeline-and-legacy-config',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-core-architecture/pipeline-and-legacy-config', '371'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-editor-and-local-workflow/ide-hooks-and-scripts',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-editor-and-local-workflow/ide-hooks-and-scripts', 'fbc'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-flat-config/forms-fields-and-composition',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-flat-config/forms-fields-and-composition', '7d3'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-language-options-globals-and-parsing/language-options-and-file-targeting',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-language-options-globals-and-parsing/language-options-and-file-targeting', 'f26'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-plugin-ecosystem/plugins-frontend-node-and-pitfalls',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-plugin-ecosystem/plugins-frontend-node-and-pitfalls', 'c86'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-rules-system/severity-core-rules-and-presets',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-rules-system/severity-core-rules-and-presets', '39c'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/eslint-suppressions-ignores-and-governance/disables-ignores-and-governance',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/eslint-suppressions-ignores-and-governance/disables-ignores-and-governance', 'fa5'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/linting-landscape-and-tooling-decisions/why-choose-and-boundaries',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/linting-landscape-and-tooling-decisions/why-choose-and-boundaries', '414'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/migration-paths/legacy-flat-oxlint-and-phased',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/migration-paths/legacy-flat-oxlint-and-phased', '1e5'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-core-architecture/what-oxlint-is-and-vs-eslint',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-core-architecture/what-oxlint-is-and-vs-eslint', '913'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-fixes-ignores-and-diagnostics/fixes-ignores-and-diagnostics',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-fixes-ignores-and-diagnostics/fixes-ignores-and-diagnostics', 'f81'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-installation-cli-and-config-files/install-cli-and-config-schema',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-installation-cli-and-config-files/install-cli-and-config-schema', 'd67'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-js-plugins-and-extensibility/js-plugins-and-custom-rules',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-js-plugins-and-extensibility/js-plugins-and-custom-rules', 'fd6'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-native-plugins-and-rule-coverage/plugins-and-categories',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-native-plugins-and-rule-coverage/plugins-and-categories', '62c'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/oxlint-type-aware-linting-and-multi-file-analysis/type-aware-and-multi-file',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/oxlint-type-aware-linting-and-multi-file-analysis/type-aware-and-multi-file', '37a'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/real-world-workflows-and-recipes/bootstrap-migration-and-day-to-day',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/real-world-workflows-and-recipes/bootstrap-migration-and-day-to-day', '78f'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/eslint-oxlint/pages/typescript-eslint/architecture-type-aware-and-stacks',
                component: ComponentCreator('/devbible/docs/eslint-oxlint/pages/typescript-eslint/architecture-type-aware-and-stacks', 'd9a'),
                exact: true,
                sidebar: "eslintOxlintSidebar"
              },
              {
                path: '/devbible/docs/expressjs',
                component: ComponentCreator('/devbible/docs/expressjs', 'd37'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages',
                component: ComponentCreator('/devbible/docs/expressjs/pages', '046'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics', '715'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server', '484'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/a-router-is-a-function-too',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/a-router-is-a-function-too', 'dca'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/inside-router-handle',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/inside-router-handle', '25a'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/sub-apps-and-the-server',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/sub-apps-and-the-server', '3a5'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/the-three-objects',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/the-three-objects', 'bb3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/url-rewriting-and-options',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/app-router-server/url-rewriting-and-options', '4fb'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/application-settings',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/application-settings', 'ae3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/creating-an-app',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/creating-an-app', '648'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/express-5-vs-4',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/express-5-vs-4', '86e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle', '76f'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/how-a-handler-is-invoked',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/how-a-handler-is-invoked', '2c6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/the-four-endings',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/the-four-endings', '4e1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/the-nine-stages',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/request-lifecycle/the-nine-stages', '133'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is', '669'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-app-is-a-function',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-app-is-a-function', '6e6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-boundary',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-boundary', '4d1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-mapping-problem',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/the-mapping-problem', 'ddc'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/what-express-delegates',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/what-express-is/what-express-delegates', '9a1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-0-express-basics/when-not-to-use-express',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-0-express-basics/when-not-to-use-express', 'd98'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing', '322'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/app-route-and-hosts',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/app-route-and-hosts', 'e49'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/http-methods',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/http-methods', 'f35'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/http-methods/03-405-and-method-semantics',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/http-methods/03-405-and-method-semantics', '1d1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/http-methods/head-and-options',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/http-methods/head-and-options', 'b37'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/http-methods/the-verb-table',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/http-methods/the-verb-table', '9fe'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/params-and-query',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/params-and-query', '81b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/path-params',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/path-params', 'be7'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/shape-and-trust',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/shape-and-trust', '5f3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/the-query-parser',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/params-and-query/the-query-parser', '555'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/path-matching-express5',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/path-matching-express5', '6c6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/route-ordering',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/route-ordering', '795'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/router-composition',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/router-composition', '25b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/router-composition/composition-at-scale',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/router-composition/composition-at-scale', 'e4f'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/router-composition/mergeparams-and-isolation',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/router-composition/mergeparams-and-isolation', '001'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/router-composition/mounting-a-router',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/router-composition/mounting-a-router', 'a4f'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-1-routing/router-param',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-1-routing/router-param', '02c'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory', '2a7'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/auth-in-tests',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/auth-in-tests', 'bb4'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/create-app',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/create-app', '9bd'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/a-function-of-its-dependencies',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/a-function-of-its-dependencies', '072'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/mount-order-is-the-content',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/mount-order-is-the-content', '97b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/what-it-buys',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/create-app/what-it-buys', '9fa'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/flags-and-serverless',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/flags-and-serverless', 'b50'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/health-and-boot',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/health-and-boot', '006'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/request-id',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/request-id', '9a6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/shutdown-and-entrypoint',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/shutdown-and-entrypoint', 'd68'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-10-app-factory/supertest',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-10-app-factory/supertest', 'a43'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware', '24e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/builtin-and-third-party',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/builtin-and-third-party', '36f'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/execution-order',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/execution-order', 'a16'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/execution-order/ordering-in-practice',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/execution-order/ordering-in-practice', '128'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/execution-order/the-four-levels',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/execution-order/the-four-levels', '792'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/first-and-last',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/first-and-last', '846'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract', '2c3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/middleware-that-composes',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/middleware-that-composes', '8f3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/the-shape-and-the-endings',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/the-shape-and-the-endings', '364'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/what-middleware-must-not-do',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/middleware-contract/what-middleware-must-not-do', 'd2d'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/middleware-factories',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/middleware-factories', '497'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/mutating-req-res',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/mutating-req-res', '010'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics', 'e8b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/double-send-and-guards',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/double-send-and-guards', '086'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/the-hang',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/the-hang', '9ef'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/what-you-can-pass',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-2-middleware/next-semantics/what-you-can-pass', '6d8'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests', '977'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/cookies-and-helpers',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/cookies-and-helpers', 'bd1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded', '593'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/errors-and-choices',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/errors-and-choices', 'a4f'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/the-four-gates',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/the-four-gates', '5e0'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/the-parsers-and-their-options',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/json-and-urlencoded/the-parsers-and-their-options', '353'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/malformed-bodies',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/malformed-bodies', '1aa'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/multipart-uploads',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/multipart-uploads', '1a3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/query-parser',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/query-parser', '008'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/raw-and-text',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/raw-and-text', '7ec'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy', 'b73'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/reading-headers-and-content',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/reading-headers-and-content', 'a3a'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/the-twelve-getters',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/the-twelve-getters', '5c1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/two-objects-in-one',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/req-anatomy/two-objects-in-one', '08a'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/size-limits',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/size-limits', '973'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/size-limits/choosing-and-layering',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/size-limits/choosing-and-layering', '98c'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/size-limits/two-paths-to-413',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/size-limits/two-paths-to-413', 'ebc'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-3-requests/size-limits/what-it-does-not-protect',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-3-requests/size-limits/what-it-does-not-protect', 'a90'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses', '45c'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/content-negotiation',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/content-negotiation', '7e9'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/cookies-out',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/cookies-out', '5a2'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/headers-already-sent',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/headers-already-sent', 'f99'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/res-methods',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/res-methods', 'f59'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/res-methods/choosing-and-shaping',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/res-methods/choosing-and-shaping', '173'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/res-methods/the-method-map',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/res-methods/the-method-map', '7cb'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/res-methods/what-res-send-does',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/res-methods/what-res-send-does', '3bc'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/response-shapes',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/response-shapes', 'd44'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/spa-fallback',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/spa-fallback', '1ee'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/static-files',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/static-files', '534'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers', '285'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers/headers-and-timing',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers/headers-and-timing', '855'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers/status-as-contract',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/status-and-headers/status-as-contract', 'af9'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-4-responses/streaming-and-downloads',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-4-responses/streaming-and-downloads', '0ef'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors', 'e4b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/async-errors',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/async-errors', '041'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/async-errors/the-shapes-that-escape',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/async-errors/the-shapes-that-escape', '6aa'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/async-errors/what-is-forwarded',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/async-errors/what-is-forwarded', '8b8'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/async-errors/writing-async-handlers',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/async-errors/writing-async-handlers', 'eb2'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-contract',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-contract', '230'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-contract/making-it-stick',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-contract/making-it-stick', '150'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-contract/the-envelope',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-contract/the-envelope', '005'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-contract/what-is-safe-to-expose',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-contract/what-is-safe-to-expose', '5f0'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-logging',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-logging', '120'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-middleware',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-middleware', '8b3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/arity-and-placement',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/arity-and-placement', 'e94'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/designing-the-handler',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/designing-the-handler', 'feb'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/the-default-handler',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/error-middleware/the-default-handler', 'd5a'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives', 'fee'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/database-and-network',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/database-and-network', 'd40'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/programmer-errors-and-the-fallback',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/programmer-errors-and-the-fallback', '4d2'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/the-taxonomy',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/every-error-that-arrives/the-taxonomy', '066'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/mapping-to-http',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/mapping-to-http', 'ebd'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/not-found-and-process',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/not-found-and-process', 'c37'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-5-errors/operational-vs-programmer',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-5-errors/operational-vs-programmer', '6d8'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface', '478'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/etag-and-cache',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/etag-and-cache', '5ee'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/filter-sort-search',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/filter-sort-search', '5e9'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/hypermedia',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/hypermedia', '716'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/idempotency-keys',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/idempotency-keys', 'c19'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/openapi',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/openapi', '8aa'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination', 'dee'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination/cursors-that-work',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination/cursors-that-work', 'd6e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination/offset-and-its-drift',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/pagination/offset-and-its-drift', 'a58'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/patch-and-bulk',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/patch-and-bulk', 'db8'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources', 'dea'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/designing-a-surface',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/designing-a-surface', '006'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/nouns-collections-items',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/nouns-collections-items', 'b17'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/when-rest-stops-fitting',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/rest-resources/when-rest-stops-fitting', 'c14'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping', 'e90'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping/conflicts-and-preconditions',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping/conflicts-and-preconditions', '6d5'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping/crud-to-status',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/status-mapping/crud-to-status', 'f8d'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/versioning',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/versioning', 'dda'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-6-rest-surface/webhooks',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-6-rest-surface/webhooks', '0a6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering', '4e7'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository', '2e0'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/the-three-layers',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/the-three-layers', 'c86'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/when-to-adopt',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/when-to-adopt', '276'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/wiring-it-in-express',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/controller-service-repository/wiring-it-in-express', 'b68'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/di-without-framework',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/di-without-framework', '4e3'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/domain-vs-transport',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/domain-vs-transport', '4c5'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/fat-controllers',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/fat-controllers', '4fc'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/folders-and-dtos',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/folders-and-dtos', '486'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/jobs-from-routes',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/jobs-from-routes', '8df'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-7-layering/transaction-middleware',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-7-layering/transaction-middleware', '3b4'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz', 'fef'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware', '0da'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/mounting-and-testing',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/mounting-and-testing', 'ef9'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/one-question-only',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/one-question-only', 'f08'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/tokens-sessions-and-cost',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/authn-middleware/tokens-sessions-and-cost', '348'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/coercion-traps',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/coercion-traps', 'e18'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/cookies-sessions-wireup',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/cookies-sessions-wireup', '90b'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership', 'fb6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/scope-the-query',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/scope-the-query', '679'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/status-and-proving-it',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/status-and-proving-it', '3ce'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/the-bug-that-survives-review',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/ownership/the-bug-that-survives-review', '2a4'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware', 'd01'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/permissions-not-roles',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/permissions-not-roles', '602'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/the-second-question',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/the-second-question', '5e6'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/what-rbac-cannot-do',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/rbac-middleware/what-rbac-cannot-do', 'cdd'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/tenant-and-logout',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/tenant-and-logout', '910'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/type-inference',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/type-inference', 'ff1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary', '0c1'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary/parse-dont-validate',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary/parse-dont-validate', '4c7'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary/what-untrusted-means',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validate-at-boundary/what-untrusted-means', 'd48'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory', '344'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/mounting-and-order',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/mounting-and-order', 'd8e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/schemas-that-hold-up',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/schemas-that-hold-up', '8de'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/the-factory',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-8-validation-authz/validation-factory/the-factory', '30e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening', 'b72'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/cors',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/cors', '28c'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/csrf-and-injection',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/csrf-and-injection', '6a9'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/helmet',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/helmet', 'ea7'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/rate-limiting',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/rate-limiting', '3bf'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/timeouts-and-secrets',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/timeouts-and-secrets', '73d'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy', 'c80'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/the-setting-and-the-header',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/the-setting-and-the-header', '75a'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/what-else-it-changes',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/what-else-it-changes', 'daf'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/when-true-is-a-bypass',
                component: ComponentCreator('/devbible/docs/expressjs/pages/phase-9-hardening/trust-proxy/when-true-is-a-bypass', '390'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/syllabus/api-product',
                component: ComponentCreator('/devbible/docs/expressjs/syllabus/api-product', '822'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/syllabus/edge-and-ops',
                component: ComponentCreator('/devbible/docs/expressjs/syllabus/edge-and-ops', 'e1d'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/syllabus/foundations',
                component: ComponentCreator('/devbible/docs/expressjs/syllabus/foundations', 'f3e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/expressjs/syllabus/http-surface',
                component: ComponentCreator('/devbible/docs/expressjs/syllabus/http-surface', '50e'),
                exact: true,
                sidebar: "expressjsSidebar"
              },
              {
                path: '/devbible/docs/framer-motion',
                component: ComponentCreator('/devbible/docs/framer-motion', '5a5'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages',
                component: ComponentCreator('/devbible/docs/framer-motion/pages', '91e'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/advanced-patterns/production-grade-motion-design',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/advanced-patterns/production-grade-motion-design', '437'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/animatepresence/exit-animations',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/animatepresence/exit-animations', '58a'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/animation-controls/imperative-sequencing',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/animation-controls/imperative-sequencing', '9ba'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/basic-animation-props/the-core-prop-triad',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/basic-animation-props/the-core-prop-triad', 'bd8'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/core-concepts/declarative-animation-philosophy',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/core-concepts/declarative-animation-philosophy', 'b27'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/gestures/interaction-driven-animation',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/gestures/interaction-driven-animation', 'a9c'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/keyframes/multi-step-value-animation',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/keyframes/multi-step-value-animation', 'd07'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/layout-animations/automatic-layout-transitions',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/layout-animations/automatic-layout-transitions', '941'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/motion-values/imperative-value-tracking',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/motion-values/imperative-value-tracking', '3b3'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/orchestration-and-staggering/choreographed-groups',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/orchestration-and-staggering/choreographed-groups', '51f'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/performance-considerations/animating-efficiently',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/performance-considerations/animating-efficiently', '934'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/real-world-workflows-and-recipes/diagnosing-janky-animations',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/real-world-workflows-and-recipes/diagnosing-janky-animations', 'c7c'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/scroll-linked-animations/scroll-reactive-motion',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/scroll-linked-animations/scroll-reactive-motion', '0d6'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/svg-animations/vector-graphic-motion',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/svg-animations/vector-graphic-motion', 'a22'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/transition-types/timing-models',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/transition-types/timing-models', 'cc8'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/framer-motion/pages/variants/reusable-named-states',
                component: ComponentCreator('/devbible/docs/framer-motion/pages/variants/reusable-named-states', 'a56'),
                exact: true,
                sidebar: "framerMotionSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture',
                component: ComponentCreator('/devbible/docs/frontend-architecture', '2c4'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages', '2f7'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/authentication-and-authorization-architecture/real-world-auth-concerns',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/authentication-and-authorization-architecture/real-world-auth-concerns', 'fe1'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/ci-cd-pipeline-design/shipping-safely',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/ci-cd-pipeline-design/shipping-safely', 'f34'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/component-architecture/composition-patterns',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/component-architecture/composition-patterns', 'fee'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/data-layer-and-api-architecture/structuring-the-data-boundary',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/data-layer-and-api-architecture/structuring-the-data-boundary', '285'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/environment-and-configuration-management/config-across-environments',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/environment-and-configuration-management/config-across-environments', 'f80'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/error-handling-and-resilience/designing-for-failure',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/error-handling-and-resilience/designing-for-failure', '66d'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/monorepo-and-multi-app-strategy/scaling-beyond-one-app',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/monorepo-and-multi-app-strategy/scaling-beyond-one-app', '92c'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/observability-and-monitoring/knowing-whats-happening-in-production',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/observability-and-monitoring/knowing-whats-happening-in-production', '2a7'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/performance-and-scalability-patterns/architecting-for-scale',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/performance-and-scalability-patterns/architecting-for-scale', 'b55'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/project-structure-and-organization/folder-strategy',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/project-structure-and-organization/folder-strategy', 'a28'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/routing-and-navigation-architecture/real-world-routing-concerns',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/routing-and-navigation-architecture/real-world-routing-concerns', '17a'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/state-management-decision-tree/choosing-the-right-tool',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/state-management-decision-tree/choosing-the-right-tool', '988'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/styling-architecture/choosing-and-scaling-a-styling-approach',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/styling-architecture/choosing-and-scaling-a-styling-approach', 'bdb'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/team-and-collaboration-practices/process-as-architecture',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/team-and-collaboration-practices/process-as-architecture', '763'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/frontend-architecture/pages/testing-strategy/the-real-world-testing-pyramid',
                component: ComponentCreator('/devbible/docs/frontend-architecture/pages/testing-strategy/the-real-world-testing-pyramid', '4db'),
                exact: true,
                sidebar: "frontendArchitectureSidebar"
              },
              {
                path: '/devbible/docs/git',
                component: ComponentCreator('/devbible/docs/git', 'ba4'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages',
                component: ComponentCreator('/devbible/docs/git/pages', 'a2b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things', '6bf'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/commit-graph',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/commit-graph', '92b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/commit-is-a-snapshot',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/commit-is-a-snapshot', 'adb'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/config-layers',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/config-layers', 'e5c'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/git-directory-tour',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/git-directory-tour', 'f23'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/identity-setup',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/identity-setup', 'ec2'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/loose-objects-and-packfiles',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/loose-objects-and-packfiles', '4c2'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/object-format',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/object-format', 'da9'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/object-types',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/object-types', '5c8'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/plumbing-vs-porcelain',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/plumbing-vs-porcelain', 'b4a'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/refs-and-head',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/refs-and-head', '6b8'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/the-index',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/the-index', '60f'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/three-trees',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/three-trees', '4d5'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/what-git-is',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/what-git-is', 'c9f'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-0-how-git-stores-things/what-git-is-not',
                component: ComponentCreator('/devbible/docs/git/pages/phase-0-how-git-stores-things/what-git-is-not', '453'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop', '528'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/commit-messages',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/commit-messages', '950'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-add',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-add', 'e2d'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-add/patch-mode',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-add/patch-mode', '52b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-add/pathspecs',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-add/pathspecs', '57b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-add/what-add-does',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-add/what-add-does', 'fb9'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-commit',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-commit', 'e45'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-diff',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-diff', '7fc'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-log',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-log', '318'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-stash',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-stash', 'fbd'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-status',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-status', 'e3c'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-status/porcelain-for-scripts',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-status/porcelain-for-scripts', '62c'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-status/the-short-format',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-status/the-short-format', 'd21'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-status/the-three-sections',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-status/the-three-sections', '71e'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/git-status/untracked-and-performance',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/git-status/untracked-and-performance', '983'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/gitignore',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/gitignore', 'f0b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/ignoring-does-not-untrack',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/ignoring-does-not-untrack', '812'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/removing-and-moving',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/removing-and-moving', '8ad'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/switch-and-restore',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/switch-and-restore', 'c8b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-1-everyday-loop/undo-before-you-push',
                component: ComponentCreator('/devbible/docs/git/pages/phase-1-everyday-loop/undo-before-you-push', 'b61'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging', '32a'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/a-branch-is-a-pointer',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/a-branch-is-a-pointer', '400'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/aborting-cleanly',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/aborting-cleanly', '585'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/fast-forward-vs-merge',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/fast-forward-vs-merge', '018'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/git-rebase',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/git-rebase', '2cd'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/interactive-rebase',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/interactive-rebase', 'd80'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/rebase-vs-merge',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/rebase-vs-merge', 'a8f'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/reflog',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/reflog', '290'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/resolving-conflicts',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/resolving-conflicts', 'c05'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/the-golden-rule',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/the-golden-rule', '849'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-2-branching-merging/three-way-merge',
                component: ComponentCreator('/devbible/docs/git/pages/phase-2-branching-merging/three-way-merge', '08b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes', '30b'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/a-remote-is-a-url',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/a-remote-is-a-url', '113'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/divergent-branches',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/divergent-branches', '035'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/fetch-vs-pull',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/fetch-vs-pull', '2d9'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/force-pushing-safely',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/force-pushing-safely', '8ce'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/git-push',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/git-push', 'ca9'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/remote-tracking-branches',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/remote-tracking-branches', 'ad4'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/transports-and-credentials',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/transports-and-credentials', '9da'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-4-remotes/upstream-tracking',
                component: ComponentCreator('/devbible/docs/git/pages/phase-4-remotes/upstream-tracking', '9a4'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover', '8e3'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/recovering-a-branch',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/recovering-a-branch', 'c23'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/reflog-recovery',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/reflog-recovery', '05e'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/reset-in-depth',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/reset-in-depth', '4ba'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/revert',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/revert', '6e8'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/rewriting-your-own-commits',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/rewriting-your-own-commits', 'ba8'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/the-undo-decision-table',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/the-undo-decision-table', '680'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/undoing-a-merge',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/undoing-a-merge', '4fe'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/pages/phase-5-undo-recover/undoing-something-pushed',
                component: ComponentCreator('/devbible/docs/git/pages/phase-5-undo-recover/undoing-something-pushed', 'dda'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/syllabus/collaboration',
                component: ComponentCreator('/devbible/docs/git/syllabus/collaboration', 'ce2'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/syllabus/depth-and-repair',
                component: ComponentCreator('/devbible/docs/git/syllabus/depth-and-repair', '391'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/syllabus/how-git-works',
                component: ComponentCreator('/devbible/docs/git/syllabus/how-git-works', 'b1f'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/git/syllabus/in-a-real-project',
                component: ComponentCreator('/devbible/docs/git/syllabus/in-a-real-project', 'db3'),
                exact: true,
                sidebar: "gitSidebar"
              },
              {
                path: '/devbible/docs/javascript',
                component: ComponentCreator('/devbible/docs/javascript', 'a19'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages',
                component: ComponentCreator('/devbible/docs/javascript/pages', '41b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs', 'd53'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/call-stack',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/call-stack', 'ea7'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/ecmascript-and-tc39',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/ecmascript-and-tc39', '8c8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/engine-runtime-spec',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/engine-runtime-spec', '343'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/feature-detection',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/feature-detection', 'efa'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/hosts-and-globals',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/hosts-and-globals', '089'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/loading-scripts',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/loading-scripts', '939'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/parse-compile-execute',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/parse-compile-execute', '9df'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/reading-the-spec',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/reading-the-spec', 'c12'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/running-and-inspecting',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/running-and-inspecting', 'ce7'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/strict-mode',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/strict-mode', '50c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/the-jit',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/the-jit', '4e8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-0-how-javascript-runs/transpilation-polyfills',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-0-how-javascript-runs/transpilation-polyfills', 'fb2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion', '87f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/bigint',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/bigint', '7f0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/const-is-not-immutable',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/const-is-not-immutable', 'b6b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/equality',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/equality', 'd84'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/explicit-conversion',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/explicit-conversion', '4ad'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/nan',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/nan', '190'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/null-vs-undefined',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/null-vs-undefined', 'f09'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/numbers-are-doubles',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/numbers-are-doubles', '9e1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/numeric-literals',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/numeric-literals', 'afa'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/object-is-and-zero',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/object-is-and-zero', '178'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/object-wrappers',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/object-wrappers', '51b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/references-vs-values',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/references-vs-values', '42e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/strings-are-utf16',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/strings-are-utf16', '6cb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/symbol',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/symbol', 'f49'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/the-eight-types',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/the-eight-types', '111'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/truthiness',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/truthiness', 'cca'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/type-coercion',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/type-coercion', 'd74'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-1-values-and-coercion/value-equality',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-1-values-and-coercion/value-equality', '2b2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events', '656'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/addeventlistener',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/addeventlistener', 'd09'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/addeventlistener/options-and-removal',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/addeventlistener/options-and-removal', 'a93'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/event-delegation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/event-delegation', '75e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/event-delegation/one-listener',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/event-delegation/one-listener', '1fd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/the-event-model',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/the-event-model', '51c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/the-event-model/three-phases',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/the-event-model/three-phases', '947'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/the-event-object',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/the-event-object', '511'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-10-events/the-event-object/target-default-propagation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-10-events/the-event-object/target-default-propagation', 'de8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage', '3f2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side', '2fb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/credentials-and-exposure',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/credentials-and-exposure', '6de'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/simple-vs-preflighted',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/simple-vs-preflighted', '073'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/what-the-browser-is-doing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/cors-client-side/what-the-browser-is-doing', 'eb6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch', '727'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper', 'f0c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/auth-and-refresh',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/auth-and-refresh', 'b82'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/headers-and-bodies',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/headers-and-bodies', '239'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/retries',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/retries', 'b75'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/timeouts-and-cancellation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/timeouts-and-cancellation', 'bbd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/urls-and-parsing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/urls-and-parsing', 'cd4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/what-fetch-leaves-you',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch-wrapper/what-fetch-leaves-you', '9c3'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/fetch/the-critical-surprise',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/fetch/the-critical-surprise', 'd97'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/request-bodies',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/request-bodies', '90b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/request-bodies/choosing-a-body',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/request-bodies/choosing-a-body', '315'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams', '101'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/encoding-rules',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/encoding-rules', '533'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/the-url-object',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/the-url-object', '1fe'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/urlsearchparams',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-11-network-storage/url-and-searchparams/urlsearchparams', 'a25'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform', 'e73'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security', 'ee5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/storage-and-dependencies',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/storage-and-dependencies', '1f8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/the-trust-boundary',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/the-trust-boundary', '3a0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/windows-and-frames',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/client-side-security/windows-and-frames', 'd27'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/devtools',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/devtools', '16b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/devtools/the-console-api',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/devtools/the-console-api', '859'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-12-browser-platform/devtools/the-panels',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-12-browser-platform/devtools/the-panels', 'ecb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity', '42c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/big-o',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/big-o', '251'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/big-o/reading-a-bound',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/big-o/reading-a-bound', '1da'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/big-o/what-the-notation-says',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/big-o/what-the-notation-says', '627'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure', '703'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure/the-decision-table',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure/the-decision-table', 'f30'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure/when-the-array-is-right',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/choosing-a-structure/when-the-array-is-right', '24c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes', '7d8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes/constant-to-linearithmic',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes/constant-to-linearithmic', 'fdf'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes/quadratic-and-worse',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-13-complexity/complexity-classes/quadratic-and-worse', 'cb5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures', '973'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays', '3ee'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays/copying-and-modern-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays/copying-and-modern-methods', '06d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays/the-real-cost-table',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/dynamic-arrays/the-real-cost-table', '807'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping', '2d2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping/grouping-built-ins',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping/grouping-built-ins', '7fa'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping/the-frequency-map',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/frequency-and-grouping/the-frequency-map', 'b73'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets', 'a37'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets/how-hashing-works',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets/how-hashing-works', '2ab'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets/using-the-built-ins',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/hash-maps-and-sets/using-the-built-ins', 'dd6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque', '64e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque/deques-and-two-stacks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque/deques-and-two-stacks', '50f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque/making-dequeue-o1',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/queue-and-deque/making-dequeue-o1', 'd4f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/stack',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/stack', 'a38'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/stack/monotonic-stacks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/stack/monotonic-stacks', 'c19'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-14-data-structures/stack/the-structure',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-14-data-structures/stack/the-structure', 'd2f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns', '3a1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs', 'e51'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs/grids-and-state-spaces',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs/grids-and-state-spaces', '2e1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs/the-template',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/bfs/the-template', 'd72'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search', 'd5e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search/searching-over-an-answer',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search/searching-over-an-answer', 'dcc'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search/the-template',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/binary-search/the-template', 'd24'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns', '0a7'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns/complement-and-seen',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns/complement-and-seen', 'a02'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns/signatures-and-index-maps',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/hash-map-patterns/signatures-and-index-maps', '063'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window', 'e5e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window/the-template',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window/the-template', '5a0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window/variants-and-traps',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/sliding-window/variants-and-traps', '0ae'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers', '941'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers/opposite-ends',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers/opposite-ends', 'b3c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers/same-direction',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-15-algorithm-patterns/two-pointers/same-direction', '58c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming', 'e44'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization', '4e6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization/keys-and-conversion',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization/keys-and-conversion', '231'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization/the-transformation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/memoization/the-transformation', '1fe'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method', '1f8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method/a-worked-run',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method/a-worked-run', 'e33'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method/the-loop',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/problem-solving-method/the-loop', 'bea'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is', '17c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is/spotting-the-state',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is/spotting-the-state', '35b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is/the-two-conditions',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-16-dynamic-programming/what-dp-is/the-two-conditions', 'bee'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding', '772'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods', 'b82'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods/the-callback-contract',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods/the-callback-contract', '8cb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods/the-rest-of-the-family',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/array-methods/the-rest-of-the-family', '726'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind', '6c1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind/bind',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind/bind', '7f9'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind/call-and-apply',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/call-apply-bind/call-and-apply', 'b90'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle', 'ff6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle/debounce',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle/debounce', 'e7a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle/throttle',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/debounce-throttle/throttle', 'f0b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators', 'ef5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators/all-and-allsettled',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators/all-and-allsettled', 'c0b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators/race-and-any',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-17-machine-coding/promise-combinators/race-and-any', '145'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront', '1f1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine', '5a1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine/the-state-machine',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine/the-state-machine', 'b53'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine/wiring-it-up',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/cart-state-machine/wiring-it-up', '1b6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/idempotency',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/idempotency', '966'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/idempotency/the-double-submit',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/idempotency/the-double-submit', '2eb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding', '0c2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding/integer-minor-units',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding/integer-minor-units', 'bec'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding/rounding-and-order',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/money-and-rounding/rounding-and-order', '5ac'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/optimistic-updates',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/optimistic-updates', '70b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/optimistic-updates/apply-and-reconcile',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/optimistic-updates/apply-and-reconcile', '794'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/product-grid',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/product-grid', '2d1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/product-grid/rendering-and-the-request',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/product-grid/rendering-and-the-request', '1f6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/product-grid/url-as-state',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/product-grid/url-as-state', '938'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client', 'd8f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client/composing-the-client',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client/composing-the-client', '548'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client/failing-well',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/resilient-api-client/failing-well', '2f8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete', '8e6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete/the-dropdown',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete/the-dropdown', '007'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete/the-three-bugs',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-18-storefront/search-autocomplete/the-three-bugs', '15c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators', '275'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/arithmetic',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/arithmetic', '663'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/asi',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/asi', '5d6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/assignment',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/assignment', '292'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/bitwise',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/bitwise', 'dff'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/break-continue-labels',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/break-continue-labels', '279'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/comma-void-in-delete',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/comma-void-in-delete', 'c43'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/comparison',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/comparison', '469'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/conditionals',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/conditionals', '10b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/expressions-vs-statements',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/expressions-vs-statements', 'cc7'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/logical-operators',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/logical-operators', '332'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/loops',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/loops', '5a6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/optional-chaining',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/optional-chaining', '183'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/precedence',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/precedence', 'a8a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/spread-and-rest',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/spread-and-rest', '0d1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-2-operators/switch',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-2-operators/switch', '1c8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions', 'f09'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this', '2f8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this/lexical-this',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this/lexical-this', '6ed'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this/syntax-and-when-not-to',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/arrow-functions-and-this/syntax-and-when-not-to', '7de'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind', 'e50'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/borrowing-and-cost',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/borrowing-and-cost', '6de'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/the-three-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/the-three-methods', '5f2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/what-bind-does',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/call-apply-bind/what-bind-does', 'f27'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas', '025'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/merging-forwarding-and-identity',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/merging-forwarding-and-identity', '3e5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/null-undefined-and-the-api-boundary',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/null-undefined-and-the-api-boundary', '38c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/snapshots-and-the-four-fixes',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/snapshots-and-the-four-fixes', '15e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/which-binding-did-you-get',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closure-and-default-gotchas/which-binding-did-you-get', '0c1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closures',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closures', 'cc3'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closures/state-and-memory',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closures/state-and-memory', 'a22'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/closures/what-is-captured',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/closures/what-is-captured', '36d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/composition',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/composition', '7a2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/currying-and-partial-application',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/currying-and-partial-application', '625'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/debounce-and-throttle',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/debounce-and-throttle', 'f5e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/declarations-expressions-arrows',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/declarations-expressions-arrows', '400'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/higher-order-functions',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/higher-order-functions', '5a5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz', 'd2d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/block-functions-and-parameters',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/block-functions-and-parameters', '6cb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/classes-and-circular-imports',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/classes-and-circular-imports', '34e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/the-temporal-dead-zone',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/the-temporal-dead-zone', '420'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/the-two-step-scope-entry',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/the-two-step-scope-entry', '10f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/typeof-and-why-its-a-feature',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/typeof-and-why-its-a-feature', 'ead'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/var-and-function-declarations',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/hoisting-and-tdz/var-and-function-declarations', '4ab'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/lexical-scope',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/lexical-scope', 'a63'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/lexical-scope/the-scope-chain',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/lexical-scope/the-scope-chain', 'dc6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/lexical-scope/var-let-const',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/lexical-scope/var-let-const', '906'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/memoization',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/memoization', 'bd0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/no-function-overloading',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/no-function-overloading', '8ae'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/parameters',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/parameters', '086'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/parameters/defaults-and-scope',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/parameters/defaults-and-scope', 'fb0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/parameters/rest-destructuring-arguments',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/parameters/rest-destructuring-arguments', 'f14'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/pure-functions',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/pure-functions', '6fc'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/recursion',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/recursion', '2f2'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/this',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/this', '705'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/this/losing-and-fixing-this',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/this/losing-and-fixing-this', '821'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-3-functions/this/the-four-rules',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-3-functions/this/the-four-rules', '5b6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes', '28f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/class',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/class', 'cd1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/private-elements',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/private-elements', '639'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/static-and-accessors',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/static-and-accessors', '7a1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/what-class-desugars-to',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/class/what-class-desugars-to', 'adb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete', '564'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/delete-and-its-cost',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/delete-and-its-cost', '792'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/in-and-hasown',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/in-and-hasown', 'deb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/undefined-holes-and-brand-checks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/existence-checks-and-delete/undefined-holes-and-brand-checks', 'dcf'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries', '30a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries/transforming-objects',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries/transforming-objects', 'f26'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries/what-they-include',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/keys-values-entries/what-they-include', '885'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals', '286'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/keys-and-order',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/keys-and-order', '8e1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/methods-accessors-and-spread',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/methods-accessors-and-spread', '0aa'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/proto-and-null-prototype',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/proto-and-null-prototype', '093'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/shorthand-and-computed-keys',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/object-literals/shorthand-and-computed-keys', '962'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy', '1c9'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/json-and-hand-written',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/json-and-hand-written', '26b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/structuredclone',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/structuredclone', '2c9'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/what-shallow-means',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/shallow-vs-deep-copy/what-shallow-means', 'ea4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain', 'da1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/how-lookup-walks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/how-lookup-walks', '56e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/prototype-vs-the-slot',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/prototype-vs-the-slot', 'e17'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/writing-and-mutation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/the-prototype-chain/writing-and-mutation', '4f1'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods', 'f3f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods/how-methods-lose-this',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods/how-methods-lose-this', 'c71'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods/the-fixes',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-4-objects-and-classes/this-in-methods/the-fixes', 'db3'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library', '9a4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing', '65d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing/push-pop-shift-unshift',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing/push-pop-shift-unshift', 'cac'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing/splice',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/adding-and-removing/splice', '92d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape', '3de'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape/holes-and-length',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape/holes-and-length', '7d4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape/making-arrays',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-creation-and-shape/making-arrays', 'd85'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods', '773'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods/callbacks-holes-and-async',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods/callbacks-holes-and-async', '454'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods/choosing-a-method',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/array-iteration-methods/choosing-a-method', 'aa5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/json',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/json', '497'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/json/parse-and-the-reviver',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/json/parse-and-the-reviver', '0bf'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/json/stringify',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/json/stringify', 'c57'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object', 'b81'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object/choosing-and-costs',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object/choosing-and-costs', '8dd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object/the-six-differences',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/map-vs-object/the-six-differences', 'b7e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/reduce',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/reduce', '16e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/reduce/the-shape',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/reduce/the-shape', '79c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/reduce/when-not-to-use-it',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/reduce/when-not-to-use-it', 'e56'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/sort',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/sort', 'a18'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/sort/stability-and-mutation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/sort/stability-and-mutation', 'ced'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/sort/the-default-and-the-comparator',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/sort/the-default-and-the-comparator', '264'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods', '98d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods/slicing-and-splitting',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods/slicing-and-splitting', '846'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods/trimming-padding-replacing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-5-built-in-library/string-methods/trimming-padding-replacing', '90f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring', 'ff6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring', 'd08'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring/in-parameters-and-loops',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring/in-parameters-and-loops', '9e8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring/the-patterns',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/destructuring/the-patterns', 'f60'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms', '169'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms/control-flow-and-choosing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms/control-flow-and-choosing', '26c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms/what-each-iterates',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/loop-forms/what-each-iterates', '811'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables', '788'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables/two-operations-one-syntax',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables/two-operations-one-syntax', '546'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables/where-it-earns-its-place',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-6-iteration-and-destructuring/spread-with-iterables/where-it-earns-its-place', 'c6d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async', '184'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/anti-patterns',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/anti-patterns', 'b65'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/anti-patterns/explicit-construction',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/anti-patterns/explicit-construction', '382'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/anti-patterns/floating-promises',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/anti-patterns/floating-promises', '014'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/anti-patterns/return-await-and-others',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/anti-patterns/return-await-and-others', 'b3d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/async-await',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/async-await', '787'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/async-await/always-a-promise',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/async-await/always-a-promise', '46a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/async-await/reading-the-ordering',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/async-await/reading-the-ordering', '6e4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/async-await/where-it-suspends',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/async-await/where-it-suspends', '17a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/callbacks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/callbacks', '77d'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/callbacks/callback-hell',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/callbacks/callback-hell', '8dd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/callbacks/error-first',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/callbacks/error-first', 'd4e'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/callbacks/inversion-of-control',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/callbacks/inversion-of-control', 'a6f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/callbacks/the-pattern',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/callbacks/the-pattern', 'cdc'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/chaining',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/chaining', '436'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/chaining/error-propagation',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/chaining/error-propagation', 'd18'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/chaining/finally-and-timing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/chaining/finally-and-timing', 'abd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/chaining/flattening',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/chaining/flattening', '1c8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/combinators',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/combinators', '2d6'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/combinators/all-and-allsettled',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/combinators/all-and-allsettled', 'ab8'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/combinators/choosing-and-the-losers',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/combinators/choosing-and-the-losers', '6da'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/combinators/race-and-any',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/combinators/race-and-any', '641'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/error-handling',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/error-handling', 'd7a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/error-handling/rejections-that-vanish',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/error-handling/rejections-that-vanish', '164'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/error-handling/try-catch-around-await',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/error-handling/try-catch-around-await', '9c0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/error-handling/unhandled-rejections',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/error-handling/unhandled-rejections', 'aea'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks', 'd2c'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks/the-drain-order',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks/the-drain-order', '1d3'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks/using-microtasks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/microtasks-vs-macrotasks/using-microtasks', '1e4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/promises',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/promises', '6b7'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/promises/the-three-states',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/promises/the-three-states', 'af9'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/promises/then-catch-finally',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/promises/then-catch-finally', '6cd'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/promises/value-vs-promise',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/promises/value-vs-promise', '163'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel', '7b3'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel/starting-before-awaiting',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel/starting-before-awaiting', '8be'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel/the-accidental-waterfall',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/sequential-vs-parallel/the-accidental-waterfall', 'f42'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/sync-vs-async',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/sync-vs-async', '20a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/sync-vs-async/one-thread',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/sync-vs-async/one-thread', '82a'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/the-event-loop',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/the-event-loop', '78b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-7-async/the-event-loop/stack-queue-heap',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-7-async/the-event-loop/stack-queue-heap', '53f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors', '743'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses', '826'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses/custom-errors',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses/custom-errors', 'c58'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses/the-error-object',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/error-and-subclasses/the-error-object', '6eb'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules', '2f5'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules/import-and-export',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules/import-and-export', '5d4'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules/specifiers-and-the-graph',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/es-modules/specifiers-and-the-graph', '915'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/leaks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/leaks', '3aa'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/leaks/reachability',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/leaks/reachability', '927'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/leaks/the-four-leaks',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/leaks/the-four-leaks', 'a26'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics', '382'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics/deferred-and-hoisted',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics/deferred-and-hoisted', 'f59'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics/singletons-and-strict',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-8-modules-errors/module-semantics/singletons-and-strict', '9b0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom', '723'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/attributes-vs-properties',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/attributes-vs-properties', '6fc'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/attributes-vs-properties/two-parallel-worlds',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/attributes-vs-properties/two-parallel-worlds', '931'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/creating-and-inserting',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/creating-and-inserting', 'a02'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/creating-and-inserting/building-and-placing',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/creating-and-inserting/building-and-placing', '3ca'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/sanitising-html',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/sanitising-html', 'fff'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/sanitising-html/sinks-and-sanitisers',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/sanitising-html/sinks-and-sanitisers', '3c0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/selecting-elements',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/selecting-elements', '1ab'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/selecting-elements/the-selector-methods',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/selecting-elements/the-selector-methods', '169'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/text-vs-html',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/text-vs-html', '650'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/text-vs-html/the-three-properties',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/text-vs-html/the-three-properties', '43f'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/traversal',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/traversal', '5ce'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/traversal/closest-matches-and-scope',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/traversal/closest-matches-and-scope', '447'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/traversal/the-two-families',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/traversal/the-two-families', '155'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/what-the-dom-is',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/what-the-dom-is', 'cac'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/pages/phase-9-dom/what-the-dom-is/a-tree-of-nodes',
                component: ComponentCreator('/devbible/docs/javascript/pages/phase-9-dom/what-the-dom-is/a-tree-of-nodes', 'd34'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/syllabus/applied-storefront',
                component: ComponentCreator('/devbible/docs/javascript/syllabus/applied-storefront', '567'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/syllabus/data-and-async',
                component: ComponentCreator('/devbible/docs/javascript/syllabus/data-and-async', '8b0'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/syllabus/dsa-and-machine-coding',
                component: ComponentCreator('/devbible/docs/javascript/syllabus/dsa-and-machine-coding', '6ee'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/syllabus/language-core',
                component: ComponentCreator('/devbible/docs/javascript/syllabus/language-core', 'e3b'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/javascript/syllabus/web-apis',
                component: ComponentCreator('/devbible/docs/javascript/syllabus/web-apis', '931'),
                exact: true,
                sidebar: "javascriptSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl',
                component: ComponentCreator('/devbible/docs/jest-rtl', 'fd1'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages', '2b4'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/accessibility-testing/a11y-assertions',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/accessibility-testing/a11y-assertions', '454'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/assertions-and-matchers/the-expect-api',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/assertions-and-matchers/the-expect-api', '964'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/async-testing/handling-asynchrony',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/async-testing/handling-asynchrony', 'd81'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/async-utilities/waiting-for-updates',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/async-utilities/waiting-for-updates', 'fd6'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/coverage-and-configuration/jest-config',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/coverage-and-configuration/jest-config', '997'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/custom-render/provider-wrapping',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/custom-render/provider-wrapping', '3bd'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/debugging-tests/diagnostic-tools',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/debugging-tests/diagnostic-tools', '617'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/jest-core-concepts/test-structure',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/jest-core-concepts/test-structure', '463'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/mocking-network-requests/api-level-mocking',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/mocking-network-requests/api-level-mocking', '05e'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/mocking/jest-mock-functions',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/mocking/jest-mock-functions', '894'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/real-world-workflows-and-recipes/testing-setup-from-zero',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/real-world-workflows-and-recipes/testing-setup-from-zero', '8f1'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/rtl-core-philosophy/guiding-principle',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/rtl-core-philosophy/guiding-principle', '051'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/rtl-queries/query-variants-and-priority',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/rtl-queries/query-variants-and-priority', 'fbe'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/snapshot-testing/snapshot-mechanics',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/snapshot-testing/snapshot-mechanics', 'db5'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/testing-hooks/render-hook',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/testing-hooks/render-hook', 'c54'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/jest-rtl/pages/user-interaction/simulating-input',
                component: ComponentCreator('/devbible/docs/jest-rtl/pages/user-interaction/simulating-input', '8fa'),
                exact: true,
                sidebar: "jestRtlSidebar"
              },
              {
                path: '/devbible/docs/mongodb',
                component: ComponentCreator('/devbible/docs/mongodb', 'e53'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages',
                component: ComponentCreator('/devbible/docs/mongodb/pages', '157'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs', '0fa'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/bson',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/bson', '080'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/document-collection-database',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/document-collection-database', 'eef'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/mongodb-vs-postgresql',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/mongodb-vs-postgresql', '204'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/single-document-atomicity',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/single-document-atomicity', '2c5'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/what-mongodb-actually-is',
                component: ComponentCreator('/devbible/docs/mongodb/pages/phase-0-how-mongodb-runs/what-mongodb-actually-is', '0cc'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/syllabus/from-node',
                component: ComponentCreator('/devbible/docs/mongodb/syllabus/from-node', 'c36'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/syllabus/production',
                component: ComponentCreator('/devbible/docs/mongodb/syllabus/production', '8df'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/syllabus/querying',
                component: ComponentCreator('/devbible/docs/mongodb/syllabus/querying', 'a08'),
                exact: true
              },
              {
                path: '/devbible/docs/mongodb/syllabus/the-document-model',
                component: ComponentCreator('/devbible/docs/mongodb/syllabus/the-document-model', 'eb2'),
                exact: true
              },
              {
                path: '/devbible/docs/nodejs',
                component: ComponentCreator('/devbible/docs/nodejs', '4aa'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages',
                component: ComponentCreator('/devbible/docs/nodejs/pages', '60b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model', '2bb'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/blocking-the-event-loop',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/blocking-the-event-loop', '1c4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/choosing-a-version',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/choosing-a-version', 'd80'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/globals',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/globals', '6c7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/how-v8-optimizes',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/how-v8-optimizes', '6e2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/libuv-thread-pool',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/libuv-thread-pool', '4bc'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/node-deno-bun',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/node-deno-bun', '6ef'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/node-vs-browser',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/node-vs-browser', 'd3c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/running-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/running-node', '7e0'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/single-thread-and-io',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/single-thread-and-io', 'b5b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-0-runtime-model/what-node-is',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-0-runtime-model/what-node-is', '369'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules', '588'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/circular-dependencies',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/circular-dependencies', '98e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/cjs-esm-interop',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/cjs-esm-interop', '8c0'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/commonjs',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/commonjs', '2dd'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/esm',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/esm', 'ebc'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/exports-map',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/exports-map', '2d7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/module-resolution',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/module-resolution', 'f07'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/node-module-api',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/node-module-api', '2e5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/node-prefix',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/node-prefix', '797'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/npm-day-to-day',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/npm-day-to-day', 'ec8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/package-json',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/package-json', '1b9'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/package-managers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/package-managers', '2be'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/publishing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/publishing', 'fe4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/semver-and-lockfiles',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/semver-and-lockfiles', 'db2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-1-modules/typescript-natively',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-1-modules/typescript-natively', '4ce'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability', '390'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/benchmarking',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/benchmarking', '016'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/caching-strategy',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/caching-strategy', '204'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/common-leak-sources',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/common-leak-sources', '36a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/correlation-ids',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/correlation-ids', '561'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/cpu-heap-profiling',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/cpu-heap-profiling', '88e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/diagnostics-channel',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/diagnostics-channel', '9a5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/error-tracking',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/error-tracking', '8d7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/event-loop-lag',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/event-loop-lag', '298'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/finding-the-bottleneck',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/finding-the-bottleneck', '08a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/flame-graphs',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/flame-graphs', '00a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/gc-basics',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/gc-basics', '9a2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/golden-signals',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/golden-signals', '4d4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/health-checks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/health-checks', '076'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/memory-leaks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/memory-leaks', '7aa'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/opentelemetry',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/opentelemetry', 'b45'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/perf-hooks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/perf-hooks', '0cb'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/pino-in-practice',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/pino-in-practice', '3fa'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/process-metrics',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/process-metrics', 'a85'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/prometheus-metrics',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/prometheus-metrics', 'ca1'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/startup-time',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/startup-time', '357'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/structured-logging',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/structured-logging', '504'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/trace-events-and-reports',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/trace-events-and-reports', 'bf6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-10-observability/what-to-log',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-10-observability/what-to-log', '3c8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment', 'b75'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/blue-green-canary',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/blue-green-canary', '237'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/boot-sequence',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/boot-sequence', '1b6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/cicd',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/cicd', '29c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/dockerizing-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/dockerizing-node', 'a81'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/environment-parity',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/environment-parity', '99b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/image-size-hardening',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/image-size-hardening', '0c4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/pid1-and-signals',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/pid1-and-signals', '1ee'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/process-managers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/process-managers', '12c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/reverse-proxy',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/reverse-proxy', '38c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/scaling',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/scaling', '496'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/semantic-release',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/semantic-release', '36e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/serverless-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/serverless-node', 'cff'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/twelve-factor-config',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/twelve-factor-config', '1db'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-11-deployment/zero-downtime-deploys',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-11-deployment/zero-downtime-deploys', '249'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native', 'faa'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/contributing-to-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/contributing-to-node', 'fd2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/cpp-addons',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/cpp-addons', '3e4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/custom-loaders',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/custom-loaders', 'b06'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/ffi',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/ffi', '06c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/node-api',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/node-api', 'f9b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/node-vm',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/node-vm', 'be7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/startup-snapshots',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/startup-snapshots', '09d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/v8-flags',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/v8-flags', 'b5f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/wasi',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/wasi', 'a1f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-12-native/webassembly',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-12-native/webassembly', 'e5e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async', 'a52'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/abortcontroller',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/abortcontroller', '2f9'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/async-await',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/async-await', '98e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/async-hooks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/async-hooks', '942'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/async-iterators',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/async-iterators', '719'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/asynclocalstorage',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/asynclocalstorage', '777'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/callbacks-and-promisify',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/callbacks-and-promisify', 'f9f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/combinators',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/combinators', '407'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/concurrency-control',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/concurrency-control', '547'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/cpu-bound-work',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/cpu-bound-work', 'ce9'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/error-design',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/error-design', '9d1'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/error-handling',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/error-handling', '50f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/event-loop-phases',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/event-loop-phases', 'd21'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/floating-promises',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/floating-promises', 'd0a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/microtasks-and-macrotasks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/microtasks-and-macrotasks', 'bee'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/nexttick-starvation',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/nexttick-starvation', 'cc2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/poll-phase',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/poll-phase', '01b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/promise-antipatterns',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/promise-antipatterns', '1d3'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/promise-states',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/promise-states', 'c5f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/sequential-vs-parallel',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/sequential-vs-parallel', '139'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/setimmediate-vs-settimeout',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/setimmediate-vs-settimeout', '262'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/timers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/timers', '83a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-2-async/unhandled-rejections',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-2-async/unhandled-rejections', '13f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams', '70b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/alloc-vs-allocunsafe',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/alloc-vs-allocunsafe', 'ebe'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/backpressure',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/backpressure', 'e48'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/binary-data-and-endianness',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/binary-data-and-endianness', 'cb5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/buffer-as-uint8array',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/buffer-as-uint8array', '050'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/buffer-basics',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/buffer-basics', 'd38'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/custom-readable-writable',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/custom-readable-writable', '6e2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/encodings',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/encodings', '629'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/for-await-of',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/for-await-of', '83f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/highwatermark-tuning',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/highwatermark-tuning', '2a7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/object-mode',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/object-mode', 'be2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/pipeline',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/pipeline', '81c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-events-and-modes',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-events-and-modes', '092'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-promises-and-compose',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-promises-and-compose', '2b0'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-types',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/stream-types', '9e2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/string-decoder',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/string-decoder', '616'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams', 'ad1'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams/encodings-and-async',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams/encodings-and-async', '1bb'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams/transform-and-boundaries',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/transform-streams/transform-and-boundaries', 'ef6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/web-streams',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/web-streams', '580'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/why-streams',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/why-streams', 'f60'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-3-buffers-streams/zlib',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-3-buffers-streams/zlib', '9ba'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem', 'e29'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/atomic-writes-and-temp-files',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/atomic-writes-and-temp-files', 'cfb'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/directories',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/directories', '078'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/file-handles',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/file-handles', 'f01'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/file-streams',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/file-streams', '2a5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/fs-promises',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/fs-promises', 'b4c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/os',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/os', '20f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/path',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/path', 'fa2'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/path-traversal',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/path-traversal', 'f03'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/permissions-and-symlinks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/permissions-and-symlinks', '372'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/stat-and-existence',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/stat-and-existence', '3e3'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/the-three-flavors',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/the-three-flavors', '055'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/url',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/url', 'fc6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/virtual-filesystems',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/virtual-filesystems', '588'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-4-filesystem/watching',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-4-filesystem/watching', '417'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes', '561'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/child-process',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/child-process', 'f7f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/cluster',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/cluster', 'af0'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/cookies',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/cookies', '12b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/crash-handlers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/crash-handlers', 'f98'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/dns',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/dns', '0d5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/fetch',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/fetch', '017'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/graceful-shutdown',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/graceful-shutdown', '91c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/http-fundamentals',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/http-fundamentals', '096'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/http-server',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/http-server', '1a1'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/http2',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/http2', '6a7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/https-and-tls',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/https-and-tls', 'd8b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/ipc',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/ipc', '7ba'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/keep-alive-and-agents',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/keep-alive-and-agents', '999'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/net-and-dgram',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/net-and-dgram', '749'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/outbound-client-discipline',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/outbound-client-discipline', '14c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/outbound-timeouts',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/outbound-timeouts', 'a87'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/parseargs',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/parseargs', '987'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/process',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/process', '14a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/request-bodies',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/request-bodies', '049'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/shared-memory',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/shared-memory', '810'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/shell-injection',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/shell-injection', '89e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/signals',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/signals', '5d0'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/single-executable-applications',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/single-executable-applications', '466'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/streaming-and-sse',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/streaming-and-sse', '3b8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/websockets',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/websockets', '2c6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-5-http-processes/worker-threads',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-5-http-processes/worker-threads', '848'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access', 'e5c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/connection-pooling',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/connection-pooling', '722'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/cursors',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/cursors', '8e4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/driver-lifecycle',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/driver-lifecycle', '7e8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/drivers-builders-orms',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/drivers-builders-orms', 'ab6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/migrations',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/migrations', '557'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/mongodb-from-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/mongodb-from-node', 'e7c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/mongoose',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/mongoose', 'f7e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/n-plus-1',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/n-plus-1', '883'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/node-sqlite',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/node-sqlite', 'c12'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/parameterized-queries',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/parameterized-queries', 'fd8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/postgresql-from-node',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/postgresql-from-node', '864'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/prisma-drizzle',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/prisma-drizzle', 'de4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/read-replicas',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/read-replicas', '4f6'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/repository-pattern',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/repository-pattern', 'aa5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/retry-backoff',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/retry-backoff', 'b6d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-6-data-access/transactions',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-6-data-access/transactions', 'f6f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work', 'b7a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/backoff-and-jitter',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/backoff-and-jitter', '921'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/concurrency-limiting',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/concurrency-limiting', '9e3'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/dead-letter-queues',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/dead-letter-queues', '13d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/deadline-propagation',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/deadline-propagation', 'b20'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/graceful-shutdown',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/graceful-shutdown', '290'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/job-idempotency',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/job-idempotency', '96f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/job-queues',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/job-queues', '36b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/outbound-side-effects',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/outbound-side-effects', 'b43'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/retries-and-stalled-jobs',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/retries-and-stalled-jobs', 'da4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/retry-safe-failures',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/retry-safe-failures', '8c1'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/scheduled-jobs',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/scheduled-jobs', '235'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/sync-vs-background',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/sync-vs-background', '7a8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/time-on-the-server',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/time-on-the-server', '0b7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/timeout-budgets',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/timeout-budgets', '397'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/transactional-outbox',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/transactional-outbox', '429'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-7-background-work/worker-processes',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-7-background-work/worker-processes', '1fb'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security', '2e7'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/audit-logging',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/audit-logging', '233'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/authentication-vs-authorization',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/authentication-vs-authorization', 'af3'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/csrf',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/csrf', 'cda'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/deserialization-redirects-mass-assignment',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/deserialization-redirects-mass-assignment', '2f9'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/encryption-and-keys',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/encryption-and-keys', '52a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/https-hsts-cookies',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/https-hsts-cookies', '062'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/injection',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/injection', '91b'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/input-validation',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/input-validation', 'daa'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/mfa-totp',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/mfa-totp', '135'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/node-crypto',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/node-crypto', '6ba'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/oauth-oidc',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/oauth-oidc', '43d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/password-storage',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/password-storage', '987'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/path-traversal',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/path-traversal', '824'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/permission-model',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/permission-model', 'a50'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/prototype-pollution',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/prototype-pollution', '508'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/rate-limiting',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/rate-limiting', '41f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/redos',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/redos', '5f8'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/secrets',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/secrets', '87f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/security-headers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/security-headers', '49e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/session-management',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/session-management', '509'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/sessions-vs-jwt',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/sessions-vs-jwt', '5d5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/ssrf',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/ssrf', '823'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/supply-chain',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/supply-chain', '83d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/timing-attacks',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/timing-attacks', '875'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/token-storage',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/token-storage', '04c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/web-crypto',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/web-crypto', '00e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-8-security/xss',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-8-security/xss', 'aec'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing', '8bf'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/api-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/api-testing', '5de'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/async-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/async-testing', '81c'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/contract-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/contract-testing', '93a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/coverage',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/coverage', '79d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/fixtures-and-factories',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/fixtures-and-factories', '7cf'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/lint-and-format',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/lint-and-format', 'aa4'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/load-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/load-testing', '264'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/mocking',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/mocking', '054'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/module-mocking',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/module-mocking', '351'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/node-assert',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/node-assert', 'e4e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/node-test-runner',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/node-test-runner', '23d'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/property-and-mutation',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/property-and-mutation', '067'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/runner-flags',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/runner-flags', 'a2e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/schema-compatibility',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/schema-compatibility', '46f'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/snapshot-testing',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/snapshot-testing', 'c7e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/test-doubles',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/test-doubles', '90a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/testable-code',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/testable-code', 'a3e'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/testcontainers',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/testcontainers', 'c12'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/unit-integration-e2e',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/unit-integration-e2e', 'da5'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/pages/phase-9-testing/vitest-and-jest',
                component: ComponentCreator('/devbible/docs/nodejs/pages/phase-9-testing/vitest-and-jest', 'b41'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/syllabus/application',
                component: ComponentCreator('/devbible/docs/nodejs/syllabus/application', '975'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/syllabus/core-io',
                component: ComponentCreator('/devbible/docs/nodejs/syllabus/core-io', 'e38'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/syllabus/foundations',
                component: ComponentCreator('/devbible/docs/nodejs/syllabus/foundations', 'd6a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/nodejs/syllabus/production',
                component: ComponentCreator('/devbible/docs/nodejs/syllabus/production', '31a'),
                exact: true,
                sidebar: "nodejsSidebar"
              },
              {
                path: '/devbible/docs/playwright',
                component: ComponentCreator('/devbible/docs/playwright', '027'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages',
                component: ComponentCreator('/devbible/docs/playwright/pages', '87d'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/actions-and-interactions/interaction-primitives',
                component: ComponentCreator('/devbible/docs/playwright/pages/actions-and-interactions/interaction-primitives', '57c'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/advanced-patterns/scalable-test-architecture',
                component: ComponentCreator('/devbible/docs/playwright/pages/advanced-patterns/scalable-test-architecture', 'aab'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/api-testing/request-fixture',
                component: ComponentCreator('/devbible/docs/playwright/pages/api-testing/request-fixture', '0de'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/authentication-and-state/session-reuse',
                component: ComponentCreator('/devbible/docs/playwright/pages/authentication-and-state/session-reuse', '3fb'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/auto-waiting-and-assertions/web-first-assertions',
                component: ComponentCreator('/devbible/docs/playwright/pages/auto-waiting-and-assertions/web-first-assertions', '2c8'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/ci-integration/playwright-config',
                component: ComponentCreator('/devbible/docs/playwright/pages/ci-integration/playwright-config', '101'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/component-testing/experimental-ct-runner',
                component: ComponentCreator('/devbible/docs/playwright/pages/component-testing/experimental-ct-runner', '173'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/core-architecture/browser-automation-model',
                component: ComponentCreator('/devbible/docs/playwright/pages/core-architecture/browser-automation-model', 'f6b'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/debugging-tools/diagnostic-tooling',
                component: ComponentCreator('/devbible/docs/playwright/pages/debugging-tools/diagnostic-tooling', '453'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/fixtures-and-test-isolation/fixture-system',
                component: ComponentCreator('/devbible/docs/playwright/pages/fixtures-and-test-isolation/fixture-system', '29b'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/locators/locator-api',
                component: ComponentCreator('/devbible/docs/playwright/pages/locators/locator-api', '6b6'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/navigation-and-network/navigation-and-interception',
                component: ComponentCreator('/devbible/docs/playwright/pages/navigation-and-network/navigation-and-interception', '0d0'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/parallelism-and-sharding/scaling-test-runs',
                component: ComponentCreator('/devbible/docs/playwright/pages/parallelism-and-sharding/scaling-test-runs', 'f79'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/real-world-workflows-and-recipes/diagnosing-flaky-ci-tests',
                component: ComponentCreator('/devbible/docs/playwright/pages/real-world-workflows-and-recipes/diagnosing-flaky-ci-tests', '1e3'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/test-runner/playwright-test-fixtures',
                component: ComponentCreator('/devbible/docs/playwright/pages/test-runner/playwright-test-fixtures', '6c2'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/playwright/pages/visual-and-screenshot-testing/visual-regression',
                component: ComponentCreator('/devbible/docs/playwright/pages/visual-and-screenshot-testing/visual-regression', '71f'),
                exact: true,
                sidebar: "playwrightSidebar"
              },
              {
                path: '/devbible/docs/postgresql',
                component: ComponentCreator('/devbible/docs/postgresql', 'b7b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages',
                component: ComponentCreator('/devbible/docs/postgresql/pages', 'b4e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture', '13a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/client-server-model',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/client-server-model', '00e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/connection-and-auth',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/connection-and-auth', '6e0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/local-install',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/local-install', '910'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/namespace',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/namespace', '7b7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/process-model',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/process-model', 'df4'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/roles',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/roles', '336'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/shared-buffers',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/shared-buffers', '3ba'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/templates',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/templates', 'b47'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/version-policy',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/version-policy', '5e8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases', '42e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases/outdated-folklore',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases/outdated-folklore', '5f3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases/real-differences',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/vs-other-databases/real-differences', '414'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/wal',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/wal', '015'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-0-architecture/what-postgresql-is',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-0-architecture/what-postgresql-is', '6e3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql', 'b4d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/connecting',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/connecting', '6cf'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/copy',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/copy', '017'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/daily-meta-commands',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/daily-meta-commands', 'f80'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/describe-table',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/describe-table', '3e3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/errverbose',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/errverbose', 'ade'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/help',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/help', '5b0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/include-files',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/include-files', '66b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/output-control',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/output-control', '9fe'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/piping',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/piping', '2e9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/psqlrc',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/psqlrc', 'b18'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/query-buffer',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/query-buffer', 'e80'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/scripting',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/scripting', 'ac8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/timing-watch',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/timing-watch', 'd03'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/variables',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/variables', 'a16'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-1-psql/who-and-privileges',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-1-psql/who-and-privileges', '6b0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes', 'f68'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/bloat-reindex',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/bloat-reindex', 'b75'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/btree',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/btree', 'b0e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/concurrently',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/concurrently', '189'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/explain',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/explain', '0ab'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/explain-buffers',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/explain-buffers', '9c8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/expression',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/expression', '11a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/fk-indexes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/fk-indexes', '470'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/gin-trgm',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/gin-trgm', '621'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/gist-brin-hash',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/gist-brin-hash', 'bed'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/index-not-used',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/index-not-used', '353'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/index-only',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/index-only', 'c17'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/multicolumn',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/multicolumn', '039'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/partial',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/partial', '70c'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/pg-stat-statements',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/pg-stat-statements', 'a25'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/scan-types',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/scan-types', 'c77'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/statistics',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/statistics', 'c05'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/unused-indexes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/unused-indexes', 'c04'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-10-indexes/what-index',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-10-indexes/what-index', 'c93'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc', 'a4f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/acid',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/acid', '122'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/advisory-locks',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/advisory-locks', '993'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/begin-commit',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/begin-commit', 'f88'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/deadlocks',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/deadlocks', '7d9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/idle-in-transaction',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/idle-in-transaction', 'e26'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/isolation-levels',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/isolation-levels', 'fe2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/long-transactions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/long-transactions', '1a1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/lost-update',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/lost-update', 'f3d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/mvcc',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/mvcc', 'f45'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/read-committed',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/read-committed', '440'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/row-locks',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/row-locks', '4b6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/savepoints',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/savepoints', '72e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/skip-locked',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/skip-locked', '088'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/table-locks-ddl',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/table-locks-ddl', 'c64'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/vacuum',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/vacuum', 'e21'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-11-mvcc/xid-wraparound',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-11-mvcc/xid-wraparound', '4e5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables', 'f78'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/audit-history-tables',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/audit-history-tables', '609'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/build-json-sql',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/build-json-sql', 'c5a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/column-vs-json',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/column-vs-json', 'a45'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/extensions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/extensions', '256'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/fdw',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/fdw', '54d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text', 'eb5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text/indexing-and-ranking',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text/indexing-and-ranking', 'a31'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text/tsvector-and-queries',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/full-text/tsvector-and-queries', '1bb'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/index-jsonb',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/index-jsonb', '1cf'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators', '6e6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators/accessors-and-paths',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators/accessors-and-paths', '609'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators/containment-and-jsonpath',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/jsonb-operators/containment-and-jsonpath', '9ff'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/listen-notify',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/listen-notify', '20e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/matviews',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/matviews', '86d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/partitioning',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/partitioning', 'a13'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/pg-trgm',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/pg-trgm', '07d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/pgvector',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/pgvector', 'da2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/plpgsql',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/plpgsql', '8d7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/procedures',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/procedures', '400'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/srf',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/srf', '399'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/transactional-outbox',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/transactional-outbox', 'd16'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/triggers',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/triggers', 'ad2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-12-beyond-tables/views',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-12-beyond-tables/views', 'e73'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops', 'df0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/app-role-not-owner',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/app-role-not-owner', '145'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/config-keys',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/config-keys', '69b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/config-keys/changing-a-setting',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/config-keys/changing-a-setting', 'e94'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/config-keys/memory',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/config-keys/memory', '4e3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/config-keys/planner-wal-and-changing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/config-keys/planner-wal-and-changing', '463'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/disaster-drill',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/disaster-drill', '15d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/logging',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/logging', 'd23'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/logging/parameters-and-auto-explain',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/logging/parameters-and-auto-explain', '60b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/logging/what-to-log',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/logging/what-to-log', 'f1d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/logical-replication',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/logical-replication', '638'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/major-upgrades',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/major-upgrades', 'dc2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres', 'af7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres/providers-and-connecting',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres/providers-and-connecting', '857'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres/what-you-give-up',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/managed-postgres/what-you-give-up', '6b8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring', 'bfc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring/database-health',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring/database-health', 'fe0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring/pg-stat-statements',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring/pg-stat-statements', '186'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring/reading-pg-stat-statements',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring/reading-pg-stat-statements', '219'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring/table-health',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring/table-health', '12b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/monitoring/whats-happening-now',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/monitoring/whats-happening-now', '90e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore', '1f9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore/dump-formats',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore/dump-formats', '9e8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore/restoring',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pg-dump-restore/restoring', '8a2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pg-hba',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pg-hba', 'af8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer', 'b30'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/exhaustion-and-sizing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/exhaustion-and-sizing', '660'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/node-and-observing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/node-and-observing', '785'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/pool-modes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/pool-modes', '037'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/why-connections-cost',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/pgbouncer/why-connections-cost', '17d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/physical-backup',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/physical-backup', 'fb0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/physical-backup/archiving',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/physical-backup/archiving', 'ea9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/physical-backup/restoring-and-rpo',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/physical-backup/restoring-and-rpo', 'fa2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/replication',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/replication', '98e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/replication/conflicts-and-routing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/replication/conflicts-and-routing', '6c2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/replication/lag-and-read-your-writes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/replication/lag-and-read-your-writes', '313'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/rls',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/rls', 'fd3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/rls/carrying-the-identity',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/rls/carrying-the-identity', 'f56'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/rls/performance-and-practice',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/rls/performance-and-practice', 'b74'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/rls/policies',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/rls/policies', '093'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/roles-grant',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/roles-grant', '17e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/columns-and-ownership',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/columns-and-ownership', '73d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/defaults-and-auditing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/defaults-and-auditing', '615'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/grant-and-revoke',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/grant-and-revoke', 'a72'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/roles-and-membership',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/roles-grant/roles-and-membership', '7fc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/secrets',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/secrets', '9b2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/secrets/storing-and-rotating',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/secrets/storing-and-rotating', 'eb8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/secrets/where-secrets-leak',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/secrets/where-secrets-leak', '918'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/tls',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/tls', 'eae'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl', 'e9d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/expand-and-contract',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/expand-and-contract', '22a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/indexes-and-checklist',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/indexes-and-checklist', 'b71'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/the-lock-queue',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-13-ops/zero-downtime-ddl/the-lock-queue', '9e4'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types', '6c9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/arrays',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/arrays', '4be'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/boolean-dates',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/boolean-dates', 'c0d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/bytea',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/bytea', 'ae8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/casting',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/casting', '09b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/domains-composites',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/domains-composites', '0ac'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/enum-check-lookup',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/enum-check-lookup', '345'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/integers',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/integers', '481'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/jsonb',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/jsonb', '300'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/modelling-money',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/modelling-money', '748'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/modelling-money/arithmetic-and-rounding',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/modelling-money/arithmetic-and-rounding', '8e8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/modelling-money/ledgers-and-node',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/modelling-money/ledgers-and-node', '57f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/modelling-money/storing-money',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/modelling-money/storing-money', '95f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/network-geo-citext',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/network-geo-citext', '60e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/null',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/null', '067'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/numeric-vs-float',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/numeric-vs-float', '84a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/ranges',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/ranges', 'cfe'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/text',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/text', '15d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/time-zones',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/time-zones', '8cb'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/timestamptz',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/timestamptz', 'c33'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-2-types/uuid',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-2-types/uuid', '188'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl', 'b18'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/add-not-null',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/add-not-null', 'b5d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/alter-table',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/alter-table', 'fa5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/comments',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/comments', 'da8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/constraints',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/constraints', 'e66'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/create-table',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/create-table', 'acb'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/deferrable',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/deferrable', '326'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/drop-cascade',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/drop-cascade', '7df'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/foreign-keys',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/foreign-keys', 'dd1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/generated-columns',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/generated-columns', '156'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/inheritance',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/inheritance', 'eb3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy', '109'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/choosing-a-model',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/choosing-a-model', 'f79'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/models-compared',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/models-compared', 'f43'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/operating-it',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/multi-tenancy/operating-it', 'edb'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/naming',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/naming', '6fc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/normalization',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/normalization', 'b28'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/primary-keys',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/primary-keys', 'c19'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/relationships',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/relationships', '5d3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/schemas-tenancy',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/schemas-tenancy', 'ecc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/sequences',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/sequences', 'cb8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/temp-unlogged',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/temp-unlogged', 'b95'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/transactional-ddl',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/transactional-ddl', '996'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-3-ddl/unique-nulls',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-3-ddl/unique-nulls', '190'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud', '991'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/datetime-functions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/datetime-functions', '41c'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/delete',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/delete', '38f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/distinct-on',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/distinct-on', '4f9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/expressions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/expressions', '838'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/generate-series',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/generate-series', '257'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/insert',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/insert', '94e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/limit-offset',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/limit-offset', '4e0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/logical-order',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/logical-order', 'bb9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/merge',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/merge', 'f41'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/merge/returning-and-merge-action',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/merge/returning-and-merge-action', 'a3f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/merge/three-actions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/merge/three-actions', '135'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/merge/vs-on-conflict',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/merge/vs-on-conflict', '62a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/on-conflict',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/on-conflict', 'e26'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/order-by',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/order-by', '7bc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/parameters',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/parameters', '694'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/returning',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/returning', '50c'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/select-shape',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/select-shape', 'b29'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/string-functions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/string-functions', '802'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/truncate',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/truncate', '597'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/tuple-comparison',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/tuple-comparison', 'a6e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/update',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/update', '6ca'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/values-unnest',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/values-unnest', 'c97'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-4-crud/where-predicates',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-4-crud/where-predicates', '1ef'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins', '61d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/alias-discipline',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/alias-discipline', '627'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/cross-join',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/cross-join', '59b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/inner-join',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/inner-join', '98e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/inner-join/fan-out-and-aggregates',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/inner-join/fan-out-and-aggregates', '539'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/inner-join/matching-pairs',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/inner-join/matching-pairs', 'ad7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/join-expressions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/join-expressions', '4ea'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/lateral',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/lateral', '047'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/left-join',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/left-join', '047'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/left-join/null-extension',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/left-join/null-extension', 'ca0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/left-join/on-vs-where',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/left-join/on-vs-where', 'df7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/multi-join',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/multi-join', '0b9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/nn-join-table',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/nn-join-table', 'aa1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/on-using-natural',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/on-using-natural', 'cd8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/outer-joins',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/outer-joins', 'e32'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/self-join',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/self-join', 'b16'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/semi-anti',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/semi-anti', '7a8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/semi-anti/anti-joins',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/semi-anti/anti-joins', '613'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/semi-anti/semi-joins',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/semi-anti/semi-joins', '8ee'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-5-joins/set-ops',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-5-joins/set-ops', '2b7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation', '73d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants', 'ded'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/left-join-and-fan-out',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/left-join-and-fan-out', '045'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/three-questions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/three-questions', 'f6f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/what-counting-costs',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/count-variants/what-counting-costs', '91e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ctes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ctes', '74a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/naming-a-subquery',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/naming-a-subquery', '98d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/references-and-hints',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/references-and-hints', '9f8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/the-inlining-rule',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ctes/the-inlining-rule', '8e9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause', 'e7f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause/conditional-aggregation',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause/conditional-aggregation', 'c7d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause/when-it-pays',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/filter-clause/when-it-pays', '1fd'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/frames',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/frames', '5a7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/frames/range-groups-exclude',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/frames/range-groups-exclude', 'e95'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/frames/rows-vs-range',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/frames/rows-vs-range', 'e09'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by', '49b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/collapsing-rows',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/collapsing-rows', '68c'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/empty-groups-and-keys',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/empty-groups-and-keys', '36b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/how-it-executes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/how-it-executes', '23e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/ordinals-and-distinct',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/ordinals-and-distinct', '9e3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/what-you-can-select',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/group-by/what-you-can-select', '25a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets', '980'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets/grouping-and-labels',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets/grouping-and-labels', '2e1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets/sets-rollup-cube',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/grouping-sets/sets-rollup-cube', 'da0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/having',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/having', '959'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/having/groups-vs-rows',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/having/groups-vs-rows', '98e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/having/what-having-costs',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/having/what-having-costs', '960'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg', '9b3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/arrays-and-strings',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/arrays-and-strings', '351'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/json-shapes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/json-shapes', 'ac1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/the-empty-array-trap',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/json-agg/the-empty-array-trap', 'c5f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead', '102'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead/first-and-last',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead/first-and-last', '6c7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead/lag-and-lead',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/lag-lead/lag-and-lead', '3cd'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes', '46e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes/one-statement-many-writes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes/one-statement-many-writes', 'b05'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes/the-snapshot-rule',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/modifying-ctes/the-snapshot-rule', '989'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set', 'b21'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set/mode-and-booleans',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set/mode-and-booleans', '9af'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set/percentiles',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ordered-set/percentiles', '32a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts', '9b6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts/estimates-and-caps',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts/estimates-and-caps', 'c29'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts/what-total-costs',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/pagination-counts/what-total-costs', '611'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ranking',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ranking', 'bbc'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ranking/the-four-functions',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ranking/the-four-functions', 'a9d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/ranking/top-n-per-group',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/ranking/top-n-per-group', '8d8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte', 'abf'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte/cycles-and-limits',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte/cycles-and-limits', '43d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte/walking-a-tree',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/recursive-cte/walking-a-tree', 'fe6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries', '82f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/correlated-and-cost',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/correlated-and-cost', '35a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/in-exists-and-not-in',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/in-exists-and-not-in', 'fae'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/scalar-and-row',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/subqueries/scalar-and-row', '827'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro', '190'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/over-vs-group-by',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/over-vs-group-by', 'ed8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/what-windows-cost',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/what-windows-cost', 'c1d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/where-windows-run',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-6-aggregation/windows-intro/where-windows-run', '5f1'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver', '2f2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/connect-release',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/connect-release', '6b9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/connection-config',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/connection-config', 'e18'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/cursors',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/cursors', '222'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/errors',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/errors', '1c9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/install-wire',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/install-wire', '38e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/listen-notify',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/listen-notify', '6a5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/one-statement',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/one-statement', '11f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/pg-types',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/pg-types', '710'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/pool-end',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/pool-end', '504'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/pool-vs-client',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/pool-vs-client', '999'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/postgres-js',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/postgres-js', '1a7'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/prepared',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/prepared', '5b5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/query-placeholders',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/query-placeholders', 'd73'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/result-object',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/result-object', 'a19'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/timeouts',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/timeouts', '616'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-7-pg-driver/type-parsing',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-7-pg-driver/type-parsing', 'dfb'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node', '873'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/bulk-insert',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/bulk-insert', 'd52'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/codegen-types',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/codegen-types', '835'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/copy-streams',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/copy-streams', 'd35'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node', '7a0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/issuing-ddl',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/issuing-ddl', 'fa9'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/locks-and-blocking',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/locks-and-blocking', '04f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/startup-races',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/ddl-from-node/startup-races', 'ee6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/if-not-exists',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/if-not-exists', '402'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/local-dev-db',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/local-dev-db', 'e6e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/migration-tools',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/migration-tools', '989'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/migrations',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/migrations', 'cd3'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/minimal-runner',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/minimal-runner', '72f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/schema-drift',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/schema-drift', '284'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/seeding',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/seeding', 'd47'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/sql-files',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/sql-files', '752'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/test-reset',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/test-reset', '7d5'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-8-schema-from-node/tx-migration',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-8-schema-from-node/tx-migration', '0da'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud', '720'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists', '2fd'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists/building-the-allowlist',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists/building-the-allowlist', '5d0'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists/two-failure-modes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/allowlists/two-failure-modes', '257'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/client-propagation',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/client-propagation', '92b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/create',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/create', '7b8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/delete-soft-hard',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/delete-soft-hard', '1cd'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/find-by-id',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/find-by-id', '9e8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/for-update',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/for-update', 'b0d'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/idempotent-writes',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/idempotent-writes', 'f48'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/keyset',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/keyset', 'b18'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/keyset/cursors-and-traps',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/keyset/cursors-and-traps', '088'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/keyset/the-tuple-comparison',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/keyset/the-tuple-comparison', 'ec6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/list-endpoint',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/list-endpoint', '7d8'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/optimistic',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/optimistic', '313'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/repository',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/repository', 'fa4'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/repository/errors-to-http',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/repository/errors-to-http', '754'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/repository/rows-to-domain',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/repository/rows-to-domain', 'bf6'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/repository/the-executor-contract',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/repository/the-executor-contract', 'ea2'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where', 'a64'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where/patterns-and-composition',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where/patterns-and-composition', '983'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where/predicates-and-params',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/safe-dynamic-where/predicates-and-params', '059'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/shape-sql-vs-js',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/shape-sql-vs-js', '05e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/snake-camel',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/snake-camel', 'f1f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/testing-real-pg',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/testing-real-pg', 'efe'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/timestamps-trigger',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/timestamps-trigger', 'b1f'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request', '904'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request/savepoints-and-duration',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request/savepoints-and-duration', 'e6b'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request/the-wrapper',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/transactions-request/the-wrapper', '013'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/pages/phase-9-api-crud/update-partial',
                component: ComponentCreator('/devbible/docs/postgresql/pages/phase-9-api-crud/update-partial', '19a'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/syllabus/foundations',
                component: ComponentCreator('/devbible/docs/postgresql/syllabus/foundations', '7ff'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/syllabus/node-and-pg',
                component: ComponentCreator('/devbible/docs/postgresql/syllabus/node-and-pg', '36e'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/syllabus/performance-and-production',
                component: ComponentCreator('/devbible/docs/postgresql/syllabus/performance-and-production', '932'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/postgresql/syllabus/sql',
                component: ComponentCreator('/devbible/docs/postgresql/syllabus/sql', 'e95'),
                exact: true,
                sidebar: "postgresqlSidebar"
              },
              {
                path: '/devbible/docs/react',
                component: ComponentCreator('/devbible/docs/react', '572'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages',
                component: ComponentCreator('/devbible/docs/react/pages', '14c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs', '101'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/createroot',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/createroot', 'ded'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/devtools-and-profiler',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/devtools-and-profiler', '90e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/fiber',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/fiber', 'fe2'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/other-renderers',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/other-renderers', '8dd'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/react-vs-alternatives',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/react-vs-alternatives', 'e25'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/reconciliation',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/reconciliation', '957'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/render-reconcile-commit',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/render-reconcile-commit', 'eee'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/starting-a-project',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/starting-a-project', '407'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/strictmode',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/strictmode', 'a0b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/the-compiler',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/the-compiler', '93f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/the-element',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/the-element', '8d6'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/versions-and-channels',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/versions-and-channels', '163'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/what-changed-in-19',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/what-changed-in-19', 'd52'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-0-how-react-runs/what-react-is',
                component: ComponentCreator('/devbible/docs/react/pages/phase-0-how-react-runs/what-react-is', '11b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx', '358'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/attributes-vs-props',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/attributes-vs-props', '30e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/capitalization',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/capitalization', '317'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/children',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/children', 'b31'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/conditional-rendering',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/conditional-rendering', '781'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/dangerously-set-inner-html',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/dangerously-set-inner-html', '79f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/embedding-expressions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/embedding-expressions', 'dff'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/form-elements',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/form-elements', 'a5e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/form-elements/controlled-and-uncontrolled',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/form-elements/controlled-and-uncontrolled', '379'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/form-elements/select-textarea-and-formdata',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/form-elements/select-textarea-and-formdata', 'e8c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/fragments',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/fragments', '16f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/inline-style',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/inline-style', '3ce'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/jsx-is-a-function-call',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/jsx-is-a-function-call', '865'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/lists-and-keys',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/lists-and-keys', '1d5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/spreading-props',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/spreading-props', '955'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/the-classic-runtime',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/the-classic-runtime', 'cd5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/what-can-be-rendered',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/what-can-be-rendered', 'e2f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-1-jsx/whitespace-and-text',
                component: ComponentCreator('/devbible/docs/react/pages/phase-1-jsx/whitespace-and-text', '912'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components', '759'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/async-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/async-components', 'e23'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/calling-server-functions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/calling-server-functions', '6f2'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/composition-rules',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/composition-rules', '0d7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/data-fetching-in-rsc',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/data-fetching-in-rsc', '96e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/december-2025-advisories',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/december-2025-advisories', 'bfa'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/nextjs-vs-react-router',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/nextjs-vs-react-router', 'a73'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/renderer-packages',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/renderer-packages', 'e10'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/server-components-as-children',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/server-components-as-children', 'afe'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/server-function-security',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/server-function-security', '339'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/server-function-security/everything-is-an-endpoint',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/server-function-security/everything-is-an-endpoint', 'b08'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/server-function-security/what-the-framework-does',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/server-function-security/what-the-framework-does', 'c2b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/taint-apis',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/taint-apis', '523'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/the-rsc-payload',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/the-rsc-payload', '057'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/two-module-graphs',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/two-module-graphs', '29f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/use-client',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/use-client', 'cdc'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/use-server',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/use-server', '614'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is', '5c4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is/defaults-and-limits',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is/defaults-and-limits', '711'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is/the-definition',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/what-a-server-component-is/the-definition', '7e4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/what-crosses-the-boundary',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/what-crosses-the-boundary', '8c1'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/when-rsc-is-wrong',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/when-rsc-is-wrong', '708'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/where-interactivity-goes',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/where-interactivity-goes', '853'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-10-server-components/without-a-framework',
                component: ComponentCreator('/devbible/docs/react/pages/phase-10-server-components/without-a-framework', '9f8'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration', '18b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/csr-ssr-ssg-streaming-rsc',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/csr-ssr-ssg-streaming-rsc', '2be'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/hydrateroot',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/hydrateroot', 'bd0'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/hydration-mismatches',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/hydration-mismatches', '964'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/selective-hydration',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/selective-hydration', '8b7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/streaming-ssr',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/streaming-ssr', '370'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/suppresshydrationwarning',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/suppresshydrationwarning', '073'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-11-ssr-hydration/the-server-renderers',
                component: ComponentCreator('/devbible/docs/react/pages/phase-11-ssr-hydration/the-server-renderers', '1f1'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components', '45a'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/children-patterns',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/children-patterns', 'a86'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/class-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/class-components', 'd37'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/class-components/anatomy-and-this',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/class-components/anatomy-and-this', '0b9'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/class-components/lifecycle-and-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/class-components/lifecycle-and-hooks', '53b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/component-boundaries',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/component-boundaries', '620'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/composition',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/composition', '172'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/composition/slots-and-children',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/composition/slots-and-children', '39e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/composition/the-configuration-trap',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/composition/the-configuration-trap', '2b9'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled', 'a19'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled/the-switch-warning',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled/the-switch-warning', '194'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled/who-owns-the-value',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/controlled-vs-uncontrolled/who-owns-the-value', '62b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/destructuring-and-defaults',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/destructuring-and-defaults', '29a'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/element-manipulation',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/element-manipulation', '335'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/function-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/function-components', 'f03'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/function-components/identity-and-nesting',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/function-components/identity-and-nesting', '889'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/function-components/what-makes-a-component',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/function-components/what-makes-a-component', '1d0'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/higher-order-components',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/higher-order-components', '868'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/lifting-state-up',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/lifting-state-up', 'b05'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/lifting-state-up/the-cost',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/lifting-state-up/the-cost', '8d4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/lifting-state-up/the-procedure',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/lifting-state-up/the-procedure', '5f8'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/portals',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/portals', 'f27'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/props-are-read-only',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/props-are-read-only', '37f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/purecomponent',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/purecomponent', '096'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/purity',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/purity', '907'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/purity/strictmode-and-the-compiler',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/purity/strictmode-and-the-compiler', 'ff7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/purity/the-two-rules',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/purity/the-two-rules', '80c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/purity/what-is-allowed',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/purity/what-is-allowed', '977'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/ref-as-a-prop',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/ref-as-a-prop', 'b78'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-2-components/render-props',
                component: ComponentCreator('/devbible/docs/react/pages/phase-2-components/render-props', '557'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state', 'c6b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/automatic-batching',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/automatic-batching', '8ce'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/bailing-out',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/bailing-out', '7db'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/derived-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/derived-state', '172'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/immutable-updates',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/immutable-updates', 'fcc'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/immutable-updates/arrays-and-tools',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/immutable-updates/arrays-and-tools', '7ea'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/immutable-updates/objects-and-nesting',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/immutable-updates/objects-and-nesting', '5e1'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/infinite-render-loops',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/infinite-render-loops', '39f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/lazy-initial-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/lazy-initial-state', 'd29'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/preserving-and-resetting',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/preserving-and-resetting', 'b4e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/render-order',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/render-order', '282'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/resetting-state-with-key',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/resetting-state-with-key', '805'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/state-in-lists',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/state-in-lists', '077'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/state-is-a-snapshot',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/state-is-a-snapshot', 'd6d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/structuring-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/structuring-state', 'ab4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/the-update-queue',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/the-update-queue', '07d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/updater-functions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/updater-functions', '773'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/updating-state-during-render',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/updating-state-during-render', '1a4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/usestate',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/usestate', 'd7b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-3-state/what-triggers-a-re-render',
                component: ComponentCreator('/devbible/docs/react/pages/phase-3-state/what-triggers-a-re-render', '1de'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects', '81e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/cleanup',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/cleanup', 'ecf'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/cleanup/cleanup-recipes',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/cleanup/cleanup-recipes', 'ea6'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/cleanup/the-cleanup-contract',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/cleanup/the-cleanup-contract', 'dc9'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/cleanup/when-cleanup-is-not-the-answer',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/cleanup/when-cleanup-is-not-the-answer', '305'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/effect-lifecycle',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/effect-lifecycle', '696'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/effect-ordering',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/effect-ordering', '0a3'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/effects-and-refs',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/effects-and-refs', '74d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/external-store',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/external-store', 'f4c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/fetching-data',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/fetching-data', '2f3'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/race-conditions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/race-conditions', '44a'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/removing-dependencies',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/removing-dependencies', 'd3b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/removing-dependencies/objects-and-functions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/removing-dependencies/objects-and-functions', 'f89'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/removing-dependencies/restructuring-the-effect',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/removing-dependencies/restructuring-the-effect', 'aac'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/removing-dependencies/the-illegitimate-fixes',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/removing-dependencies/the-illegitimate-fixes', '065'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/skipping-the-first-run',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/skipping-the-first-run', 'fec'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/strictmode-double-invocation',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/strictmode-double-invocation', '9da'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/the-dependency-array',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/the-dependency-array', '3e4'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/timers-listeners-observers',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/timers-listeners-observers', '0de'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/useeffect-anatomy',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/useeffect-anatomy', '984'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/useeffectevent',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/useeffectevent', 'd9a'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/useinsertioneffect',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/useinsertioneffect', '549'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/uselayouteffect',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/uselayouteffect', '15d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/what-an-effect-is-for',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/what-an-effect-is-for', '630'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect', '3c0'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/chains-of-effects',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/chains-of-effects', '169'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/logic-that-belongs-to-an-event',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/logic-that-belongs-to-an-event', '6ef'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/state-that-belongs-elsewhere',
                component: ComponentCreator('/devbible/docs/react/pages/phase-4-effects/you-might-not-need-an-effect/state-that-belongs-elsewhere', 'ab0'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers', '243'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/context-plus-reducer',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/context-plus-reducer', '218'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/context-re-render-problem',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/context-re-render-problem', '4b9'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/createcontext-usecontext',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/createcontext-usecontext', '6cd'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/default-context-value',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/default-context-value', 'c4f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs', 'eca'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs/attaching-and-using',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs/attaching-and-using', '13f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs/crossing-boundaries',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/dom-refs/crossing-boundaries', '841'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/reducer-patterns',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/reducer-patterns', 'c43'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/ref-callbacks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/ref-callbacks', '24f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/usedebugvalue',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/usedebugvalue', '237'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/useid',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/useid', '1d9'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/useimperativehandle',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/useimperativehandle', '414'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/usereducer',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/usereducer', '77f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/useref',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/useref', '020'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/usestate-vs-usereducer',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/usestate-vs-usereducer', '8ef'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/usesyncexternalstore',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/usesyncexternalstore', 'e46'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/what-context-is-and-is-not',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/what-context-is-and-is-not', '482'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-5-refs-context-reducers/when-a-ref-is-wrong',
                component: ComponentCreator('/devbible/docs/react/pages/phase-5-refs-context-reducers/when-a-ref-is-wrong', '566'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance', 'f0b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/bundle-size',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/bundle-size', '43e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/do-you-still-write-usememo',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/do-you-still-write-usememo', '567'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/eslint-plugin-react-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/eslint-plugin-react-hooks', 'f7c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/expensive-initial-mount',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/expensive-initial-mount', 'c15'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/how-the-compiler-bails-out',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/how-the-compiler-bails-out', 'df5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/installing-the-compiler',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/installing-the-compiler', '065'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/lazy-loading',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/lazy-loading', '184'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/list-virtualization',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/list-virtualization', 'e90'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/measure-before-you-optimise',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/measure-before-you-optimise', '04c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/memo',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/memo', 'a94'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/moving-state-down',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/moving-state-down', 'f6d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/the-memoization-trap',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/the-memoization-trap', 'a1d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/the-react-compiler',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/the-react-compiler', '389'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/usecallback',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/usecallback', '6db'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/usedeferredvalue',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/usedeferredvalue', '427'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/usememo',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/usememo', 'b49'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-6-performance/why-did-this-re-render',
                component: ComponentCreator('/devbible/docs/react/pages/phase-6-performance/why-did-this-re-render', 'f88'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks', '6fb'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/conditional-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/conditional-hooks', '11b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api', 'ea5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api/the-name-and-the-arguments',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api/the-name-and-the-arguments', '1da'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api/the-return-value-and-the-seam',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/designing-a-hooks-api/the-return-value-and-the-seam', 'f6f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/extracting-too-early',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/extracting-too-early', '256'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects', '641'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects/dependencies-across-the-boundary',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects/dependencies-across-the-boundary', '957'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects/not-re-subscribing',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/hooks-that-wrap-effects/not-re-subscribing', '911'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks', '5d1'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/immutability',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/immutability', 'f4c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/purity-and-idempotence',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/purity-and-idempotence', 'f0f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/react-calls-components-and-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/react-calls-components-and-hooks', '20b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/refs-and-the-dom-in-render',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/rules-of-react-beyond-hooks/refs-and-the-dom-in-render', '0af'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state', 'ce2'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/external-stores',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/external-stores', '7c2'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/the-localstorage-trap',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/the-localstorage-trap', '06b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/two-callers-two-states',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/two-callers-two-states', 'd6d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/when-you-wanted-shared-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/share-logic-not-state/when-you-wanted-shared-state', 'c39'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/testing-a-custom-hook',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/testing-a-custom-hook', '0a7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-rules-of-hooks',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-rules-of-hooks', '993'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set', '931'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/browser-state',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/browser-state', '8c7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/events-and-the-dom',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/events-and-the-dom', '2b3'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/observing-an-element',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/observing-an-element', 'c0d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/timers-and-lifecycle',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/timers-and-lifecycle', '02f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/value-helpers',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/the-standard-set/value-helpers', '405'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/use-breaks-the-rule',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/use-breaks-the-rule', 'be8'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist', 'ee3'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist/deriving-the-forbidden-places',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist/deriving-the-forbidden-places', '9d8'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist/the-array-and-the-index',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/why-the-rules-exist/the-array-and-the-index', '098'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-7-custom-hooks/writing-a-custom-hook',
                component: ComponentCreator('/devbible/docs/react/pages/phase-7-custom-hooks/writing-a-custom-hook', '817'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense', '899'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/activity',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/activity', '616'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/async-transitions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/async-transitions', 'a91'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/boundary-placement',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/boundary-placement', '7e5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/cache-and-cachesignal',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/cache-and-cachesignal', '4ee'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/error-boundaries-and-suspense',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/error-boundaries-and-suspense', '882'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/request-waterfalls',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/request-waterfalls', 'e18'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense', '0f0'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense-inside-a-transition',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense-inside-a-transition', 'e33'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense/state-effects-and-resuspending',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense/state-effects-and-resuspending', 'e23'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense/the-boundary-and-the-fallback',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/suspense/the-boundary-and-the-fallback', '83e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/suspenselist',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/suspenselist', '43d'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/tearing',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/tearing', '175'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/urgent-vs-transition',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/urgent-vs-transition', 'aa1'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/use-context',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/use-context', '59c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/use-promise',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/use-promise', '01e'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/usedeferredvalue',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/usedeferredvalue', '1e7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition', '288'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition/ispending-and-which-tool',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition/ispending-and-which-tool', 'cbe'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition/marking-an-update-non-urgent',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/usetransition/marking-an-update-non-urgent', '727'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/view-transitions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/view-transitions', '237'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/what-can-suspend',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/what-can-suspend', 'cb3'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-8-concurrent-suspense/what-concurrent-rendering-means',
                component: ComponentCreator('/devbible/docs/react/pages/phase-8-concurrent-suspense/what-concurrent-rendering-means', '6ea'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions', 'eb8'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/accessible-forms',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/accessible-forms', '9ad'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/actions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/actions', '6b7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs', '14c'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs/every-input-type',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs/every-input-type', 'a90'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs/the-controlled-contract',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/controlled-inputs/the-controlled-contract', 'c80'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/errors-in-actions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/errors-in-actions', 'e40'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/form-libraries',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/form-libraries', '455'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/form-reset',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/form-reset', 'a32'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/multiple-actions',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/multiple-actions', '0d5'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/progressive-enhancement',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/progressive-enhancement', '87f'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/uncontrolled-and-formdata',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/uncontrolled-and-formdata', '9ff'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/useactionstate',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/useactionstate', 'd3b'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/useformstate',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/useformstate', 'bd2'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/useformstatus',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/useformstatus', '48a'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/useoptimistic',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/useoptimistic', 'd76'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/pages/phase-9-forms-actions/validation',
                component: ComponentCreator('/devbible/docs/react/pages/phase-9-forms-actions/validation', 'a06'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/syllabus/building-an-app',
                component: ComponentCreator('/devbible/docs/react/syllabus/building-an-app', 'c65'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/syllabus/concurrent-and-server',
                component: ComponentCreator('/devbible/docs/react/syllabus/concurrent-and-server', '9ac'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/syllabus/hooks',
                component: ComponentCreator('/devbible/docs/react/syllabus/hooks', '9b7'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/react/syllabus/the-react-model',
                component: ComponentCreator('/devbible/docs/react/syllabus/the-react-model', '480'),
                exact: true,
                sidebar: "reactSidebar"
              },
              {
                path: '/devbible/docs/redis',
                component: ComponentCreator('/devbible/docs/redis', 'c25'),
                exact: true
              },
              {
                path: '/devbible/docs/redis/pages',
                component: ComponentCreator('/devbible/docs/redis/pages', 'e5c'),
                exact: true
              },
              {
                path: '/devbible/docs/redis/syllabus/data-types',
                component: ComponentCreator('/devbible/docs/redis/syllabus/data-types', '79a'),
                exact: true
              },
              {
                path: '/devbible/docs/redis/syllabus/from-node',
                component: ComponentCreator('/devbible/docs/redis/syllabus/from-node', '53c'),
                exact: true
              },
              {
                path: '/devbible/docs/redis/syllabus/how-redis-works',
                component: ComponentCreator('/devbible/docs/redis/syllabus/how-redis-works', '7e4'),
                exact: true
              },
              {
                path: '/devbible/docs/redis/syllabus/production',
                component: ComponentCreator('/devbible/docs/redis/syllabus/production', '628'),
                exact: true
              },
              {
                path: '/devbible/docs/redux-toolkit',
                component: ComponentCreator('/devbible/docs/redux-toolkit', '17c'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages', '26d'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/async-thunks/create-async-thunk',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/async-thunks/create-async-thunk', '30b'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/code-splitting/dynamic-reducer-injection',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/code-splitting/dynamic-reducer-injection', 'bd7'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/devtools-and-debugging/redux-devtools',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/devtools-and-debugging/redux-devtools', '85c'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/immutability-and-immer/immer-internals',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/immutability-and-immer/immer-internals', '339'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/middleware/default-middleware-and-listener-middleware',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/middleware/default-middleware-and-listener-middleware', '660'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/migration/from-classic-redux',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/migration/from-classic-redux', '3d6'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/react-redux-integration/hooks-api',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/react-redux-integration/hooks-api', 'ef2'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/rtk-query/api-slice-and-endpoints',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/rtk-query/api-slice-and-endpoints', 'fe2'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/rtk-query/cache-management-and-invalidation',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/rtk-query/cache-management-and-invalidation', 'c45'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/selectors-and-normalization/create-entity-adapter',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/selectors-and-normalization/create-entity-adapter', '636'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/selectors-and-normalization/create-selector-and-reselect',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/selectors-and-normalization/create-selector-and-reselect', 'd67'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/slices-and-actions/create-action-and-matchers',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/slices-and-actions/create-action-and-matchers', 'cc1'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/slices-and-actions/create-slice',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/slices-and-actions/create-slice', 'be9'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/store-setup/configure-store',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/store-setup/configure-store', '435'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/testing/testing-redux-logic',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/testing/testing-redux-logic', '849'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/redux-toolkit/pages/typescript-integration/type-inference-patterns',
                component: ComponentCreator('/devbible/docs/redux-toolkit/pages/typescript-integration/type-inference-patterns', '931'),
                exact: true,
                sidebar: "reduxToolkitSidebar"
              },
              {
                path: '/devbible/docs/storybook',
                component: ComponentCreator('/devbible/docs/storybook', 'd79'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages',
                component: ComponentCreator('/devbible/docs/storybook/pages', '160'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/accessibility-testing/a11y-addon',
                component: ComponentCreator('/devbible/docs/storybook/pages/accessibility-testing/a11y-addon', '409'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/addons-ecosystem/actions-panel-in-depth',
                component: ComponentCreator('/devbible/docs/storybook/pages/addons-ecosystem/actions-panel-in-depth', '642'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/addons-ecosystem/essential-addons',
                component: ComponentCreator('/devbible/docs/storybook/pages/addons-ecosystem/essential-addons', '106'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/advanced-patterns/component-driven-workflow',
                component: ComponentCreator('/devbible/docs/storybook/pages/advanced-patterns/component-driven-workflow', '50d'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/build-and-configuration/advanced-main-and-preview-customization',
                component: ComponentCreator('/devbible/docs/storybook/pages/build-and-configuration/advanced-main-and-preview-customization', '287'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/build-and-configuration/manager-ui-builder-hooks-and-env',
                component: ComponentCreator('/devbible/docs/storybook/pages/build-and-configuration/manager-ui-builder-hooks-and-env', 'a14'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/build-and-configuration/storybook-main',
                component: ComponentCreator('/devbible/docs/storybook/pages/build-and-configuration/storybook-main', '906'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/composition-and-design-systems/storybook-as-a-design-system-hub',
                component: ComponentCreator('/devbible/docs/storybook/pages/composition-and-design-systems/storybook-as-a-design-system-hub', 'b91'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/controls-and-args/dynamic-prop-editing',
                component: ComponentCreator('/devbible/docs/storybook/pages/controls-and-args/dynamic-prop-editing', '9fe'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/core-concepts/component-driven-development',
                component: ComponentCreator('/devbible/docs/storybook/pages/core-concepts/component-driven-development', '6d8'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/decorators/wrapping-stories',
                component: ComponentCreator('/devbible/docs/storybook/pages/decorators/wrapping-stories', '28e'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/documentation/docs-generation',
                component: ComponentCreator('/devbible/docs/storybook/pages/documentation/docs-generation', '4e0'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/interaction-testing/play-functions',
                component: ComponentCreator('/devbible/docs/storybook/pages/interaction-testing/play-functions', 'a66'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/multi-framework-support/renderer-architecture',
                component: ComponentCreator('/devbible/docs/storybook/pages/multi-framework-support/renderer-architecture', 'f80'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs', '4fc'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs/installing-into-an-existing-app',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs/installing-into-an-existing-app', '861'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs/manager-and-preview',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs/manager-and-preview', 'bb2'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs/renderers-and-builders',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs/renderers-and-builders', '3f2'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs/storybook-10-and-package-consolidation',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs/storybook-10-and-package-consolidation', 'ec0'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-0-how-storybook-runs/what-storybook-is',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-0-how-storybook-runs/what-storybook-is', '622'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format', '040'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/component-story-format',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/component-story-format', '91f'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/csf-factories',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/csf-factories', 'e2b'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/file-structure-and-the-glob',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/file-structure-and-the-glob', '5c3'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/naming-and-the-sidebar',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/naming-and-the-sidebar', 'e1c'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/reusing-stories',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/reusing-stories', 'd3e'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-1-story-format/typing-stories',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-1-story-format/typing-stories', 'e33'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls', '6a2'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/actions-and-spies',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/actions-and-spies', 'f0c'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/args-as-the-source-of-truth',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/args-as-the-source-of-truth', 'c6e'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/argtypes-and-inference',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/argtypes-and-inference', '3fc'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/globals-and-toolbars',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/globals-and-toolbars', '0ea'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/parameters-and-merge-order',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/parameters-and-merge-order', 'bd9'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-2-args-and-controls/the-controls-panel',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-2-args-and-controls/the-controls-panel', '249'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators', 'a22'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators/decorator-order',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators/decorator-order', '37b'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators/loaders-and-beforeeach',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators/loaders-and-beforeeach', 'ecb'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators/providers-in-decorators',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators/providers-in-decorators', '9e6'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators/the-story-context',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators/the-story-context', '140'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/phase-3-decorators/what-a-decorator-is',
                component: ComponentCreator('/devbible/docs/storybook/pages/phase-3-decorators/what-a-decorator-is', '992'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/publishing-and-deployment/shipping-a-static-storybook',
                component: ComponentCreator('/devbible/docs/storybook/pages/publishing-and-deployment/shipping-a-static-storybook', '001'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/real-world-workflows-and-recipes/bootstrapping-into-an-existing-app',
                component: ComponentCreator('/devbible/docs/storybook/pages/real-world-workflows-and-recipes/bootstrapping-into-an-existing-app', '53d'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/real-world-workflows-and-recipes/wiring-colors-and-custom-fonts',
                component: ComponentCreator('/devbible/docs/storybook/pages/real-world-workflows-and-recipes/wiring-colors-and-custom-fonts', '9db'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/story-anatomy/file-structure',
                component: ComponentCreator('/devbible/docs/storybook/pages/story-anatomy/file-structure', 'e7a'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/testing-integration/test-runner',
                component: ComponentCreator('/devbible/docs/storybook/pages/testing-integration/test-runner', '879'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/theming-colors-and-fonts/custom-fonts-and-typography',
                component: ComponentCreator('/devbible/docs/storybook/pages/theming-colors-and-fonts/custom-fonts-and-typography', '375'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/theming-colors-and-fonts/global-colors-themes-and-tokens',
                component: ComponentCreator('/devbible/docs/storybook/pages/theming-colors-and-fonts/global-colors-themes-and-tokens', '12f'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/pages/visual-testing/chromatic-integration',
                component: ComponentCreator('/devbible/docs/storybook/pages/visual-testing/chromatic-integration', 'f01'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/syllabus/composing-stories',
                component: ComponentCreator('/devbible/docs/storybook/syllabus/composing-stories', 'b2b'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/syllabus/configuration-and-shipping',
                component: ComponentCreator('/devbible/docs/storybook/syllabus/configuration-and-shipping', '0d2'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/syllabus/how-storybook-runs',
                component: ComponentCreator('/devbible/docs/storybook/syllabus/how-storybook-runs', '3f2'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/storybook/syllabus/testing-with-storybook',
                component: ComponentCreator('/devbible/docs/storybook/syllabus/testing-with-storybook', 'c41'),
                exact: true,
                sidebar: "storybookSidebar"
              },
              {
                path: '/devbible/docs/tanstack-query',
                component: ComponentCreator('/devbible/docs/tanstack-query', 'd2d'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages', '79f'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/background-refetching/automatic-freshness',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/background-refetching/automatic-freshness', 'e3b'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/caching-and-invalidation/cache-management-apis',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/caching-and-invalidation/cache-management-apis', '0f5'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/core-concepts/the-server-state-model',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/core-concepts/the-server-state-model', 'd79'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/dependent-and-parallel-queries/query-composition',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/dependent-and-parallel-queries/query-composition', 'd18'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/devtools/react-query-devtools',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/devtools/react-query-devtools', '271'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/global-configuration/defaultoptions',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/global-configuration/defaultoptions', '5fb'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/migration-recipes/rtk-query-to-tanstack-query',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/migration-recipes/rtk-query-to-tanstack-query', '58a'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/optimistic-updates-patterns/advanced-rollback-strategies',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/optimistic-updates-patterns/advanced-rollback-strategies', '03e'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/pagination-and-infinite-queries/paged-data-patterns',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/pagination-and-infinite-queries/paged-data-patterns', '12c'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/prefetching-and-ssr/server-rendered-data-flow',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/prefetching-and-ssr/server-rendered-data-flow', '4f7'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/query-cancellation/abortsignal-integration',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/query-cancellation/abortsignal-integration', 'c13'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/query-states/status-flags',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/query-states/status-flags', '8e5'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/suspense-integration/suspense-driven-fetching',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/suspense-integration/suspense-driven-fetching', '171'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/testing-tanstack-query/isolated-and-integration-testing',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/testing-tanstack-query/isolated-and-integration-testing', '613'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/usemutation/mutation-lifecycle',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/usemutation/mutation-lifecycle', '317'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/tanstack-query/pages/usequery-deep-dive/core-options',
                component: ComponentCreator('/devbible/docs/tanstack-query/pages/usequery-deep-dive/core-options', '655'),
                exact: true,
                sidebar: "tanstackQuerySidebar"
              },
              {
                path: '/devbible/docs/typescript',
                component: ComponentCreator('/devbible/docs/typescript', '60a'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages',
                component: ComponentCreator('/devbible/docs/typescript/pages', 'fc1'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs', '5d0'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/checking-vs-transpiling',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/checking-vs-transpiling', 'f5f'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/erasure',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/erasure', 'ada'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/language-server-vs-build',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/language-server-vs-build', 'b26'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/playground-and-ts-check',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/playground-and-ts-check', '03f'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/project-layout',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/project-layout', '825'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/release-cadence',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/release-cadence', '397'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/static-checker-not-runtime',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/static-checker-not-runtime', '985'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/strict',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/strict', 'bd6'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/strip-only-and-erasable-syntax',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/strip-only-and-erasable-syntax', 'e17'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/three-ways-to-run',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/three-ways-to-run', '507'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/tsconfig-anatomy',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/tsconfig-anatomy', 'b06'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/typescript-7-native-compiler',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/typescript-7-native-compiler', 'fe6'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-0-how-typescript-runs/where-types-come-from',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-0-how-typescript-runs/where-types-come-from', '488'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary', 'd83'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/any-unknown-never-void',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/any-unknown-never-void', 'de1'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/arrays-and-tuples',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/arrays-and-tuples', '3cf'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/call-and-construct-signatures',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/call-and-construct-signatures', '186'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/enum-vs-union',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/enum-vs-union', '675'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/function-types',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/function-types', 'dd2'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/intersection-types',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/intersection-types', 'b96'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/literal-types-and-as-const',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/literal-types-and-as-const', '553'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/null-and-undefined',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/null-and-undefined', '33b'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/object-Object-braces',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/object-Object-braces', 'cb3'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/object-types',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/object-types', '86a'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/primitives-and-inference',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/primitives-and-inference', '967'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/readonly-and-immutability',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/readonly-and-immutability', '7e1'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/recursive-types',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/recursive-types', '666'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/structural-typing',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/structural-typing', 'fe8'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/symbols',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/symbols', 'ae3'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/type-vs-interface',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/type-vs-interface', '3b7'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-1-type-vocabulary/union-types',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-1-type-vocabulary/union-types', '4d4'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/discriminated-unions',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/discriminated-unions', '4d8'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/exhaustiveness',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/exhaustiveness', '9f9'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/in-operator-narrowing',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/in-operator-narrowing', '410'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/instanceof-narrowing',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/instanceof-narrowing', 'a01'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/truthiness-and-equality',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/truthiness-and-equality', '14c'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/type-guards',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/type-guards', 'd01'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/pages/phase-2-narrowing/typeof-narrowing',
                component: ComponentCreator('/devbible/docs/typescript/pages/phase-2-narrowing/typeof-narrowing', '384'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/syllabus/in-the-stack',
                component: ComponentCreator('/devbible/docs/typescript/syllabus/in-the-stack', 'baf'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/syllabus/rigour-and-tooling',
                component: ComponentCreator('/devbible/docs/typescript/syllabus/rigour-and-tooling', '939'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/syllabus/type-system',
                component: ComponentCreator('/devbible/docs/typescript/syllabus/type-system', '880'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/typescript/syllabus/types-at-scale',
                component: ComponentCreator('/devbible/docs/typescript/syllabus/types-at-scale', '934'),
                exact: true,
                sidebar: "typescriptSidebar"
              },
              {
                path: '/devbible/docs/vite',
                component: ComponentCreator('/devbible/docs/vite', 'c3d'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages',
                component: ComponentCreator('/devbible/docs/vite/pages', 'f36'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/asset-handling/static-asset-imports',
                component: ComponentCreator('/devbible/docs/vite/pages/asset-handling/static-asset-imports', 'be6'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/build-system-rollup/build-options',
                component: ComponentCreator('/devbible/docs/vite/pages/build-system-rollup/build-options', 'dcd'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/cli-and-scaffolding/commands-and-templates',
                component: ComponentCreator('/devbible/docs/vite/pages/cli-and-scaffolding/commands-and-templates', '5af'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/configuration/vite-config-file',
                component: ComponentCreator('/devbible/docs/vite/pages/configuration/vite-config-file', '9dc'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/core-architecture/dual-engine-model',
                component: ComponentCreator('/devbible/docs/vite/pages/core-architecture/dual-engine-model', 'ddd'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/css-handling/styling-pipeline',
                component: ComponentCreator('/devbible/docs/vite/pages/css-handling/styling-pipeline', '49c'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/deployment-considerations/shipping-the-build',
                component: ComponentCreator('/devbible/docs/vite/pages/deployment-considerations/shipping-the-build', 'c8a'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/dev-server-mechanics/native-esm-and-hmr',
                component: ComponentCreator('/devbible/docs/vite/pages/dev-server-mechanics/native-esm-and-hmr', '09c'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/env-variables-and-modes/environment-system',
                component: ComponentCreator('/devbible/docs/vite/pages/env-variables-and-modes/environment-system', '57d'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/migration-recipes/cra-to-vite-migration',
                component: ComponentCreator('/devbible/docs/vite/pages/migration-recipes/cra-to-vite-migration', '0e2'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/optimization-and-performance/build-time-performance',
                component: ComponentCreator('/devbible/docs/vite/pages/optimization-and-performance/build-time-performance', '927'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/path-resolution-and-aliases/resolve-options',
                component: ComponentCreator('/devbible/docs/vite/pages/path-resolution-and-aliases/resolve-options', '481'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/plugin-system/plugin-api',
                component: ComponentCreator('/devbible/docs/vite/pages/plugin-system/plugin-api', '829'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/ssr-support/server-side-rendering-primitives',
                component: ComponentCreator('/devbible/docs/vite/pages/ssr-support/server-side-rendering-primitives', 'e97'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/testing-integration/vitest-relationship',
                component: ComponentCreator('/devbible/docs/vite/pages/testing-integration/vitest-relationship', '4f6'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/vite/pages/worker-and-wasm-support/advanced-runtime-targets',
                component: ComponentCreator('/devbible/docs/vite/pages/worker-and-wasm-support/advanced-runtime-targets', 'd6c'),
                exact: true,
                sidebar: "viteSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance',
                component: ComponentCreator('/devbible/docs/web-vitals-performance', '5ec'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages', 'df3'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/budgets-and-advanced-diagnostics/performance-budgets-and-deep-profiling',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/budgets-and-advanced-diagnostics/performance-budgets-and-deep-profiling', '73a'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/bundle-and-media-optimization/js-bundle-and-media-optimization',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/bundle-and-media-optimization/js-bundle-and-media-optimization', '125'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/caching-and-production-monitoring/caching-strategies-and-rum-tools',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/caching-and-production-monitoring/caching-strategies-and-rum-tools', '3f8'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/cls-optimization/preventing-cls',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/cls-optimization/preventing-cls', '8f4'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/core-web-vitals/lcp-inp-cls-fundamentals',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/core-web-vitals/lcp-inp-cls-fundamentals', '181'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/inp-optimization/reducing-inp',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/inp-optimization/reducing-inp', 'b8a'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/lcp-optimization/reducing-lcp',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/lcp-optimization/reducing-lcp', 'fc7'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/legacy-and-lab-measurement/legacy-metrics-and-lab-tools',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/legacy-and-lab-measurement/legacy-metrics-and-lab-tools', '2e4'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/loading-and-rendering-performance/delivery-and-runtime-rendering',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/loading-and-rendering-performance/delivery-and-runtime-rendering', 'b27'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/real-user-monitoring/web-vitals-library-and-rum',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/real-user-monitoring/web-vitals-library-and-rum', '25f'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/web-vitals-performance/pages/real-world-workflows-and-recipes/diagnosing-a-production-lcp-inp-regression',
                component: ComponentCreator('/devbible/docs/web-vitals-performance/pages/real-world-workflows-and-recipes/diagnosing-a-production-lcp-inp-regression', 'ad2'),
                exact: true,
                sidebar: "webVitalsPerformanceSidebar"
              },
              {
                path: '/devbible/docs/webpack',
                component: ComponentCreator('/devbible/docs/webpack', '849'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages',
                component: ComponentCreator('/devbible/docs/webpack/pages', '1ca'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/advanced-custom-tooling/custom-loaders-and-plugins',
                component: ComponentCreator('/devbible/docs/webpack/pages/advanced-custom-tooling/custom-loaders-and-plugins', '8c5'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/asset-modules/built-in-asset-types',
                component: ComponentCreator('/devbible/docs/webpack/pages/asset-modules/built-in-asset-types', 'f03'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/caching-strategies/long-term-caching',
                component: ComponentCreator('/devbible/docs/webpack/pages/caching-strategies/long-term-caching', '3b4'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/code-splitting/splitting-strategies',
                component: ComponentCreator('/devbible/docs/webpack/pages/code-splitting/splitting-strategies', 'fa0'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/configuration/entry-and-output-deep-dive',
                component: ComponentCreator('/devbible/docs/webpack/pages/configuration/entry-and-output-deep-dive', 'a44'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/core-concepts/five-core-concepts-and-module-graph',
                component: ComponentCreator('/devbible/docs/webpack/pages/core-concepts/five-core-concepts-and-module-graph', 'dc2'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/dev-server-and-hmr/dev-server-and-hot-module-replacement',
                component: ComponentCreator('/devbible/docs/webpack/pages/dev-server-and-hmr/dev-server-and-hot-module-replacement', 'f1d'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/loaders/loader-mechanics-pitching-and-async',
                component: ComponentCreator('/devbible/docs/webpack/pages/loaders/loader-mechanics-pitching-and-async', '121'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/loaders/transpilation-and-style-loaders',
                component: ComponentCreator('/devbible/docs/webpack/pages/loaders/transpilation-and-style-loaders', 'f7f'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-federation/architecture-patterns-and-topologies',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-federation/architecture-patterns-and-topologies', 'f8a'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-federation/dynamic-remotes-and-runtime-loading',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-federation/dynamic-remotes-and-runtime-loading', '2e7'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-federation/fundamentals-remotes-and-exposes',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-federation/fundamentals-remotes-and-exposes', 'd14'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-federation/production-ops-and-troubleshooting',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-federation/production-ops-and-troubleshooting', '8c8'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-federation/shared-dependencies-and-version-negotiation',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-federation/shared-dependencies-and-version-negotiation', 'fec'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/module-resolution/the-resolve-object',
                component: ComponentCreator('/devbible/docs/webpack/pages/module-resolution/the-resolve-object', 'b8f'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/multi-config-and-environment/config-composition',
                component: ComponentCreator('/devbible/docs/webpack/pages/multi-config-and-environment/config-composition', '2f0'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/optimization/production-optimizations',
                component: ComponentCreator('/devbible/docs/webpack/pages/optimization/production-optimizations', '62b'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/performance-analysis/diagnostics-and-bundle-analysis',
                component: ComponentCreator('/devbible/docs/webpack/pages/performance-analysis/diagnostics-and-bundle-analysis', '986'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/plugins/essential-plugins',
                component: ComponentCreator('/devbible/docs/webpack/pages/plugins/essential-plugins', 'ffd'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/real-world-workflows-and-recipes/diagnosing-a-bloated-bundle',
                component: ComponentCreator('/devbible/docs/webpack/pages/real-world-workflows-and-recipes/diagnosing-a-bloated-bundle', '013'),
                exact: true,
                sidebar: "webpackSidebar"
              },
              {
                path: '/devbible/docs/webpack/pages/source-maps/devtool-options',
                component: ComponentCreator('/devbible/docs/webpack/pages/source-maps/devtool-options', '4ba'),
                exact: true,
                sidebar: "webpackSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/devbible/',
    component: ComponentCreator('/devbible/', 'd85'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
