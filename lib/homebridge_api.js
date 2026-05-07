'use strict';

function getHapExport(hap, Characteristic, key) {
  return hap[key] || Characteristic[key];
}

function bindGetter(characteristic, getter) {
  if (typeof characteristic.onGet === 'function') {
    characteristic.onGet(getter);
    return characteristic;
  }

  characteristic.on('get', callback => callback(null, getter()));
  return characteristic;
}

function updateCharacteristic(service, characteristic, value) {
  if (typeof service.updateCharacteristic === 'function') {
    service.updateCharacteristic(characteristic, value);
  } else {
    service.setCharacteristic(characteristic, value);
  }
}

function resolveHap(api) {
  const { hap } = api;
  const { Characteristic, Service } = hap;

  return {
    Characteristic,
    Service,
    Formats: getHapExport(hap, Characteristic, 'Formats'),
    Perms: getHapExport(hap, Characteristic, 'Perms'),
    Units: getHapExport(hap, Characteristic, 'Units'),
    Categories: hap.Categories || hap.Accessory.Categories
  };
}

module.exports = {
  bindGetter,
  resolveHap,
  updateCharacteristic
};
