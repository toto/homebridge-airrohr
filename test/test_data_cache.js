const DataCache = require('./../lib/data_cache');
const { assert } = require('chai');

describe('DataCache', () => {
    describe('local data', () => {
        const sampleData = require('./../sample_data/data.json')

        it('should parse temperature data correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleData);
            assert.equal(dataCache.temperature, 17.0);
        });
        it('should parse humidity data correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleData);
            assert.equal(dataCache.humidity, 34.1);
        });
        it('should parse air particulate data correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateAirQuality(sampleData);
            assert.equal(dataCache.pm10, 27.73);
            assert.equal(dataCache.pm25, 19.43);
        });
    });

    describe('luftdaten.info API data', () => {
        it('should parse temperature data correctly', () => {});
        it('should parse humidity data correctly', () => {});
        it('should parse air particulate data correctly', () => {});

    });
});