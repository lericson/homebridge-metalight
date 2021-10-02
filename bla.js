const hue = require('node-hue-api');


const config = {
  host: '10.0.1.3',
  username: 'xuPiG26BtXF8zIMRrMtEXldLL3GpnbzAEUck96yD',
  clientkey: 'C93D19051BE13B385E9A7E8846AE6BEC'
};

async function getBridge() {
  //const results = await hue.discovery.nupnpSearch()
  //console.log('connect', results[0]);
  //let host = results[0].ipaddress;

  let api = await hue.api.createLocal(config.host).connect(config.username);

  console.log('getAll');
  let allLights = await api.lights.getAll();
  console.log('getAll done');
  // Display the lights from the bridge
  allLights.forEach(light => console.log(light.toStringDetailed()));
  let averageBrightness = allLights.reduce(((sum, {state: {bri: b}}) => sum + b), 0) / allLights.length;
  console.log(averageBrightness);

  await Promise.all(allLights.map(light => {
    if (light.state.on) {
      //return api.lights.setLightState(light.id, {on: true, ct: 153, bri: 20/100*254});
      return api.lights.hueApi.getLightDefinition(light.id).then(device => {
        let state = {bri: 40/100*254};
        console.log('BAM');
        return api.lights.execute(lightsApi.setLightState, {id: light.id, state: state, device: device});
      });
    } else {
      return Promise.resolve(undefined);
    }
  }));

  console.log('post hoc ergo propter hoc');
}

getBridge();
