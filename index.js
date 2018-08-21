'use strict';
var Service, Characteristic, CustomCharacteristic, Accessory, FakeGatoHistoryService;

const DataCache = require('./lib/data_cache');
const http = require('http');
const moment = require('moment');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  CustomCharacteristic = require('./lib/custom_characteristics')(Characteristic);
  Accessory = homebridge.hap.Accessory;
  FakeGatoHistoryService = require('fakegato-history')(homebridge);

  homebridge.registerAccessory(
    "homebridge-airrohr",
    "airrohr",
    AirRohrAccessory
  );
};

function AirRohrAccessory(log, config) {
  this.category = Accessory.Categories.SENSOR;
  this.log = log;
  this.displayName = config["name"];
  this.dataCache = null;
  this.jsonURL = config["json_data"];
  this.airQualityDataURL = config["public_airquality_json_data"];
  this.temperatureDataURL = config["public_temperature_json_data"];
  if (!this.jsonURL && !this.airQualityDataURL && !this.temperatureDataURL) {
    throw new Error("Invalid configuration")
  }

  this.sensorId = config["sensor_id"];
  this.updateIntervalSeconds = config["update_interval_seconds"];
  if (!this.updateIntervalSeconds) {
    this.updateIntervalSeconds = 120;
  }
  this.log("AirRohr: Update interval", this.updateIntervalSeconds, "s");

  this.historyOptions = config["history"] || {};

  const haveAirQualityData = !!this.jsonURL || !!this.airQualityDataURL;
  const haveTemperatureData = !!this.jsonURL || !!this.temperatureDataURL;

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

  if (haveTemperatureData) {
    // Temperature Sensor
    this.temperatureService = new Service.TemperatureSensor(`Temperature ${this.displayName}`);
    this.temperatureService.addOptionalCharacteristic(CustomCharacteristic.AirPressure);

    // Humidity sensor
    this.humidityService = new Service.HumiditySensor(`Humidity ${this.displayName}`);
    this.loggingService = new FakeGatoHistoryService('weather', this, {storage: 'fs'});
  }

  if (haveAirQualityData) {
    // AirQuality Sensor
    this.airQualityService = new Service.AirQualitySensor(`Air quality ${this.displayName}`);

    if (haveTemperatureData) {
      this.airQualityService.isPrimaryService = true;
      this.airQualityService.linkedServices = [this.humidityService, this.temperatureService];
    }
  }

  this.updateServices = (dataCache) => {
    this.dataCache = dataCache;
    this.informationService.setCharacteristic(
      Characteristic.FirmwareRevision,
      dataCache.software_version
    );
    let temp = dataCache.temperature;
    if (haveTemperatureData && temp) {
      this.log("Measured temperature", temp, "°C");
      this.temperature = parseFloat(temp);
      this.temperatureService.setCharacteristic(
        Characteristic.CurrentTemperature,
        this.temperature
      );
    }
    let humidity = dataCache.humidity;
    if (haveTemperatureData && humidity) {
      this.log("Measured humidity", humidity, "%");
      this.humidity = humidity;
      this.humidityService.setCharacteristic(
        Characteristic.CurrentRelativeHumidity,
        this.humidity
      );
    }
    let pressure = dataCache.pressure;
    if (haveTemperatureData && pressure) {
      this.log("Measured pressure", pressure, "hPa");
      this.pressure = pressure;
      this.temperatureService.setCharacteristic(
        CustomCharacteristic.AirPressure,
        this.pressure
      );
    }
    let pm25 = dataCache.pm25;
    if (haveAirQualityData && pm25) {
      this.log("Measured PM2.5", pm25, "µg/m³");
      this.pm25 = pm25;
      this.airQualityService.setCharacteristic(
        Characteristic.PM2_5Density,
        this.pm25
      );
    }
    let pm10 = dataCache.pm10;
    if (haveAirQualityData && pm10) {
      this.log("Measured PM10", pm10, "µg/m³");
      this.pm10 = pm10;
      this.airQualityService.setCharacteristic(
        Characteristic.PM10Density,
        this.pm10
      );
    }

    // Calculate AirQuality:
    //  average percentage of values below thesholds defined by WHO
    //  <=40% -> EXCELLENT
    //  <=60% -> GOOD
    //  <=80% -> FAIR
    //  <=100% -> INFERIOR
    //  >100% -> POOR Since poor quality can be used as a trigger.
    if (haveAirQualityData && pm10 && pm25) {
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

    if (haveTemperatureData) {
      this.loggingService.addEntry({
         time: moment().unix(),
         temp: temp,
         pressure: pressure,
         humidity: humidity
      });
    }
  };

  this.dataCache = new DataCache();

  this.isUpdating = false;
  this.updateCache = (callback) => {
    if (this.isUpdating) {
      if (callback) {
        callback(null);
      }
      return;
    }
    this.isUpdating = true;

    const updateCallback = (error) => {
      this.isUpdating = false;
      if (error) {
        this.log(`Could not get sensor data: ${error}`);
      } else {
        this.updateServices(this.dataCache);
      }
      if (callback) {
        callback(error);
      }
    };

    if (this.jsonURL) {
      this.dataCache.updateFromLocalSensor(this.jsonURL, updateCallback);
    } else if (this.airQualityDataURL || this.temperatureDataURL) {
      this.dataCache.updateFromLuftdatenAPI(this.airQualityDataURL, this.temperatureDataURL, updateCallback);
    }
  };

  let time = this.updateIntervalSeconds * 1000; // 1 minute
  setInterval(() => {
    this.updateCache();
  }, time);
  this.updateCache();


  if (haveAirQualityData) {
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
  }

  if (haveTemperatureData) {
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on("get", (callback) => {
        callback(null, this.humidity);
      });
    this.temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        format: Characteristic.Formats.FLOAT,
        unit: Characteristic.Units.CELSIUS,
        maxValue: 100,
        minValue: -100,
        minStep: 0.1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
      })
      .on("get", (callback) => {
        callback(null, this.temperature);
      });
  }
};

AirRohrAccessory.prototype.getServices = function() {
  return [
    this.temperatureService,
    this.informationService,
    this.humidityService,
    this.airQualityService,
    this.loggingService
  ].filter(function(s) {
    return s !== undefined;
  });
};
