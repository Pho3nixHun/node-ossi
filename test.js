"use strict";

const death = require('death')({ uncaughtException: true })
const Ossi = require('./ossi.js').Ossi;
const fs = require('fs');
const winston = require('winston');

winston.level = 'silly';
winston.add(winston.transports.File, {
    filename: 'debug.log',
    handleExceptions: true,
    humanReadableUnhandledException: true
});
var ossi1 = new Ossi({
    host: '123.456.789.123',
    port: 5022,
    username: 'your-username',
    password: 'your-password',
    debugLogger: winston.log,
    debug: false,
    logger: winston.log,
    verbose: Ossi.VERBOSITY.debug,
    dataEncoding: 'ascii'
});

var resultCb = (result) => {
    console.log('### Result ###');
    console.log(result);
}
var errorCb = (err) => {
    console.log('ERR',err)
}

ossi1.connect().then(() => {
    ossi1.execute('lis sta')
        .then(resultCb, errorCb)
        .then(() => {
            console.log('### Disconnecting ###');
            ossi1.disconnect();
        });
}, errorCb);


death(function (signal, err) {
    if (signal) console.log(`Signal '${signal}' received.`) 
    if (err) console.log(err);
    setTimeout(process.exit, 2000);
})