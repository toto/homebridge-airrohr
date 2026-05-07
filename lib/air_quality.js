'use strict';

function hasReading(value) {
  return value !== undefined && value !== null && Number.isFinite(Number(value));
}

function calculateQualityPercentage({ pm10, pm25 }, limits) {
  const percentages = [];

  if (hasReading(pm10)) {
    percentages.push(Number(pm10) / limits.pm10);
  }
  if (hasReading(pm25)) {
    percentages.push(Number(pm25) / limits.pm25);
  }

  if (percentages.length === 0) {
    return null;
  }

  return percentages.reduce((sum, value) => sum + value, 0.0) / percentages.length;
}

function calculateAirQuality(qualityPercentage, Characteristic) {
  if (qualityPercentage === null) {
    return Characteristic.AirQuality.UNKNOWN;
  }
  if (qualityPercentage <= 0.4) {
    return Characteristic.AirQuality.EXCELLENT;
  }
  if (qualityPercentage <= 0.6) {
    return Characteristic.AirQuality.GOOD;
  }
  if (qualityPercentage <= 0.8) {
    return Characteristic.AirQuality.FAIR;
  }
  if (qualityPercentage <= 1.0) {
    return Characteristic.AirQuality.INFERIOR;
  }
  if (qualityPercentage > 1.0) {
    return Characteristic.AirQuality.POOR;
  }

  return Characteristic.AirQuality.UNKNOWN;
}

module.exports = {
  calculateAirQuality,
  calculateQualityPercentage,
  hasReading
};
