const DataCache = require('./../lib/data_cache');
const { assert } = require('chai');

describe('DataCache', () => {
    describe('local network sensor data', () => {
        const sampleData = require('./../sample_data/data.json');

        it('should parse temperature data from DHT22 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleData);
            assert.equal(dataCache.temperature, 17.0);
        });
        it('should parse humidity data from DHT22 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleData);
            assert.equal(dataCache.humidity, 34.1);
        });
        it('should parse air particulate data from SDS011  correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateAirQuality(sampleData);
            assert.equal(dataCache.pm10, 27.73);
            assert.equal(dataCache.pm25, 19.43);
        });
    });

    describe('luftdaten.info API data', () => {
        const sampleDataTemp = require('./../sample_data/api_data_temp_dht22.json')[0];
        const sampleDataAir = require('./../sample_data/api_data_air_quality_sds011.json')[0];

        it('should parse temperature data from DHT22 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleDataTemp);
            assert.equal(dataCache.temperature, -1.6);
        });
        it('should parse humidity data from DHT22 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleDataTemp);
            assert.equal(dataCache.humidity, 41.7);
        });
        it('should parse air particulate data from SDS011 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateAirQuality(sampleDataAir);
            assert.equal(dataCache.pm10, 14.77);
            assert.equal(dataCache.pm25, 6.87);
        });

    });
});