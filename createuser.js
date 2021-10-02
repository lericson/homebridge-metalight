
'use strict';

// If using this code outside of this library the above should be replaced with
const hue = require('node-hue-api');

const APPLICATION_NAME = 'node-hue-api'
  , DEVICE_NAME = 'homebridge'
;


hue.discovery.nupnpSearch()
  .then(searchResults => {
    const host = searchResults[0].ipaddress;
    console.log('createLocal', searchResults[0]);
    return hue.api.createLocal(host).connect();
  })
  .then(api => {
    return api.users.createUser(APPLICATION_NAME, DEVICE_NAME);
  })
  .then(createdUser => {
    // Display the details of user we just created (username and clientkey)
    console.log(createdUser);
  })
  .catch(err => {
    if (err.getHueErrorType() === 101) {
      console.error('You need to press the Link Button on the bridge first');
    } else {
      console.error(`Unexpected Error: ${err.message}`);
    }
  })
;
