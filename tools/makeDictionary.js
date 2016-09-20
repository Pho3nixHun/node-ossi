"use strict";

const fs = require('fs');
const D = require('./ossimtAll.json');
const death = require('death')({ uncaughtException: true, debug: true });
const extend = require('xtend');

death(function (signal, err) {
    if (signal) console.log(`Received signal ${signal}`);
    if (err) console.log(`uncaughtException ${err}`);
    process.exit(1);
})

function extractParams(root) {
    let result = {};
    if (root != null && (typeof root) == 'object') {
        if (root.params) {
            if ((root.params || {}).constructor.name == "Array") {    
                root.params.filter(p => p.name).map((p) => {
                    return { name: p.name, code: p.code }
                }).forEach((p)=>{
                    result[p.code] = p.name.replace(/[^\x30-\x39,^\x41-\x5A,^\x61-\x7A,^\x24,^\x5F]/g, "");
                })
            } else console.log(`Whaaat?! type of root.param is ${typeof root.params}`);
        }
        Object.keys(root).filter((k) => k != "params").forEach((k) => {
            result[k.toLowerCase()] = extractParams(root[k]);
        })
    }
    return result;
}

var r = extractParams(D)

fs.writeFileSync('dictionary.json', JSON.stringify(r));