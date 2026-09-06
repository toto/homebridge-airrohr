'use strict';

const DEFAULT_UPDATE_INTERVAL_SECONDS = 120;
const DEFAULT_LIMITS = Object.freeze({ pm10: 50.0, pm25: 25.0 });

function readNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeConfig(config) {
  const jsonURL = config.json_data;
  const airQualityDataURL = config.public_airquality_json_data;
  const temperatureDataURL = config.public_temperature_json_data;

  if (!jsonURL && !airQualityDataURL && !temperatureDataURL) {
    throw new Error('Invalid configuration');
  }

  const dailyLimits = config.daily_limits || {};

  return {
    displayName: config.name,
    sensorId: config.sensor_id,
    jsonURL,
    airQualityDataURL,
    temperatureDataURL,
    disableHumidity: Boolean(config.disable_humidity),
    disableTemperature: Boolean(config.disable_temperature),
    disablePm25: Boolean(config.disable_pm25),
    disablePm10: Boolean(config.disable_pm10),
    disablePressure: Boolean(config.disable_pressure),
    updateIntervalSeconds: readNumber(
      config.update_interval_seconds,
      DEFAULT_UPDATE_INTERVAL_SECONDS
    ),
    historyOptions: config.history || {},
    limits: {
      pm10: readNumber(dailyLimits.pm10, DEFAULT_LIMITS.pm10),
      pm25: readNumber(dailyLimits.pm25, DEFAULT_LIMITS.pm25)
    }
  };
}

module.exports = {
  DEFAULT_LIMITS,
  DEFAULT_UPDATE_INTERVAL_SECONDS,
  normalizeConfig
};
