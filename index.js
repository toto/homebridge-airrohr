'use strict';
var Service, Characteristic;

const http = require('http');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory(
    "homebridge-airrohr",
    "airrohr",
    AirRohrAccessory
  );
};

function getCurrentSensorData(jsonURL, callback) {
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
      callback(null, error);
      return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      // try {
        const parsedData = JSON.parse(rawData);
        callback(parsedData, null);
      // } catch (e) {
      //   callback(null, e);
      // }
    });
  }).on('error', (e) => {
    callback(null, e);
  });
};

function AirRohrAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.dataCache = null;
    this.jsonURL = config["json_data"];
    this.sensorId = config["sensor_id"];
    this.updateIntervalSeconds = config["update_interval_seconds"];
    if (!this.updateIntervalSeconds) {
      this.updateIntervalSeconds = 120;
    }

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
      this.sensorId
    );

    // Temperature Sensor
    this.temperatureService = new Service.TemperatureSensor(this.name);

    // Humidity sensor
    this.humidityService = new Service.HumiditySensor(this.name);

    // AirQuality Sensor
    this.airQualityService = new Service.AirQualitySensor(this.name);




    this.updateServices = (json) => {
      this.dataCache = json;
      this.informationService.setCharacteristic(
        Characteristic.FirmwareRevision,
        json.software_version
      );
      let temp = this.getCachedValue("temperature");
      if (temp) {
        this.temperature = temp;
        this.temperatureService.setCharacteristic(
          Characteristic.CurrentTemperature,
          this.temperature
        );
      }
      let humidity = this.getCachedValue("humidity");
      if (humidity) {
        this.humidity = humidity;
        this.humidityService.setCharacteristic(
          Characteristic.CurrentRelativeHumidity,
          this.humidity
        );
      }
      let pm25 = this.getCachedValue("SDS_P2");
      if (pm25) {
        this.pm25 = pm25;
        this.airQualityService.setCharacteristic(
          Characteristic.PM2_5Density,
          this.pm25
        );
      }
      let pm10 = this.getCachedValue("SDS_P1");
      if (pm10) {
        this.pm10 = pm10;
        this.airQualityService.setCharacteristic(
          Characteristic.PM10Density,
          this.pm10
        );
      }

      // TODO: Calculate AirQUality
      this.airQuality = Characteristic.AirQuality.GOOD;
    };

    this.updateCache = (callback) => {
      console.log("updateCache()");
      getCurrentSensorData(this.jsonURL, (json, error) => {
        if (error) {
          console.error(`Could not get sensor data: ${error}`);
        } else {
          this.updateServices(json);
        }
        callback(error);
      });
    };
    this.getCachedValue = (valueType) => {
      if (this.dataCache) {
        // console.log(`Getting ${valueType} from data cache ${JSON.stringify(this.dataCache)}`);
        for (let valueSet of this.dataCache["sensordatavalues"]) {
          if (valueType == valueSet["value_type"]) {
            return valueSet["value"];
          }
        }
      } else {
        this.updateCache();
      }
      return null;
    };

    this.periodicCacheUpdate = () => {
      this.updateCache((error) => {
        let time = this.updateIntervalSeconds * 1000; // 1 minute
        setInterval(() => {
          this.periodicCacheUpdate();
        }, time);
      });
    };
    this.periodicCacheUpdate();

    this.airQualityService
        .getCharacteristic(Characteristic.AirQuality)
        .on("get", (callback) => {
            callback(null, this.airQuality);
        });
    this.airQualityService
        .getCharacteristic(Characteristic.PM2_5Density)
        .on("get", (callback) => {
            callback(null, this.pm25);
        });
    this.airQualityService
        .getCharacteristic(Characteristic.PM10Density)
        .on("get", (callback) => {
            callback(null, this.pm10);
        });

    this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on("get", (callback) => {
            callback(null, this.humidity);
        });

    this.temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on("get", (callback) => {
          callback(null, this.temperature);
      });
};

AirRohrAccessory.prototype.getServices = function() {
  return [this.temperatureService, this.informationService, this.humidityService, this.airQualityService];
};
