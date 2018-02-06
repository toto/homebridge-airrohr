const http = require('http');
const async = require('async');

class DataCache {
  constructor() {
    this.software_version = null;
    this.temperature = null;
    this.humidity = null;
    this.pm25 = null;
    this.pm10 = null;
  }

  updateViaAPI(airQualityUrl, temperatureSensorUrl, callback) {
    async.parallel(
      [
        (cb) => this._loadCurrentSensorData(airQualityUrl, cb),
        (cb) => this._loadCurrentSensorData(temperatureSensorUrl, cb)
      ],
      (error, result) => {
        if (error) {
          callback(error);
          return;
        } else {
          _updateHumidity(result[0]);
          _updateHumidity(result[1]);
          _updateTemperature(result[1]);
          callback(null);
        }
      }
    );
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
      callback(null);
    })
  }

  _updateHumidity(json) {
    const humidityKeys = ['humidity', 'BME280_humidity'];
    for (let key of humidityKeys) {
      const value = this._findValue(json, key);
      if (value) {
        this.humidity = parseFloat(value);
        break;
      }
    }
  }

  _updateTemperature(json) {
    const tempKeys = ['temperature', 'BME280_temperature'];
    for (let key of tempKeys) {
      const value = this._findValue(json, key);
      if (value) {
        this.temperature = parseFloat(value);
        break;
      }
    }
  }

  _updateAirQuality(json) {
    const pm25keys = ['SDS_P2', 'P2'];
    const pm10keys = ['SDS_P1', 'P1'];

    for (let key of pm25keys) {
      const value = this._findValue(json, key);
      if (value) {
        this.pm25 = parseFloat(value);
        break;
      }
    }
    for (let key of pm10keys) {
      const value = this._findValue(json, key);
      if (value) {
        this.pm10 = parseFloat(value);
        break;
      }
    }
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
      if (key == valueSet["value_type"]) {
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
  };
}

module.exports = DataCache;