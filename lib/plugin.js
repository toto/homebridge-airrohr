'use strict';

const createAirRohrAccessory = require('./accessory');
const createCustomCharacteristics = require('./custom_characteristics');
const { resolveHap } = require('./homebridge_api');

function registerPlugin(homebridge) {
  const hap = resolveHap(homebridge);
  const CustomCharacteristic = createCustomCharacteristics(hap.Characteristic, homebridge.hap);
  const FakeGatoHistoryService = require('fakegato-history')(homebridge);
  const AirRohrAccessory = createAirRohrAccessory({
    Categories: hap.Categories,
    Characteristic: hap.Characteristic,
    CustomCharacteristic,
    FakeGatoHistoryService,
    Formats: hap.Formats,
    Perms: hap.Perms,
    Service: hap.Service,
    Units: hap.Units
  });

  homebridge.registerAccessory(
    'homebridge-airrohr',
    'airrohr',
    AirRohrAccessory
  );
}

module.exports = registerPlugin;
