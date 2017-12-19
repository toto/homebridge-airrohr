'use strict';
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory(
    "homebridge-airrohr",
    "airrohr",
    AirRohrAccessory
  );
};

function getCurrentSensorData(hostname, callback) {
  http.get(`http://${hostname}/data.json`, (res) => {
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
      callback(null, error);
      return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        callback(parsedData, null);
      } catch (e) {
        callback(null, e);
      }
    });
  }).on('error', (e) => {
    callback(null, e);
  });
};

function AirRohrAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.hostname = config["hostname"];
    this.dataCache = null;

    // Information

    this.informationService = new Service.AccessoryInformation();
    this.informationService.setCharacteristic(
      Characteristic.Manufacturer,
      "luftdaten.info"
    );
    this.informationService.setCharacteristic(
      Characteristic.Model,
      "Feinstaubsensor"
    );
    this.informationService.setCharacteristic(
      Characteristic.SerialNumber,
      this.config.sensorId
    );

    // Temperature Sensor
    this.temperatureService = new Service.TemperatureSensor(this.name);
    this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on("get", this.getCurrentTemperature.bind(this));

    // Humidity sensor
    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on("get", this.getCurrentRelativeHumidity.bind(this));

    // AirQuality Sensor
    this.airQualityService = new Service.HumiditySensor(this.name);
    this.airQualityService
        .getCharacteristic(Characteristic.Characteristic.AirQuality)
        .on("get", this.getCurrentAirQuality.bind(this));
    this.airQualityService
        .getCharacteristic(Characteristic.Characteristic.PM2_5Density)
        .on("get", this.getCurrentPM2_5Density.bind(this));
    this.airQualityService
        .getCharacteristic(Characteristic.Characteristic.PM10Density)
        .on("get", this.getCurrentPM10Density.bind(this));


    this.updateServices = (json) => {
      this.informationService.setCharacteristic(
        Characteristic.FirmwareRevision,
        json.software_version
      );
      let temp = this.getCachedValue("temperature");
      if (temp) {
        this.temperatureService.setCharacteristic(
          Characteristic.CurrentTemperature,
          new Number(temp)
        );
      }
      let humidity = this.getCachedValue("humidity");
      if (humidity) {
        this.humidityService.setCharacteristic(
          Characteristic.CurrentRelativeHumidity,
          new Number(humidity)
        );
      }
    };

    this.updateCache = (callback) => {
      getCurrentSensorData(this.hostname, (json, error) => {
        if (error) {
          console.error(`Could not get sensor data: ${error}`);
        } else {
          this.dataCache = json;
          this.updateServices(json);
        }
        callback(error);
      });
    };
    this.getCachedValue = (valueType) => {
      if (this.dataCache) {
        for valueSet of json["sensordatavalues"] {
          if (valueType == valueSet["valueType"]) {
            return valueSet["value"];
          }
        }
      }
      return null;
    };

    this.periodicCacheUpdate = () => {
      this.updateCache((error) => {
        let time = this.config.updateIntervalSeconds * 1000; // 1 minute
        setTimeInterval(() => {
          periodicCacheUpdate();
        }, time);
      });
    };
    this.periodicCacheUpdate();
}


AirRohrAccessory.prototype.getCurrentTemperature = function(callback) {
  let temp = this.getCachedValue("temperature");
  if (!temp) {
    callback(null, null);
    return;
  }

  callback(null, new Number(temp));
};

AirRohrAccessory.prototype.getCurrentRelativeHumidity = function(callback) {
  let humidity = this.getCachedValue("humidity");
  if (!humidity) {
    callback(null, null);
    return;
  }

  callback(null, new Number(humidity));
};

AirRohrAccessory.prototype.getCurrentAirQuality = function(callback) {
  callback(null, null);
};

AirRohrAccessory.prototype.getCurrentPM2_5Density = function(callback) {
  let pm25 = this.getCachedValue("SDS_P2");
  if (!pm25) {
    callback(null, null);
    return;
  }

  callback(null, new Number(pm25));
};

AirRohrAccessory.prototype.getCurrentPM10Density = function(callback) {
  let pm10 = this.getCachedValue("SDS_P1");
  if (!pm10) {
    callback(null, null);
    return;
  }

  callback(null, new Number(pm10));
};


AirRohrAccessory.prototype.getServices = function() {
  return [this.temperatureService, this.informationService, this.humidityService];
};
