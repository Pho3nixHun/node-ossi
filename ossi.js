"use strict";

const extend = require('xtend');
const Client = require('ssh2').Client;
const EventEmitter = require('events');
const util = require('util');
const Q = require('q');
const Verbosity = require('./verbosity.js');

var Ossi = (function () {
    var Ossi = function Ossi(options) { constructor.apply(this, arguments); return this; }
    util.inherits(Ossi, EventEmitter);
    var VERBOSITY = new Verbosity();
    Object.defineProperty(Ossi, 'VERBOSITY', {
        get: function () {
            return VERBOSITY;
        }
    })

    Ossi.defaultOptions = {
        host: { value: null, type: 'string', required: true },
        port: { value: 5022, type: 'number' },
        username: { value: null, type: 'string', required: true },
        password: { value: null, type: 'string', required: true },
        terminalType: { value: 'ossi3', type: 'string' },
        debug: { value: false, type: 'boolean', },
        debugLogger: { value: Function.prototype, type: 'function' },
        verbosity: { value: VERBOSITY.error, type: VERBOSITY.isVerbosity },
        logger: { value: Function.prototype, type: 'function' },
        hostVerifier: { value: function (hostKey) { console.log('WARNING: Every hostkey is accepted. Please check hostVerifier option!'); return true; }, type: 'function' },
        keepaliveInterval: { value: 10000, type: 'number' },
        readyTimeout: { value: 10000, type: 'number' },
        tryKeyboard: { value: true, type: 'boolean' },
        dataEncoding: { value: 'ascii', type: 'string' }
    }
    Ossi.extendOptions = function (options, defaultOptions) {
        if (arguments.length < 2 || defaultOptions == false) return arguments[0];
        for (let key in defaultOptions) {
            let defaultOption = defaultOptions[key];
            if (defaultOption.required && options.hasOwnProperty(key) == false) throw `Option '${key}'(=${options[key]}) is required.`;
            options[key] = options.hasOwnProperty(key) ? options[key] : defaultOption.value;
            if ((typeof defaultOption.type) === 'function') {
                if (defaultOption.type(options[key]) === false) throw `Option '${key}' type validation failed.`;
            } else if ((typeof options[key]) !== defaultOption.type) throw `Option '${key}' have to be a ${defaultOption.type}`;
        }
        return options;
    }
    Ossi.buildArgument = function (arr, pre, len) {
        var c = '';
        if (arr && arr.length) { //If we want fields to be shown
            var index = 0;
            do {
                c += pre;
                for (var _index = 0; _index < len; _index++) {
                    var i = index + _index;
                    if (i >= arr.length) break;
                    c += `${arr[i]}${(_index - 1) == len ? '\n' : '\t'}`;
                }
                index += len;
            } while (index < arr.length)
        }
        return c;
    }
    Ossi.buildCommand = function (options) {
        options = Ossi.extendOptions(options, {
            command: { value: 'help', type: 'string', required: true},
            objectType: { value: '', type: 'string' },
            fields: { value: [], type: o => (o || {}).constructor.name == 'Array' },
            data: { value: [], type: o => (o || {}).constructor.name == 'Array' },
            commandPerLine: { value: 5, type: 'number' }
        })

        let command = `c ${options.command} ${options.objectType} \n`; //Standard command
        if (options.fields.length) command += `${Ossi.buildArguments(options.fields, 'f', options.commandPerLine)}\n`;
        if (options.fields.length && options.data.length) command += `${Ossi.buildArguments(options.data, 'd', options.commandPerLine)}\n`;
        command += `t\n`;
        return command;
    }
    Ossi.dictionaryPath = './dictionary.json';
    Object.defineProperty(Ossi, 'dictionary', {
        get: function(){
            if (Ossi.dictionaryPath){
                return require(Ossi.dictionaryPath);
            }
            return {};
        }
    })
    Ossi.translate = function(obj, command){
        
        function findSubDictionary(c, d){
            var sd = d;
            if (c && typeof c == "string"){
                var c = command.split(' ').map(Function.prototype.call, String.prototype.toLowerCase);
                for(var k in c) {
                    let part = c[k];
                    let keys = Object.keys(sd).filter(k => k.indexOf(part) == 0);
                    if (keys && keys.length == 0) break;
                    if (sd[keys[0]]) sd = sd[keys[0]];
                }
            }
            return sd;
        }
        function findKey(_key, d){
            let result = _key;
            if (d[_key]){
                result = d[_key]
            }else{
                Object.keys(d).forEach((k) => {
                    if (typeof d[k] == 'object') result = findKey(_key, d[k]);
                })
            }
            return result;
        }
        var result = {};
        var d = findSubDictionary(command, Ossi.dictionary);
        console.log('Translate')
        Object.keys(obj).forEach((key) => {
            var t = findKey(key, d);
            result[t] = obj[key];
        })
        return result; 
    }

    let constructor = function (options) {
        EventEmitter.call(this);
        this.options = Ossi.extendOptions(options, Ossi.defaultOptions);
        let permittedCommands = [];
        Object.defineProperty(this, 'permittedCommands', {
            get: () => {
                return permittedCommands;
            },
            set: (value) => {
                if ((o || {}).constructor.name != 'Array') throw `permittedCommands(=${value}) have to be an Array of strings.`
                permittedCommands = value;
            }
        })
        this.emit('init');
        this.writeLog(Ossi.VERBOSITY.silly, 'constructor invoked', options)
    }

    Ossi.prototype.writeLog = function (verbosity) {
        let args = new Array(...arguments)
        let v = Ossi.VERBOSITY.isVerbosity(verbosity) ? args.shift() : Ossi.VERBOSITY.info;
        let debugLogger = this.options.debug ? this.options.debugLogger : Function.prototype;
        let logger = this.options.logger;
        if (this.options.verbosity >= v) logger.call(null, Ossi.VERBOSITY.translate(v), ...args);
        debugLogger.call(null, Ossi.VERBOSITY.translate(v), ...args);
    }
    Ossi.prototype.parseResult = function (data) {
        let results = [];
        let resultClass = function () { return this; };
        let keys = [];
        let values = [];
        for (let i = 0; i < data.length; i++) {
            let line = data[i].slice(1).split('\t')
            switch (true) {
                case data[i].indexOf('c') == 0:
                    // Command
                    this.writeLog(Ossi.VERBOSITY.debug, `Command appeared on stdout '${data[i]}'`);
                    break;
                case data[i].indexOf('t') == 0:
                    // Command terminator
                    this.writeLog(Ossi.VERBOSITY.debug, `Command terminator appeared on stdout '${data[i]}'`);
                    break;
                case data[i].indexOf('f') == 0:
                    for (let j = 0; j < line.length; j++) {
                        keys.push(line[j]);
                        resultClass.prototype[line[j]] = null;
                    }
                    break;
                case data[i].indexOf('d') == 0:
                    for (let j = 0; j < line.length; j++) {
                        values.push(line[j]);
                    }
                    break;
                case data[i].indexOf('n') == 0:
                    let result = new resultClass();
                    for (let j = 0; j < values.length; j++) {
                        if (keys.length > j) result[keys[j]] = values[j]
                        else this.writeLog(Ossi.VERBOSITY.error, `Cannot find key for value (${values[j]})`);
                    }
                    for (let j = 0; j < keys.length; j++) {
                        if (!result.hasOwnProperty(keys[j])) result[keys[j]] = null;
                    }
                    results.push(result);
                    values = [];
                    break;
                default:
                    this.writeLog(Ossi.VERBOSITY.warn, `Unknown line appeared ${data[i]}`);
                    break;
            }
        }
        if (results.length == 0) {
            return values;
        } else {
            return results;
        }
    }
    Ossi.prototype.connect = function (cb) {
        this.writeLog(Ossi.VERBOSITY.silly, 'connect invoked');
        let deferred = Q.defer();

        if (this.isConnected) {
            this.writeLog(Ossi.VERBOSITY.warn, 'Already connected.');
            deferred.reject('Already connected');
            return;
        }
        this.writeLog(Ossi.VERBOSITY.silly, 'connect not yet connected');
        if (typeof cb === 'function') this.once('ready', cb);
        this.once('ready', deferred.resolve);
        this._tSentOnStdin = 0;
        let stdout = this.stdout = [];
        let conn = this.connection = new Client();
        conn
            .on('ready', () => {
                this.isConnected = true;
                this.emit('connected');
                this.connection
                    .shell({ term: this.options.terminalType }, (err, stream) => {
                        if (err) return deferred.reject(err);
                        stream
                            .on('close', (code, signal) => {
                                this.writeLog(Ossi.VERBOSITY.warn, 'Stream closed', code, signal);
                                this.stream = undefined;
                                this.emit('disconnect', code, signal);
                                this.connection.end();
                            })
                            .on('end', () => {
                                this.writeLog(Ossi.VERBOSITY.info, 'Stream ended');
                                this.stream = undefined;
                                this.isReady = false;
                                this.isConnected = false;
                                this.removeListener('data', onDataReceived);
                                this.removeListener('line', detectTerminalTypeRequest);
                                this.removeListener('line', detectReady);
                                this.emit('disconnect')
                            })
                            .on('data', (data) => {
                                this.writeLog(Ossi.VERBOSITY.silly, 'data:', data.toString(this.options.dataEncoding).replace(/[^\x20-\x7F]/g, ""));
                                this.emit('data', data, stream);
                            })
                            .stderr.on('data', (data) => {
                                this.writeLog(Ossi.VERBOSITY.debug, 'stderr data:', data.toString(this.options.dataEncoding).replace(/[^\x20-\x7F]/g, ""));
                                this.emit('stderr', data, stream);
                            });
                    })
            })
            .on('banner', (message, language) => {
                this.writeLog(Ossi.VERBOSITY.debug, 'banner', message, language);
                this.emit('banner', message, language);
                deferred.notify('banner', message, language)
            })
            .on('keyboard-interactive', (/*string*/name, /*string*/instructions, /*string*/instructionsLang, /*array*/prompts, /*function*/finish) => {
                this.writeLog(Ossi.VERBOSITY.info, 'keyboard-interactive authentication');
                finish([this.options.password]);
                deferred.notify('keyboard-interactive')
            })
            .on('error', (err) => {
                this.writeLog(Ossi.VERBOSITY.error, 'Connection error', err);
                this.emit('error', err);
                deferred.reject(err);
            })
            .on('close', (hadError) => {
                this.writeLog(Ossi.VERBOSITY.info, `hadError: ${hadError}`);
                this.emit('disconnect', hadError);
            })
            .connect(this.options);
        this.once('disconnect', onDisconnect);
        this.on('line', detectTerminalTypeRequest);
        this.on('data', onDataReceived);
        function onDataReceived(data, stream) {
            this.writeLog(Ossi.VERBOSITY.silly, 'onDataReceived invoked');
            let dataStr = data.toString(this.options.dataEncoding);
            let l = this.stdout.length;
            let d = dataStr.split('\u000A'); // newline character
            for (let i = -1; i < d.length - 1; i++) {
                this.stdout[l + i] = d[i + 1].trim();
                this.emit('line', this.stdout[l + i - 1], this.stdout[l + i], stream);
            }
        }
        function detectReady(oldLine, newLine, stream) {
            this.writeLog(Ossi.VERBOSITY.silly, 'detectRead invoked');
            if (this._tSentOnStdin > 0) return this._tSentOnStdin--;
            if (oldLine.indexOf('t') == 0) {
                this.writeLog(Ossi.VERBOSITY.info, 'Ossi console ready to receive commands');
                this.isReady = true;
                this.stream = stream;
                this.emit('ready', stream);
            }
        }
        function onDisconnect() {
            this.writeLog(Ossi.VERBOSITY.warn, `Connection was closed due to ${this.isClosing ? 'client request' : 'unknown reason'}`);
            this.isConnected = false;
            this.isReady = false;
        }
        function detectTerminalTypeRequest(oldLine, newLine, stream) {
            this.writeLog(Ossi.VERBOSITY.silly, 'detectTerminalTypeRequest invoked');
            if (newLine.indexOf('Terminal Type') > -1) {
                this.writeLog(Ossi.VERBOSITY.debug, `Sending terminal type: ${this.options.terminalType}`);
                stream.stdin.write(this.options.terminalType + '\n');
                this.on('line', detectReady);
                this.removeListener('line', detectTerminalTypeRequest);
            }
        }

        return deferred.promise;
    }
    Ossi.prototype.disconnect = function (cb) {
        let deferred = Q.defer();
        this.isClosing = true;
        this.once('disconnect', cb || Function.prototype);
        this.once('disconnect', deferred.resolve);
        this.execute('logoff', () => {
            if (this.isConnected) {
                this.isClosing = true;
                if (this.stream) this.stream.end('exit\n');
                this.connection.end();
            }
        })
        return deferred.promise;
    }
    Ossi.prototype.execute = function (options, cb) {
        cb = (typeof cb === 'function') ? cb : Function.prototype;
        if (typeof options === 'string') options = { command: options };
        options = Ossi.extendOptions(options, {
            parse: { value: true, type: 'boolean' },
            translate: { value: true, type: 'boolean' }
        })
        this.writeLog(Ossi.VERBOSITY.silly, `execute invoked`, options)
        let deferred = Q.defer();
        let l1 = this.stdout.length - 1;
        let command = Ossi.buildCommand(options);
        if (this.isConnected !== true){
            let err = { error: "Not connected." }
            defered.reject(err);
            cb.call(this, err);
        } else if (this.isReady !== true) {
            let err = { error: "Not ready to receive command. Please try again later." }
            deferred.reject(err);
            cb.call(this, err);
        } else {
            this.writeLog(Ossi.VERBOSITY.debug, `Sending command '${command}'`)
            this.isReady = false;
            this.stream.stdin.write(command);
            this._tSentOnStdin++;
            this.once('ready', (finish) => {
                let result = this.stdout.slice(l1);
                this.writeLog(Ossi.VERBOSITY.silly, `execute ready`, options, result)
                result = options.parse ? this.parseResult(result) : result;
                if (options.parse && options.translate) {
                    if (result.map) result = result.map(r => Ossi.translate(r, options.command))
                }
                deferred.resolve(result);
                cb.call(this, result);
            });
            this.once('error', deferred.reject);
        }
        return deferred.promise;
    }
    
    return Ossi;
})();

module.exports = exports = {
    Ossi
}

//TODO: rewrite Ossi.parseResult to return promise