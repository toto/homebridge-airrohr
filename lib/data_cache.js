const http = require('http');

const HUMIDITY_KEYS = Object.freeze(['HTU21D_humidity', 'BME280_humidity', 'SHT3X_humidity', 'humidity']);
const TEMPERATURE_KEYS = Object.freeze([
  'DS18B20_temperature',
  'HTU21D_temperature',
  'BME280_temperature',
  'BMP_temperature',
  'BMP280_temperature',
  'SHT3X_temperature',
  'temperature'
]);
const PRESSURE_KEYS = Object.freeze(['BME280_pressure', 'BMP_pressure', 'BMP280_pressure', 'pressure']);
const PM25_KEYS = Object.freeze(['SDS_P2', 'P2', 'PMS_P2', 'HPM_P2']);
const PM10_KEYS = Object.freeze(['SDS_P1', 'P1', 'PMS_P1', 'HPM_P1']);

class DataCache {
  constructor() {
    this.software_version = null;
    this.temperature = null;
    this.humidity = null;
    this.pressure = null;
    this.pm25 = null;
    this.pm10 = null;
  }

  updateFromLuftdatenAPI(airQualityUrl, temperatureSensorUrl, callback) {
    let airQualityDataLoaded = !airQualityUrl;
    let temperatureDataLoaded = !temperatureSensorUrl;

    const loadAirQualityData = () => {
      this._loadCurrentSensorData(airQualityUrl, (error, airquality_json) => {
        if (error) {
          callback(error);
          return;
        }

        this._updateAirQuality(airquality_json);

        airQualityDataLoaded = true;
        next();
      });
    };

    const loadTemperatureData = () => {
      this._loadCurrentSensorData(temperatureSensorUrl, (error, temp_json) => {
        if (error) {
          callback(error);
          return;
        }

        this._updateHumidity(temp_json);
        this._updateTemperature(temp_json);
        this._updatePressure(temp_json);

        temperatureDataLoaded = true;
        next();
      });
    };

    const next = () => {
      if (!airQualityDataLoaded) {
        loadAirQualityData();
      } else if (!temperatureDataLoaded) {
        loadTemperatureData();
      } else {
        callback(null);
      }
    };

    next();
  }

  updateFromLocalSensor(url, callback) {
    this._loadCurrentSensorData(url, (error, json) => {
      if (error) {
        callback(error);
        return;
      }
      this._updateAirQuality(json);
      this._updateHumidity(json);
      this._updateTemperature(json);
      this._updatePressure(json);
      callback(null);
    });
  }

  _updateHumidity(json) {
    this.humidity = this._findNumericValue(json, HUMIDITY_KEYS, this.humidity);
  }

  _updateTemperature(json) {
    this.temperature = this._findNumericValue(json, TEMPERATURE_KEYS, this.temperature);
  }

  _updatePressure(json) {
    const pressure = this._findNumericValue(json, PRESSURE_KEYS, null);
    if (pressure !== null) {
      this.pressure = pressure / 100;
    }
  }

  _updateAirQuality(json) {
    this.pm25 = this._findNumericValue(json, PM25_KEYS, this.pm25);
    this.pm10 = this._findNumericValue(json, PM10_KEYS, this.pm10);
  }

  _findNumericValue(json, keys, fallback) {
    for (let key of keys) {
      const value = this._findValue(json, key);
      if (value !== null) {
        const numberValue = parseFloat(value);
        if (Number.isFinite(numberValue)) {
          return numberValue;
        }
      }
    }
    return fallback;
  }

  _findValue(json, key) {
    let basedata = json;
    // If loading data from API the result sometimes is
    // an array
    if (Array.isArray(basedata)) {
      basedata = basedata[0];
    }
    if (!basedata) {
      return null;
    }
    const sensorValues = basedata["sensordatavalues"];
    if (!sensorValues) {
      return null;
    }
    for (let valueSet of sensorValues) {
      if (key === valueSet["value_type"]) {
        return valueSet["value"];
      }
    }
    return null;
  }

  _loadCurrentSensorData(jsonURL, callback) {
    http.get(jsonURL, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];

      let error;
      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
                          `Status Code: ${statusCode}`);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error('Invalid content-type.\n' +
                          `Expected application/json but received ${contentType}`);
      }
      if (error) {
        res.resume();
        callback(error, null);
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          callback(null, parsedData);
        } catch (error) {
          callback(error, null);
        }
      });
    }).on('error', (error) => {
      callback(error, null);
    });
  }
}

module.exports = DataCache;
