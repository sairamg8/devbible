import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { slugify } from './slugify.mjs';

test('example-based tests all pass', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('  Trim Me  '), 'trim-me');
  assert.equal(slugify('Node.js 24!'), 'node-js-24');
});

test('property: a slug never starts or ends with a dash', () => {
  fc.assert(fc.property(fc.string({ minLength: 8, maxLength: 40 }), (s) => {
    const out = slugify(s);
    return !out.startsWith('-') && !out.endsWith('-');
  }));
});

test('property: slugify is idempotent', () => {
  fc.assert(fc.property(fc.string({ minLength: 8, maxLength: 40 }), (s) => slugify(slugify(s)) === slugify(s)));
});
