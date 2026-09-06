const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const createAirRohrAccessory = require('../lib/accessory');

function createServiceClass(type) {
    return class MockService {
        constructor(name) {
            this.type = type;
            this.name = name;
            this.characteristics = new Map();
            this.sets = [];
            this.updates = [];
            this.optionalCharacteristics = [];
        }

        setCharacteristic(characteristic, value) {
            this.sets.push({ characteristic, value });
            return this;
        }

        updateCharacteristic(characteristic, value) {
            this.updates.push({ characteristic, value });
            return this;
        }

        getCharacteristic(characteristic) {
            if (!this.characteristics.has(characteristic)) {
                this.characteristics.set(characteristic, {
                    props: null,
                    getter: null,
                    setProps(props) {
                        this.props = props;
                        return this;
                    },
                    onGet(getter) {
                        this.getter = getter;
                        return this;
                    }
                });
            }
            return this.characteristics.get(characteristic);
        }

        addOptionalCharacteristic(characteristic) {
            this.optionalCharacteristics.push(characteristic);
            return this;
        }
    };
}

function createDependencies() {
    const Characteristic = {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        FirmwareRevision: 'FirmwareRevision',
        CurrentTemperature: 'CurrentTemperature',
        CurrentRelativeHumidity: 'CurrentRelativeHumidity',
        PM2_5Density: 'PM2_5Density',
        PM10Density: 'PM10Density',
        AirQuality: {
            UNKNOWN: 0,
            EXCELLENT: 1,
            GOOD: 2,
            FAIR: 3,
            INFERIOR: 4,
            POOR: 5
        }
    };
    Characteristic.AirQuality.toString = () => 'AirQuality';

    class FakeGatoHistoryService {
        constructor(type, accessory, options) {
            this.type = type;
            this.accessory = accessory;
            this.options = options;
            this.entries = [];
        }

        addEntry(entry) {
            this.entries.push(entry);
        }
    }

    return {
        Categories: { SENSOR: 10 },
        Characteristic,
        CustomCharacteristic: { AirPressure: 'AirPressure' },
        FakeGatoHistoryService,
        Formats: { FLOAT: 'float' },
        Perms: { READ: 'read', NOTIFY: 'notify' },
        Service: {
            AccessoryInformation: createServiceClass('AccessoryInformation'),
            AirQualitySensor: createServiceClass('AirQualitySensor'),
            HumiditySensor: createServiceClass('HumiditySensor'),
            TemperatureSensor: createServiceClass('TemperatureSensor')
        },
        Units: { CELSIUS: 'celsius' }
    };
}

function createAccessory(config) {
    const Accessory = createAirRohrAccessory(createDependencies());
    Accessory.prototype._scheduleUpdates = function() {};
    return new Accessory(() => {}, Object.assign({
        name: 'AirRohr',
        json_data: 'http://sensor.local/data.json',
        sensor_id: '123'
    }, config));
}

describe('AirRohrAccessory', () => {
    it('should use injected HAP enum exports for temperature properties', () => {
        const accessory = createAccessory();

        assert.equal(accessory.category, 10);
        assert.equal(
            accessory.temperatureService
                .getCharacteristic('CurrentTemperature')
                .props
                .format,
            'float'
        );
    });

    it('should honor history options while preserving fs storage as the default', () => {
        const accessory = createAccessory({
            history: {
                path: '/tmp/history'
            }
        });

        assert.deepEqual(accessory.loggingService.options, {
            storage: 'fs',
            path: '/tmp/history'
        });
    });

    it('should honor disabled PM2.5 and calculate quality from PM10 only', () => {
        const accessory = createAccessory({ disable_pm25: true });

        accessory.updateServices({
            software_version: '1.0',
            temperature: 0,
            humidity: 0,
            pressure: 0,
            pm25: 100,
            pm10: 25
        });

        assert.equal(accessory.pm25, undefined);
        assert.equal(accessory.pm10, 25);
        assert.equal(accessory.airQuality, 2);
        assert.equal(
            accessory.airQualityService.updates.some(update => update.characteristic === 'PM2_5Density'),
            false
        );
    });

    it('should treat zero readings as valid service updates', () => {
        const accessory = createAccessory();

        accessory.updateServices({
            software_version: '1.0',
            temperature: 0,
            humidity: 0,
            pressure: 0,
            pm25: 0,
            pm10: 0
        });

        assert.equal(accessory.temperature, 0);
        assert.equal(accessory.humidity, 0);
        assert.equal(accessory.pressure, 0);
        assert.equal(accessory.pm25, 0);
        assert.equal(accessory.pm10, 0);
        assert.equal(accessory.airQuality, 1);
    });

    it('should omit the air quality service when both particle readings are disabled', () => {
        const accessory = createAccessory({
            disable_pm25: true,
            disable_pm10: true
        });

        assert.equal(accessory.airQualityService, undefined);
    });
});
