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
        it('should parse air particulate data from SDS011 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateAirQuality(sampleData);
            assert.equal(dataCache.pm10, 27.73);
            assert.equal(dataCache.pm25, 19.43);
        });

        const sampleDataBME280 = require('./../sample_data/data_BME280.json');
        it('should parse temperature data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleDataBME280);
            assert.equal(dataCache.temperature, 6.86);
        });
        it('should parse humidity data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleDataBME280);
            assert.equal(dataCache.humidity, 86.66);
        });
        it('should parse air pressure data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updatePressure(sampleDataBME280);
            assert.equal(dataCache.pressure, 1000.0354);
        });
        it('should parse air particulate data from SDS011 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateAirQuality(sampleDataBME280);
            assert.equal(dataCache.pm10, 6.50);
            assert.equal(dataCache.pm25, 3.20);
        });

        const sampleDataDHT22BMP280 = require('./../sample_data/data_DHT22_BMP280.json');
        it('should parse temperature data from BMP280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleDataDHT22BMP280);
            assert.equal(dataCache.temperature, 12.70);
        });
        it('should parse humidity data from DHT22 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleDataDHT22BMP280);
            assert.equal(dataCache.humidity, 70.20);
        });
        it('should parse air pressure data from BMP280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updatePressure(sampleDataDHT22BMP280);
            assert.equal(dataCache.pressure, 983.6006);
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

        const sampleDataTempBME280 = require('./../sample_data/api_data_temp_bme280.json')[0];

        it('should parse temperature data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateTemperature(sampleDataTempBME280);
            assert.equal(dataCache.temperature, 10.87);
        });
        it('should parse humidity data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updateHumidity(sampleDataTempBME280);
            assert.equal(dataCache.humidity, 54.34);
        });
        it('should parse air pressure data from BME280 correctly', () => {
            const dataCache = new DataCache();
            dataCache._updatePressure(sampleDataTempBME280);
            assert.equal(dataCache.pressure, 990.4013);
        });
    });
});