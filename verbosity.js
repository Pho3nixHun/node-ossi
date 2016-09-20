"use strict";

function VERBOSITY() {
    return function VERBOSITY() {
        let verbosityLevels = {
            silly: new Number(4),
            debug: new Number(3),
            info: new Number(2),
            warn: new Number(1),
            error: new Number(0),
            none: new Number(-1)
        }
        this.isVerbosity = function (v) {
            for (let key in verbosityLevels) {
                if (verbosityLevels[key] === v) return true;
            }
            return false;
        }
        this.translate = function (v) {
            if (typeof v === 'string') {
                for (let key in verbosityLevels) {
                    if (key === v) return verbosityLevels[key];
                }
            } else {
                for (let key in verbosityLevels) {
                    if (verbosityLevels[key] === v) return key;
                }
            }
            return false;
        }
        for(let key in verbosityLevels){
            Object.defineProperty(this, key, {
                get: function(){
                    return verbosityLevels[key];
                }
            })
        }
        return this;
    }
}

module.exports = exports = VERBOSITY();