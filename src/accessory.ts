import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import * as hue from "node-hue-api";

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("MetaLight", MetaLight);
};

class MetaLight implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private lock = false;
  private hue: any;

  private readonly lightbulbService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {

    hue.api.createLocal(config.host).connect(config.username)
      .then(api => this.hue = api)
      .catch(err => console.error(`Unexpected Error: ${err.message}`));

    this.log = log;
    this.name = config.name;

    const getAverage: (() => Promise<number>) = async () => {
      let allLights: any[] = await this.hue.lights.getAll();
      let brightness: number[] = 
        allLights
          .filter(light => light.state.on)
          .map(light => light.state.bri);
      if (brightness.length == 0) {
        return 0;
      }
      return brightness.reduce(((sum, b) => sum + b), 0) / brightness.length;
    };

    const setStates: ((newState: any) => Promise<any>) = async (newState: any) => {
      let allLights: any[] = await this.hue.lights.getAll();
      await Promise.all(
        allLights
          .filter(light => light.state.on)
          .map(light => this.hue.lights.setLightState(light, newState))
      );
    };

    this.lightbulbService = new hap.Service.Lightbulb(this.name);

    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) =>
        getAverage()
          .then((average: number) => callback(undefined, average > 0))
          .catch((err: any) => callback(err, undefined)))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (value as boolean) {
          // Ignore turning on.
          callback();
        } else {
          setStates({on: false}).then(() => callback());
        }
      });

    this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) =>
        getAverage()
          .then((brightness: number) => callback(undefined, brightness/254*100))
          .catch((err: any) => callback(err, undefined)))
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        callback();
        if (!this.lock) {
          this.lock = true;
          setStates({bri: (value as number) / 100 * 254})
            .finally(() => { this.lock = false });
        }
        /*
          .then((promises: Promise<any>[]) =>
            Promise.all(promises)
              .then(() => )
              .catch((err: any) => callback(err, undefined)))
        */
      });

    //this.lightbulbService.getCharacteristic(hap.Characteristic.On)

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "MetaMan")
      .setCharacteristic(hap.Characteristic.Model, "MetaLight");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.lightbulbService,
    ];
  }

}
