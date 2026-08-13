import { describe, it, before, beforeEach, after, afterEach } from 'node:test';

const log = (s) => console.log(`  ${s}`);

describe('outer', () => {
  before(() => log('outer before'));
  beforeEach(() => log('outer beforeEach'));
  afterEach(() => log('outer afterEach'));
  after(() => log('outer after'));

  it('test 1', () => log('  -> test 1 body'));

  describe('inner', () => {
    before(() => log('inner before'));
    beforeEach(() => log('inner beforeEach'));
    afterEach(() => log('inner afterEach'));
    after(() => log('inner after'));
    it('test 2', () => log('  -> test 2 body'));
  });
});
