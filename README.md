# homebridge-airrohr

[HomeBridge](http://github.com/nfarina/homebridge) module for the DIY [luftdaten.info](https://luftdaten.info) [air particulates](https://en.wikipedia.org/wiki/Particulates) sensor from [OpenData Stuttgart](ttps://github.com/opendata-stuttgart/).

It can be used to see the status of your own sensor in HomeKit. You can also use it to see another sensor if it's data is published to api.luftdaten.info (see [here](http://luftdaten.info/faq/#toggle-id-8)).

## Setup

Install `homebridge-airrohr` using `(sudo) npm install -g homebridge-airrohr`.

Configure your AirRohr sensor in the `homebridge` settings file. See [conig.sample.json](https://github.com/toto/homebridge-airrohr/blob/master/conig.sample.json). All settings except `update_interval_seconds` are required (defaults to 120 seconds).

The key setting is `json_data` property can either be set to:

-  `http://feinstaubsensor-<YOUR_SENSOR_ID>.local/data.json` using the same local network as your sensor
-  `http://api.luftdaten.info/v1/sensor/<YOUR_SENSOR_ID>/` to use the public sensor API. This way you can also add other people's sensors

Follow the instructions for [HomeBridge](http://github.com/nfarina/homebridge)
