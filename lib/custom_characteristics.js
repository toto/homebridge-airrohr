const inherits = require('util').inherits;

function CustomCharacteristics(Characteristic, hap) {
  const Formats = hap.Formats || Characteristic.Formats;
  const Perms = hap.Perms || Characteristic.Perms;

  this.AirPressure = function() {
    Characteristic.call(this, 'Air Pressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
    this.setProps({
      format: Formats.FLOAT,
      unit: 'hectopascals',
      minValue: 700,
      maxValue: 1100,
      minStep: 1,
      perms: [Perms.READ, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(this.AirPressure, Characteristic);

  return this;
}

module.exports = CustomCharacteristics;
