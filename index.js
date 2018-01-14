'use strict';
var Service, Characteristic, Accessory;

const http = require('http');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.hap.Accessory;
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
    this.category = Accessory.Categories.SENSOR;
    this.log = log;
    this.name = config["name"];
    this.dataCache = null;
    this.jsonURL = config["json_data"];
    this.sensorId = config["sensor_id"];
    this.updateIntervalSeconds = config["update_interval_seconds"];
    if (!this.updateIntervalSeconds) {
      this.updateIntervalSeconds = 120;
    }
    this.log("AirRohr: Update interval", this.updateIntervalSeconds, "s");

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
    this.temperatureService = new Service.TemperatureSensor(`Temperature ${this.name}`);

    // Humidity sensor
    this.humidityService = new Service.HumiditySensor(`Humidity ${this.name}`);

    // AirQuality Sensor
    this.airQualityService = new Service.AirQualitySensor(`Air quality ${this.name}`);
    this.airQualityService.isPrimaryService = true;
    this.airQualityService.linkedServices = [this.humidityService, this.temperatureService];

    this.updateServices = (json) => {
      this.dataCache = json;
      this.informationService.setCharacteristic(
        Characteristic.FirmwareRevision,
        json.software_version
      );
      let temp = this.getCachedValue("temperature");
      if (temp) {
        this.log("Measured temperatue", temp, "°C");
        this.temperature = parseFloat(temp);
        this.temperatureService.setCharacteristic(
          Characteristic.CurrentTemperature,
          this.temperature
        );
      }
      let humidity = this.getCachedValue("humidity");
      if (humidity) {
        this.log("Measured humidity", humidity, "%");
        this.humidity = humidity;
        this.humidityService.setCharacteristic(
          Characteristic.CurrentRelativeHumidity,
          this.humidity
        );
      }
      let pm25 = this.getCachedValue("SDS_P2");
      if (pm25) {
        this.log("Measured PM2.5", pm25, "µg/m³");
        this.pm25 = pm25;
        this.airQualityService.setCharacteristic(
          Characteristic.PM2_5Density,
          this.pm25
        );
      }
      let pm10 = this.getCachedValue("SDS_P1");
      if (pm10) {
        this.log("Measured PM10", pm10, "µg/m³");
        this.pm10 = pm10;
        this.airQualityService.setCharacteristic(
          Characteristic.PM10Density,
          this.pm10
        );
      }

      // Calculate AirQUality:
      //  average percentage of values below thesholds defined by WHO
      //  <=40% -> EXCELLENT
      //  <=60% -> GOOD
      //  <=80% -> FAIR
      //  <=100% -> INFERIOR
      //  >100% -> POOR Since poor quality can be used as a trigger.
      if (pm10 && pm25) {
        // PM10: 50 µg/m³ daily limit
        let percentPm10 = parseFloat(pm10) / 50.0;
        // PM2.5: 25 µg/m³ daily limit
        let percentPm25 = parseFloat(pm25) / 25.0;
        let qualityPercentage = (percentPm10 + percentPm25) / 2.0;

        let absChange = Math.abs(this.qualityPercentage - qualityPercentage);
        let wasNotSet = this.qualityPercentage == undefined || this.qualityPercentage == null;
        this.qualityPercentage = qualityPercentage;
        // Only set new quality level if there was a significant change
        if (wasNotSet || absChange >= 0.05) {
          if (qualityPercentage <= 0.4) {
            this.airQuality = Characteristic.AirQuality.EXCELLENT;
          } else if (qualityPercentage <= 0.6) {
            this.airQuality = Characteristic.AirQuality.GOOD;
          } else if (qualityPercentage <= 0.8) {
            this.airQuality = Characteristic.AirQuality.FAIR;
          } else if (qualityPercentage <= 1.0) {
            this.airQuality = Characteristic.AirQuality.INFERIOR;
          } else if (qualityPercentage > 1.0) {
            this.airQuality = Characteristic.AirQuality.POOR;
          } else {
            this.airQuality = Characteristic.AirQuality.UNKNOWN;
          }
          this.airQualityService.setCharacteristic(
            Characteristic.AirQuality,
            this.airQuality
          );
        }
      }



    };

    this.isUpdating = false;
    this.updateCache = (callback) => {
      if (this.isUpdating) {
        callback(null);
        return;
      }
      this.isUpdating = true;
      getCurrentSensorData(this.jsonURL, (json, error) => {
        this.isUpdating = false;
        if (error) {
          this.log(`Could not get sensor data: ${error}`);
        } else {
          this.updateServices(json);
        }
        if (callback) {
          callback(error);
        }
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
      } 
      return null;
    };

    let time = this.updateIntervalSeconds * 1000; // 1 minute
    setInterval(() => {
      this.updateCache();
    }, time);

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
