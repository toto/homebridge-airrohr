const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
    DEFAULT_LIMITS,
    DEFAULT_UPDATE_INTERVAL_SECONDS,
    normalizeConfig
} = require('../lib/config');

describe('config normalization', () => {
    it('should require at least one sensor data URL', () => {
        assert.throws(() => normalizeConfig({}), /Invalid configuration/);
    });

    it('should apply defaults for update interval, history, flags, and daily limits', () => {
        const config = normalizeConfig({
            name: 'AirRohr',
            json_data: 'http://sensor.local/data.json'
        });

        assert.equal(config.updateIntervalSeconds, DEFAULT_UPDATE_INTERVAL_SECONDS);
        assert.deepEqual(config.historyOptions, {});
        assert.equal(config.disablePm25, false);
        assert.equal(config.disablePm10, false);
        assert.deepEqual(config.limits, DEFAULT_LIMITS);
    });

    it('should preserve configured disable flags and daily limits', () => {
        const config = normalizeConfig({
            json_data: 'http://sensor.local/data.json',
            disable_pm25: true,
            disable_pm10: true,
            daily_limits: {
                pm10: 40,
                pm25: 20
            }
        });

        assert.equal(config.disablePm25, true);
        assert.equal(config.disablePm10, true);
        assert.deepEqual(config.limits, {
            pm10: 40,
            pm25: 20
        });
    });
});
