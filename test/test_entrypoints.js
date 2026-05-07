const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('package entrypoints', () => {
    it('should expose a CommonJS plugin initializer', () => {
        assert.equal(typeof require('../index'), 'function');
    });

    it('should expose an ESM default plugin initializer', async () => {
        const plugin = await import('../index.mjs');
        assert.equal(typeof plugin.default, 'function');
    });
});
