const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
    calculateAirQuality,
    calculateQualityPercentage
} = require('../lib/air_quality');

const Characteristic = {
    AirQuality: {
        UNKNOWN: 0,
        EXCELLENT: 1,
        GOOD: 2,
        FAIR: 3,
        INFERIOR: 4,
        POOR: 5
    }
};

describe('air quality calculation', () => {
    it('should calculate the average limit percentage from enabled particle readings', () => {
        const percentage = calculateQualityPercentage(
            { pm10: 25, pm25: 12.5 },
            { pm10: 50, pm25: 25 }
        );

        assert.equal(percentage, 0.5);
    });

    it('should calculate air quality from a single enabled particle reading', () => {
        const percentage = calculateQualityPercentage(
            { pm10: 0, pm25: null },
            { pm10: 50, pm25: 25 }
        );

        assert.equal(percentage, 0);
        assert.equal(
            calculateAirQuality(percentage, Characteristic),
            Characteristic.AirQuality.EXCELLENT
        );
    });

    it('should map threshold percentages to HomeKit air quality values', () => {
        assert.equal(calculateAirQuality(0.4, Characteristic), Characteristic.AirQuality.EXCELLENT);
        assert.equal(calculateAirQuality(0.6, Characteristic), Characteristic.AirQuality.GOOD);
        assert.equal(calculateAirQuality(0.8, Characteristic), Characteristic.AirQuality.FAIR);
        assert.equal(calculateAirQuality(1.0, Characteristic), Characteristic.AirQuality.INFERIOR);
        assert.equal(calculateAirQuality(1.01, Characteristic), Characteristic.AirQuality.POOR);
    });
});
