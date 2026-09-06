'use strict';

const { calculateAirQuality, calculateQualityPercentage, hasReading } = require('./air_quality');
const { bindGetter, updateCharacteristic } = require('./homebridge_api');
const { normalizeConfig } = require('./config');
const DataCache = require('./data_cache');

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function createAirRohrAccessory(dependencies) {
  const {
    Categories,
    Characteristic,
    CustomCharacteristic,
    FakeGatoHistoryService,
    Formats,
    Perms,
    Service,
    Units
  } = dependencies;

  return class AirRohrAccessory {
    constructor(log, config) {
      this.category = Categories.SENSOR;
      this.log = log;
      this.config = normalizeConfig(config);
      this.displayName = this.config.displayName;
      this.dataCache = new DataCache();
      this.isUpdating = false;
      this.qualityPercentage = null;

      this.features = this._resolveFeatures();
      this._createServices();
      this._bindGetters();
      this._scheduleUpdates();
    }

    _resolveFeatures() {
      const hasTemperatureData = Boolean(this.config.jsonURL || this.config.temperatureDataURL);
      const hasAirQualityData = Boolean(this.config.jsonURL || this.config.airQualityDataURL);
      const temperature = hasTemperatureData && !this.config.disableTemperature;
      const humidity = hasTemperatureData && !this.config.disableHumidity;
      const pressure = hasTemperatureData && !this.config.disablePressure;
      const pm25 = hasAirQualityData && !this.config.disablePm25;
      const pm10 = hasAirQualityData && !this.config.disablePm10;

      return {
        hasTemperatureData,
        hasAirQualityData,
        temperature,
        humidity,
        pressure,
        pm25,
        pm10,
        airQuality: pm25 || pm10,
        temperatureService: temperature || pressure,
        history: hasTemperatureData
      };
    }

    _createServices() {
      this.log('AirRohr: Update interval', this.config.updateIntervalSeconds, 's');

      this.informationService = new Service.AccessoryInformation();
      this.informationService.setCharacteristic(Characteristic.Manufacturer, 'luftdaten.info');
      this.informationService.setCharacteristic(Characteristic.Model, 'Feinstaubsensor');
      this.informationService.setCharacteristic(Characteristic.SerialNumber, this.config.sensorId);

      if (this.features.temperatureService) {
        this.temperatureService = new Service.TemperatureSensor(`Temperature ${this.displayName}`);
        this.temperatureService
          .getCharacteristic(Characteristic.CurrentTemperature)
          .setProps({
            format: Formats.FLOAT,
            unit: Units.CELSIUS,
            maxValue: 100,
            minValue: -100,
            minStep: 0.1,
            perms: [Perms.READ, Perms.NOTIFY]
          });

        if (this.features.pressure) {
          this.temperatureService.addOptionalCharacteristic(CustomCharacteristic.AirPressure);
        }
      }

      if (this.features.humidity) {
        this.humidityService = new Service.HumiditySensor(`Humidity ${this.displayName}`);
      }

      if (this.features.history) {
        this.loggingService = new FakeGatoHistoryService(
          'weather',
          this,
          Object.assign({ storage: 'fs' }, this.config.historyOptions)
        );
      }

      if (this.features.airQuality) {
        this.airQualityService = new Service.AirQualitySensor(`Air quality ${this.displayName}`);
        this._linkAirQualityServices();
      }
    }

    _linkAirQualityServices() {
      const linkedServices = [
        this.humidityService,
        this.temperatureService
      ].filter(service => service !== undefined);

      if (linkedServices.length > 0) {
        this.airQualityService.isPrimaryService = true;
        this.airQualityService.linkedServices = linkedServices;
      }
    }

    _bindGetters() {
      if (this.airQualityService) {
        bindGetter(
          this.airQualityService.getCharacteristic(Characteristic.AirQuality),
          () => this.airQuality
        );
        if (this.features.pm25) {
          bindGetter(
            this.airQualityService.getCharacteristic(Characteristic.PM2_5Density),
            () => this.pm25
          );
        }
        if (this.features.pm10) {
          bindGetter(
            this.airQualityService.getCharacteristic(Characteristic.PM10Density),
            () => this.pm10
          );
        }
      }

      if (this.temperatureService) {
        bindGetter(
          this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature),
          () => this.temperature
        );
      }

      if (this.humidityService) {
        bindGetter(
          this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity),
          () => this.humidity
        );
      }
    }

    _scheduleUpdates() {
      const updateIntervalMs = this.config.updateIntervalSeconds * 1000;
      this.updateTimer = setInterval(() => {
        this.updateCache();
      }, updateIntervalMs);
      this.updateCache();
    }

    updateCache(callback) {
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

      if (this.config.jsonURL) {
        this.dataCache.updateFromLocalSensor(this.config.jsonURL, updateCallback);
      } else {
        this.dataCache.updateFromLuftdatenAPI(
          this.config.airQualityDataURL,
          this.config.temperatureDataURL,
          updateCallback
        );
      }
    }

    updateServices(dataCache) {
      updateCharacteristic(
        this.informationService,
        Characteristic.FirmwareRevision,
        dataCache.software_version
      );

      this._updateTemperatureServices(dataCache);
      this._updateAirQualityServices(dataCache);
      this._updateHistory(dataCache);
    }

    _updateTemperatureServices(dataCache) {
      const { temperature, humidity, pressure } = dataCache;

      if (this.features.temperature && hasReading(temperature)) {
        this.log('Measured temperature', temperature, '°C');
        this.temperature = Number(temperature);
        updateCharacteristic(
          this.temperatureService,
          Characteristic.CurrentTemperature,
          this.temperature
        );
      }

      if (this.features.humidity && hasReading(humidity)) {
        this.log('Measured humidity', humidity, '%');
        this.humidity = Number(humidity);
        updateCharacteristic(
          this.humidityService,
          Characteristic.CurrentRelativeHumidity,
          this.humidity
        );
      }

      if (this.features.pressure && hasReading(pressure)) {
        this.log('Measured pressure', pressure, 'hPa');
        this.pressure = Number(pressure);
        updateCharacteristic(
          this.temperatureService,
          CustomCharacteristic.AirPressure,
          this.pressure
        );
      }
    }

    _updateAirQualityServices(dataCache) {
      if (!this.airQualityService) {
        return;
      }

      const readings = {
        pm10: this.features.pm10 ? dataCache.pm10 : null,
        pm25: this.features.pm25 ? dataCache.pm25 : null
      };

      if (this.features.pm25 && hasReading(dataCache.pm25)) {
        this.log('Measured PM2.5', dataCache.pm25, 'µg/m³');
        this.pm25 = Number(dataCache.pm25);
        updateCharacteristic(this.airQualityService, Characteristic.PM2_5Density, this.pm25);
      }

      if (this.features.pm10 && hasReading(dataCache.pm10)) {
        this.log('Measured PM10', dataCache.pm10, 'µg/m³');
        this.pm10 = Number(dataCache.pm10);
        updateCharacteristic(this.airQualityService, Characteristic.PM10Density, this.pm10);
      }

      const qualityPercentage = calculateQualityPercentage(readings, this.config.limits);
      if (qualityPercentage === null) {
        return;
      }

      const absChange = Math.abs(this.qualityPercentage - qualityPercentage);
      const wasNotSet = this.qualityPercentage === undefined || this.qualityPercentage === null;
      this.qualityPercentage = qualityPercentage;

      if (wasNotSet || absChange >= 0.05) {
        this.airQuality = calculateAirQuality(qualityPercentage, Characteristic);
        updateCharacteristic(this.airQualityService, Characteristic.AirQuality, this.airQuality);
      }
    }

    _updateHistory(dataCache) {
      if (!this.loggingService) {
        return;
      }

      this.loggingService.addEntry({
        time: nowUnixSeconds(),
        temp: dataCache.temperature,
        pressure: dataCache.pressure,
        humidity: dataCache.humidity
      });
    }

    getServices() {
      return [
        this.temperatureService,
        this.informationService,
        this.humidityService,
        this.airQualityService,
        this.loggingService
      ].filter(service => service !== undefined);
    }
  };
}

module.exports = createAirRohrAccessory;
