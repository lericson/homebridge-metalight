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
import { setTimeout } from "timers";

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
  private getLightsOp: Promise<any[]> | null = null;
  private hue: any;

  private readonly lightbulbService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    hue.api.createLocal(config.host).connect(config.username)
      .then(api => this.hue = api)
      .catch(err => console.error(`Unexpected Error: ${err.message}`));

    this.log = log;
    this.name = config.name;
    
    const delay = async (ms: number) =>
      new Promise<null>((resolve, reject) => {
        setTimeout(resolve, ms);
      });
    
    const getAllLights = async () => {
      if (this.getLightsOp) {
        log.debug('getAllLights: already in-progress, awaiting');
        return await this.getLightsOp;
      } else {
        this.getLightsOp = (async (): Promise<any[]> => {
          log.debug('getAllLights: begin fetching all lights');
          let allLights: any[] = await this.hue.lights.getAll();
          log.debug('getAllLights: finished fetching');
          return allLights;
        })();
        try {
          return await this.getLightsOp;
        } finally {
          setTimeout(() => { this.getLightsOp = null; }, 100);
        }
      }
    };
    
    const getAverageBrightness = async () => {
      let brights = (await getAllLights())
        .map(light => (light.state.on ? light.state.bri : 0) as number)
        .filter(bri => bri > 1);
      if (!brights) {
        return 0;
      }
      return brights.reduce(((a, b) => a + b), 0) / brights.length;
    };

    const setStates = async (newState: any) => {
      log.debug('setStates: begin fetching all lights');
      let allLights: any[] = await getAllLights();
      log.debug('setStates: finished fetching, setting states');
      if (!this.lock) {
        this.lock = true;
        try {
          await Promise.all(
            allLights
              .filter(light => light.state.on && ((newState.on === false) || light.state.bri > 1))
              .map(async (light, i) => {
                if (i > 2) {
                  await delay((i-2)*200);
                }
                log.debug(`setStates: updating #${light.id} ${light.name} state`);
                try {
                  await this.hue.lights.setLightState(light, newState);
                } catch (err) {
                  log.error(`failed to set state of #${light.id} ${light.name}: ${err}`)
                }
              })
          );
        } finally {
          this.lock = false;
        }
        log.debug('setStates: finished setting');
      } else {
        log.warn('setStates: lock already held, ignoring set');
      }
    };

    this.lightbulbService = new hap.Service.Lightbulb(this.name);

    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.debug('get on characteristic');
        getAllLights()
          .then((lights: any[]) => callback(undefined, lights.some(light => light.state.on)))
          .catch((err: Error) => {
            log.error(`Get ON error, ${err.name}: ${err.message}`);
            callback(err, undefined);
          });
        log.debug('get on characteristic done');
      }).on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (value as boolean) {
          // Ignore turning on.
          callback();
        } else {
          setStates({on: false})
            .then(() => callback())
            .catch((err: any) => callback(err, undefined));
        }
      });

    this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.debug('get brightness characteristic');
        getAverageBrightness()
          .then((brightness: number) => callback(undefined, brightness/254*100))
          .catch((err: Error) => {
            log.error(`Get Brightness error, ${err.name}: ${err.message}`);
            callback(err, undefined);
          });
        log.debug('get brightness characteristic done');
      }).on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        callback(undefined, undefined);
        setStates({bri: (value as number) / 100 * 254})
          .catch((err: Error) => log.error(`${err.name}: ${err.message}`));
      });

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
