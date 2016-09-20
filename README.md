# node-ossi

Easy to use ossi client for AVAYA CM. It supports both callbacks and promises.

```
const Ossi = require('./ossi.js').Ossi;
const winston = require('winston');
const fs = require('fs');

var ossi = new Ossi({
    host: '123.456.789.123',
    port: 5022,
    username: 'your-username',
    password: 'your-password',
    logger: winston.log,
    verbose: Ossi.VERBOSITY.debug,
    dataEncoding: 'ascii'
});

ossi.connect()
  .then(() => ossi.execute('lis sta'))
  .then((result) => {
    fs.writeFileSync('result.json', JSON.stringify(result));
    return result;
  })
  .then(()=>{
      ossi.disconnect();
  });

```
