require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file abi.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 *   Gav Wood <g@ethdev.com>
 * @date 2014
 */

var utils = require('../utils/utils');
var c = require('../utils/config');
var types = require('./types');
var f = require('./formatters');

/**
 * throw incorrect type error
 *
 * @method throwTypeError
 * @param {String} type
 * @throws incorrect type error
 */
var throwTypeError = function (type) {
    throw new Error('parser does not support type: ' + type);
};

/** This method should be called if we want to check if givent type is an array type
 *
 * @method isArrayType
 * @param {String} type name
 * @returns {Boolean} true if it is, otherwise false
 */
var isArrayType = function (type) {
    return type.slice(-2) === '[]';
};

/**
 * This method should be called to return dynamic type length in hex
 *
 * @method dynamicTypeBytes
 * @param {String} type
 * @param {String|Array} dynamic type
 * @return {String} length of dynamic type in hex or empty string if type is not dynamic
 */
var dynamicTypeBytes = function (type, value) {
    // TODO: decide what to do with array of strings
    if (isArrayType(type) || type === 'bytes')
        return f.formatInputInt(value.length);
    return "";
};

var inputTypes = types.inputTypes();

/**
 * Formats input params to bytes
 *
 * @method formatInput
 * @param {Array} abi inputs of method
 * @param {Array} params that will be formatted to bytes
 * @returns bytes representation of input params
 */
var formatInput = function (inputs, params) {
    var bytes = "";
    var toAppendConstant = "";
    var toAppendArrayContent = "";

    /// first we iterate in search for dynamic
    inputs.forEach(function (input, index) {
        bytes += dynamicTypeBytes(input.type, params[index]);
    });

    inputs.forEach(function (input, i) {
        /*jshint maxcomplexity:5 */
        var typeMatch = false;
        for (var j = 0; j < inputTypes.length && !typeMatch; j++) {
            typeMatch = inputTypes[j].type(inputs[i].type, params[i]);
        }
        if (!typeMatch) {
            throwTypeError(inputs[i].type);
        }

        var formatter = inputTypes[j - 1].format;

        if (isArrayType(inputs[i].type))
            toAppendArrayContent += params[i].reduce(function (acc, curr) {
                return acc + formatter(curr);
            }, "");
        else if (inputs[i].type === 'bytes')
            toAppendArrayContent += formatter(params[i]);
        else
            toAppendConstant += formatter(params[i]);
    });

    bytes += toAppendConstant + toAppendArrayContent;

    return bytes;
};

/**
 * This method should be called to predict the length of dynamic type
 *
 * @method dynamicBytesLength
 * @param {String} type
 * @returns {Number} length of dynamic type, 0 or multiplication of ETH_PADDING (32)
 */
var dynamicBytesLength = function (type) {
    if (isArrayType(type) || type === 'bytes')
        return c.ETH_PADDING * 2;
    return 0;
};

var outputTypes = types.outputTypes();

/** 
 * Formats output bytes back to param list
 *
 * @method formatOutput
 * @param {Array} abi outputs of method
 * @param {String} bytes represention of output
 * @returns {Array} output params
 */
var formatOutput = function (outs, output) {

    output = output.slice(2);
    var result = [];
    var padding = c.ETH_PADDING * 2;

    var dynamicPartLength = outs.reduce(function (acc, curr) {
        return acc + dynamicBytesLength(curr.type);
    }, 0);

    var dynamicPart = output.slice(0, dynamicPartLength);
    output = output.slice(dynamicPartLength);

    outs.forEach(function (out, i) {
        /*jshint maxcomplexity:6 */
        var typeMatch = false;
        for (var j = 0; j < outputTypes.length && !typeMatch; j++) {
            typeMatch = outputTypes[j].type(outs[i].type);
        }

        if (!typeMatch) {
            throwTypeError(outs[i].type);
        }

        var formatter = outputTypes[j - 1].format;
        if (isArrayType(outs[i].type)) {
            var size = f.formatOutputUInt(dynamicPart.slice(0, padding));
            dynamicPart = dynamicPart.slice(padding);
            var array = [];
            for (var k = 0; k < size; k++) {
                array.push(formatter(output.slice(0, padding)));
                output = output.slice(padding);
            }
            result.push(array);
        }
        else if (types.prefixedType('bytes')(outs[i].type)) {
            dynamicPart = dynamicPart.slice(padding);
            result.push(formatter(output.slice(0, padding)));
            output = output.slice(padding);
        } else {
            result.push(formatter(output.slice(0, padding)));
            output = output.slice(padding);
        }
    });

    return result;
};

/**
 * Should be called to create input parser for contract with given abi
 *
 * @method inputParser
 * @param {Array} contract abi
 * @returns {Object} input parser object for given json abi
 * TODO: refactor creating the parser, do not double logic from contract
 */
var inputParser = function (json) {
    var parser = {};
    json.forEach(function (method) {
        var displayName = utils.extractDisplayName(method.name);
        var typeName = utils.extractTypeName(method.name);

        var impl = function () {
            var params = Array.prototype.slice.call(arguments);
            return formatInput(method.inputs, params);
        };

        if (parser[displayName] === undefined) {
            parser[displayName] = impl;
        }

        parser[displayName][typeName] = impl;
    });

    return parser;
};

/**
 * Should be called to create output parser for contract with given abi
 *
 * @method outputParser
 * @param {Array} contract abi
 * @returns {Object} output parser for given json abi
 */
var outputParser = function (json) {
    var parser = {};
    json.forEach(function (method) {

        var displayName = utils.extractDisplayName(method.name);
        var typeName = utils.extractTypeName(method.name);

        var impl = function (output) {
            return formatOutput(method.outputs, output);
        };

        if (parser[displayName] === undefined) {
            parser[displayName] = impl;
        }

        parser[displayName][typeName] = impl;
    });

    return parser;
};

module.exports = {
    inputParser: inputParser,
    outputParser: outputParser,
    formatInput: formatInput,
    formatOutput: formatOutput
};

},{"../utils/config":5,"../utils/utils":6,"./formatters":2,"./types":3}],2:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file formatters.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var BigNumber = require('bignumber.js');
var utils = require('../utils/utils');
var c = require('../utils/config');

/**
 * Should be called to pad string to expected length
 *
 * @method padLeft
 * @param {String} string to be padded
 * @param {Number} characters that result string should have
 * @param {String} sign, by default 0
 * @returns {String} right aligned string
 */
var padLeft = function (string, chars, sign) {
    return new Array(chars - string.length + 1).join(sign ? sign : "0") + string;
};

/**
 * Formats input value to byte representation of int
 * If value is negative, return it's two's complement
 * If the value is floating point, round it down
 *
 * @method formatInputInt
 * @param {String|Number|BigNumber} value that needs to be formatted
 * @returns {String} right-aligned byte representation of int
 */
var formatInputInt = function (value) {
    var padding = c.ETH_PADDING * 2;
    BigNumber.config(c.ETH_BIGNUMBER_ROUNDING_MODE);
    return padLeft(utils.toTwosComplement(value).round().toString(16), padding);
};

/**
 * Formats input value to byte representation of string
 *
 * @method formatInputString
 * @param {String}
 * @returns {String} left-algined byte representation of string
 */
var formatInputString = function (value) {
    return utils.fromAscii(value, c.ETH_PADDING).substr(2);
};

/**
 * Formats input value to byte representation of bool
 *
 * @method formatInputBool
 * @param {Boolean}
 * @returns {String} right-aligned byte representation bool
 */
var formatInputBool = function (value) {
    return '000000000000000000000000000000000000000000000000000000000000000' + (value ?  '1' : '0');
};

/**
 * Formats input value to byte representation of real
 * Values are multiplied by 2^m and encoded as integers
 *
 * @method formatInputReal
 * @param {String|Number|BigNumber}
 * @returns {String} byte representation of real
 */
var formatInputReal = function (value) {
    return formatInputInt(new BigNumber(value).times(new BigNumber(2).pow(128))); 
};

/**
 * Check if input value is negative
 *
 * @method signedIsNegative
 * @param {String} value is hex format
 * @returns {Boolean} true if it is negative, otherwise false
 */
var signedIsNegative = function (value) {
    return (new BigNumber(value.substr(0, 1), 16).toString(2).substr(0, 1)) === '1';
};

/**
 * Formats right-aligned output bytes to int
 *
 * @method formatOutputInt
 * @param {String} bytes
 * @returns {BigNumber} right-aligned output bytes formatted to big number
 */
var formatOutputInt = function (value) {

    value = value || "0";

    // check if it's negative number
    // it it is, return two's complement
    if (signedIsNegative(value)) {
        return new BigNumber(value, 16).minus(new BigNumber('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16)).minus(1);
    }
    return new BigNumber(value, 16);
};

/**
 * Formats right-aligned output bytes to uint
 *
 * @method formatOutputUInt
 * @param {String} bytes
 * @returns {BigNumeber} right-aligned output bytes formatted to uint
 */
var formatOutputUInt = function (value) {
    value = value || "0";
    return new BigNumber(value, 16);
};

/**
 * Formats right-aligned output bytes to real
 *
 * @method formatOutputReal
 * @param {String}
 * @returns {BigNumber} input bytes formatted to real
 */
var formatOutputReal = function (value) {
    return formatOutputInt(value).dividedBy(new BigNumber(2).pow(128)); 
};

/**
 * Formats right-aligned output bytes to ureal
 *
 * @method formatOutputUReal
 * @param {String}
 * @returns {BigNumber} input bytes formatted to ureal
 */
var formatOutputUReal = function (value) {
    return formatOutputUInt(value).dividedBy(new BigNumber(2).pow(128)); 
};

/**
 * Should be used to format output hash
 *
 * @method formatOutputHash
 * @param {String}
 * @returns {String} right-aligned output bytes formatted to hex
 */
var formatOutputHash = function (value) {
    return "0x" + value;
};

/**
 * Should be used to format output bool
 *
 * @method formatOutputBool
 * @param {String}
 * @returns {Boolean} right-aligned input bytes formatted to bool
 */
var formatOutputBool = function (value) {
    return value === '0000000000000000000000000000000000000000000000000000000000000001' ? true : false;
};

/**
 * Should be used to format output string
 *
 * @method formatOutputString
 * @param {Sttring} left-aligned hex representation of string
 * @returns {String} ascii string
 */
var formatOutputString = function (value) {
    return utils.toAscii(value);
};

/**
 * Should be used to format output address
 *
 * @method formatOutputAddress
 * @param {String} right-aligned input bytes
 * @returns {String} address
 */
var formatOutputAddress = function (value) {
    return "0x" + value.slice(value.length - 40, value.length);
};

module.exports = {
    formatInputInt: formatInputInt,
    formatInputString: formatInputString,
    formatInputBool: formatInputBool,
    formatInputReal: formatInputReal,
    formatOutputInt: formatOutputInt,
    formatOutputUInt: formatOutputUInt,
    formatOutputReal: formatOutputReal,
    formatOutputUReal: formatOutputUReal,
    formatOutputHash: formatOutputHash,
    formatOutputBool: formatOutputBool,
    formatOutputString: formatOutputString,
    formatOutputAddress: formatOutputAddress
};


},{"../utils/config":5,"../utils/utils":6,"bignumber.js":"bignumber.js"}],3:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file types.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var f = require('./formatters');

/// @param expected type prefix (string)
/// @returns function which checks if type has matching prefix. if yes, returns true, otherwise false
var prefixedType = function (prefix) {
    return function (type) {
        return type.indexOf(prefix) === 0;
    };
};

/// @param expected type name (string)
/// @returns function which checks if type is matching expected one. if yes, returns true, otherwise false
var namedType = function (name) {
    return function (type) {
        return name === type;
    };
};

/// Setups input formatters for solidity types
/// @returns an array of input formatters 
var inputTypes = function () {
    
    return [
        { type: prefixedType('uint'), format: f.formatInputInt },
        { type: prefixedType('int'), format: f.formatInputInt },
        { type: prefixedType('bytes'), format: f.formatInputString }, 
        { type: prefixedType('real'), format: f.formatInputReal },
        { type: prefixedType('ureal'), format: f.formatInputReal },
        { type: namedType('address'), format: f.formatInputInt },
        { type: namedType('bool'), format: f.formatInputBool }
    ];
};

/// Setups output formaters for solidity types
/// @returns an array of output formatters
var outputTypes = function () {

    return [
        { type: prefixedType('uint'), format: f.formatOutputUInt },
        { type: prefixedType('int'), format: f.formatOutputInt },
        { type: prefixedType('bytes'), format: f.formatOutputString },
        { type: prefixedType('real'), format: f.formatOutputReal },
        { type: prefixedType('ureal'), format: f.formatOutputUReal },
        { type: namedType('address'), format: f.formatOutputAddress },
        { type: namedType('bool'), format: f.formatOutputBool }
    ];
};

module.exports = {
    prefixedType: prefixedType,
    namedType: namedType,
    inputTypes: inputTypes,
    outputTypes: outputTypes
};


},{"./formatters":2}],4:[function(require,module,exports){
'use strict';

exports.XMLHttpRequest = window.XMLHttpRequest;

},{}],5:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file config.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

/**
 * Utils
 * 
 * @module utils
 */

/**
 * Utility functions
 * 
 * @class [utils] config
 * @constructor
 */

/// required to define ETH_BIGNUMBER_ROUNDING_MODE
var BigNumber = require('bignumber.js');

var ETH_UNITS = [ 
    'wei', 
    'Kwei', 
    'Mwei', 
    'Gwei', 
    'szabo', 
    'finney', 
    'ether', 
    'grand', 
    'Mether', 
    'Gether', 
    'Tether', 
    'Pether', 
    'Eether', 
    'Zether', 
    'Yether', 
    'Nether', 
    'Dether', 
    'Vether', 
    'Uether' 
];

module.exports = {
    ETH_PADDING: 32,
    ETH_SIGNATURE_LENGTH: 4,
    ETH_UNITS: ETH_UNITS,
    ETH_BIGNUMBER_ROUNDING_MODE: { ROUNDING_MODE: BigNumber.ROUND_DOWN },
    ETH_POLLING_TIMEOUT: 1000,
    ETH_DEFAULTBLOCK: 'latest'
};


},{"bignumber.js":"bignumber.js"}],6:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file utils.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

/**
 * Utils
 * 
 * @module utils
 */

/**
 * Utility functions
 * 
 * @class [utils] utils
 * @constructor
 */

var BigNumber = require('bignumber.js');

var unitMap = {
    'wei':      '1',
    'kwei':     '1000',
    'ada':      '1000',
    'mwei':     '1000000',
    'babbage':  '1000000',
    'gwei':     '1000000000',
    'shannon':  '1000000000',
    'szabo':    '1000000000000',
    'finney':   '1000000000000000',
    'ether':    '1000000000000000000',
    'kether':   '1000000000000000000000',
    'grand':    '1000000000000000000000',
    'einstein': '1000000000000000000000',
    'mether':   '1000000000000000000000000',
    'gether':   '1000000000000000000000000000',
    'tether':   '1000000000000000000000000000000'
};


/** Finds first index of array element matching pattern
 *
 * @method findIndex
 * @param {Array}
 * @param {Function} pattern
 * @returns {Number} index of element
 */
var findIndex = function (array, callback) {
    var end = false;
    var i = 0;
    for (; i < array.length && !end; i++) {
        end = callback(array[i]);
    }
    return end ? i - 1 : -1;
};

/** 
 * Should be called to get sting from it's hex representation
 *
 * @method toAscii
 * @param {String} string in hex
 * @returns {String} ascii string representation of hex value
 */
var toAscii = function(hex) {
// Find termination
    var str = "";
    var i = 0, l = hex.length;
    if (hex.substring(0, 2) === '0x') {
        i = 2;
    }
    for (; i < l; i+=2) {
        var code = parseInt(hex.substr(i, 2), 16);
        if (code === 0) {
            break;
        }

        str += String.fromCharCode(code);
    }

    return str;
};
    
/**
 * Shold be called to get hex representation (prefixed by 0x) of ascii string 
 *
 * @method fromAscii
 * @param {String} string
 * @returns {String} hex representation of input string
 */
var toHexNative = function(str) {
    var hex = "";
    for(var i = 0; i < str.length; i++) {
        var n = str.charCodeAt(i).toString(16);
        hex += n.length < 2 ? '0' + n : n;
    }

    return hex;
};

/**
 * Shold be called to get hex representation (prefixed by 0x) of ascii string 
 *
 * @method fromAscii
 * @param {String} string
 * @param {Number} optional padding
 * @returns {String} hex representation of input string
 */
var fromAscii = function(str, pad) {
    pad = pad === undefined ? 0 : pad;
    var hex = toHexNative(str);
    while (hex.length < pad*2)
        hex += "00";
    return "0x" + hex;
};

/**
 * Should be called to get display name of contract function
 * 
 * @method extractDisplayName
 * @param {String} name of function/event
 * @returns {String} display name for function/event eg. multiply(uint256) -> multiply
 */
var extractDisplayName = function (name) {
    var length = name.indexOf('('); 
    return length !== -1 ? name.substr(0, length) : name;
};

/// @returns overloaded part of function/event name
var extractTypeName = function (name) {
    /// TODO: make it invulnerable
    var length = name.indexOf('(');
    return length !== -1 ? name.substr(length + 1, name.length - 1 - (length + 1)).replace(' ', '') : "";
};

/**
 * Filters all functions from input abi
 *
 * @method filterFunctions
 * @param {Array} abi
 * @returns {Array} abi array with filtered objects of type 'function'
 */
var filterFunctions = function (json) {
    return json.filter(function (current) {
        return current.type === 'function'; 
    }); 
};

/**
 * Filters all events from input abi
 *
 * @method filterEvents
 * @param {Array} abi
 * @returns {Array} abi array with filtered objects of type 'event'
 */
var filterEvents = function (json) {
    return json.filter(function (current) {
        return current.type === 'event';
    });
};

/**
 * Converts value to it's decimal representation in string
 *
 * @method toDecimal
 * @param {String|Number|BigNumber}
 * @return {String}
 */
var toDecimal = function (value) {
    return toBigNumber(value).toNumber();
};

/**
 * Converts value to it's hex representation
 *
 * @method fromDecimal
 * @param {String|Number|BigNumber}
 * @return {String}
 */
var fromDecimal = function (value) {
    var number = toBigNumber(value);
    var result = number.toString(16);

    return number.lessThan(0) ? '-0x' + result.substr(1) : '0x' + result;
};

/**
 * Auto converts any given value into it's hex representation.
 *
 * And even stringifys objects before.
 *
 * @method toHex
 * @param {String|Number|BigNumber|Object}
 * @return {String}
 */
var toHex = function (val) {
    /*jshint maxcomplexity:7 */

    if(isBoolean(val))
        return val;

    if(isBigNumber(val))
        return fromDecimal(val);

    if(isObject(val))
        return fromAscii(JSON.stringify(val));

    // if its a negative number, pass it through fromDecimal
    if (isString(val)) {
        if (val.indexOf('-0x') === 0)
           return fromDecimal(val);
        else if (!isFinite(val))
            return fromAscii(val);
    }

    return fromDecimal(val);
};

/**
 * Returns value of unit in Wei
 *
 * @method getValueOfUnit
 * @param {String} unit the unit to convert to, default ether
 * @returns {BigNumber} value of the unit (in Wei)
 * @throws error if the unit is not correct:w
 */
var getValueOfUnit = function (unit) {
    unit = unit ? unit.toLowerCase() : 'ether';
    var unitValue = unitMap[unit];
    if (unitValue === undefined) {
        throw new Error('This unit doesn\'t exists, please use the one of the following units' + JSON.stringify(unitMap, null, 2));
    }
    return new BigNumber(unitValue, 10);
};

/**
 * Takes a number of wei and converts it to any other ether unit.
 *
 * Possible units are:
 * - kwei/ada
 * - mwei/babbage
 * - gwei/shannon
 * - szabo
 * - finney
 * - ether
 * - kether/grand/einstein
 * - mether
 * - gether
 * - tether
 *
 * @method fromWei
 * @param {Number|String} number can be a number, number string or a HEX of a decimal
 * @param {String} unit the unit to convert to, default ether
 * @return {String|Object} When given a BigNumber object it returns one as well, otherwise a number
*/
var fromWei = function(number, unit) {
    var returnValue = toBigNumber(number).dividedBy(getValueOfUnit(unit));

    return isBigNumber(number) ? returnValue : returnValue.toString(10); 
};

/**
 * Takes a number of a unit and converts it to wei.
 *
 * Possible units are:
 * - kwei/ada
 * - mwei/babbage
 * - gwei/shannon
 * - szabo
 * - finney
 * - ether
 * - kether/grand/einstein
 * - mether
 * - gether
 * - tether
 *
 * @method toWei
 * @param {Number|String|BigNumber} number can be a number, number string or a HEX of a decimal
 * @param {String} unit the unit to convert from, default ether
 * @return {String|Object} When given a BigNumber object it returns one as well, otherwise a number
*/
var toWei = function(number, unit) {
    var returnValue = toBigNumber(number).times(getValueOfUnit(unit));

    return isBigNumber(number) ? returnValue : returnValue.toString(10); 
};

/**
 * Takes an input and transforms it into an bignumber
 *
 * @method toBigNumber
 * @param {Number|String|BigNumber} a number, string, HEX string or BigNumber
 * @return {BigNumber} BigNumber
*/
var toBigNumber = function(number) {
    /*jshint maxcomplexity:5 */
    number = number || 0;
    if (isBigNumber(number))
        return number;

    if (isString(number) && (number.indexOf('0x') === 0 || number.indexOf('-0x') === 0)) {
        return new BigNumber(number.replace('0x',''), 16);
    }
   
    return new BigNumber(number.toString(10), 10);
};

/**
 * Takes and input transforms it into bignumber and if it is negative value, into two's complement
 *
 * @method toTwosComplement
 * @param {Number|String|BigNumber}
 * @return {BigNumber}
 */
var toTwosComplement = function (number) {
    var bigNumber = toBigNumber(number);
    if (bigNumber.lessThan(0)) {
        return new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16).plus(bigNumber).plus(1);
    }
    return bigNumber;
};

/**
 * Checks if the given string has proper length
 *
 * @method isAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
*/
var isAddress = function(address) {
    if (!isString(address)) {
        return false;
    }

    return ((address.indexOf('0x') === 0 && address.length === 42) ||
            (address.indexOf('0x') === -1 && address.length === 40));
};

/**
 * Returns true if object is BigNumber, otherwise false
 *
 * @method isBigNumber
 * @param {Object}
 * @return {Boolean} 
 */
var isBigNumber = function (object) {
    return object instanceof BigNumber ||
        (object && object.constructor && object.constructor.name === 'BigNumber');
};

/**
 * Returns true if object is string, otherwise false
 * 
 * @method isString
 * @param {Object}
 * @return {Boolean}
 */
var isString = function (object) {
    return typeof object === 'string' ||
        (object && object.constructor && object.constructor.name === 'String');
};

/**
 * Returns true if object is function, otherwise false
 *
 * @method isFunction
 * @param {Object}
 * @return {Boolean}
 */
var isFunction = function (object) {
    return typeof object === 'function';
};

/**
 * Returns true if object is Objet, otherwise false
 *
 * @method isObject
 * @param {Object}
 * @return {Boolean}
 */
var isObject = function (object) {
    return typeof object === 'object';
};

/**
 * Returns true if object is boolean, otherwise false
 *
 * @method isBoolean
 * @param {Object}
 * @return {Boolean}
 */
var isBoolean = function (object) {
    return typeof object === 'boolean';
};

/**
 * Returns true if object is array, otherwise false
 *
 * @method isArray
 * @param {Object}
 * @return {Boolean}
 */
var isArray = function (object) {
    return object instanceof Array; 
};

module.exports = {
    findIndex: findIndex,
    toHex: toHex,
    toDecimal: toDecimal,
    fromDecimal: fromDecimal,
    toAscii: toAscii,
    fromAscii: fromAscii,
    extractDisplayName: extractDisplayName,
    extractTypeName: extractTypeName,
    filterFunctions: filterFunctions,
    filterEvents: filterEvents,
    toWei: toWei,
    fromWei: fromWei,
    toBigNumber: toBigNumber,
    toTwosComplement: toTwosComplement,
    isBigNumber: isBigNumber,
    isAddress: isAddress,
    isFunction: isFunction,
    isString: isString,
    isObject: isObject,
    isBoolean: isBoolean,
    isArray: isArray
};


},{"bignumber.js":"bignumber.js"}],7:[function(require,module,exports){
module.exports={
    "version": "0.1.3"
}
},{}],8:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file web3.js
 * @authors:
 *   Jeffrey Wilcke <jeff@ethdev.com>
 *   Marek Kotewicz <marek@ethdev.com>
 *   Marian Oancea <marian@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 *   Gav Wood <g@ethdev.com>
 * @date 2014
 */

var version = require('./version.json');
var net = require('./web3/net');
var eth = require('./web3/eth');
var db = require('./web3/db');
var shh = require('./web3/shh');
var watches = require('./web3/watches');
var filter = require('./web3/filter');
var utils = require('./utils/utils');
var formatters = require('./solidity/formatters');
var requestManager = require('./web3/requestmanager');
var c = require('./utils/config');

/// @returns an array of objects describing web3 api methods
var web3Methods = [
    { name: 'sha3', call: 'web3_sha3', inputFormatter: utils.toHex },
];
var web3Properties = [
    { name: 'version.client', getter: 'web3_clientVersion' },
    { name: 'version.network', getter: 'net_version' }
];


/// creates methods in a given object based on method description on input
/// setups api calls for these methods
var setupMethods = function (obj, methods) {
    methods.forEach(function (method) {
        // allow for object methods 'myObject.method'
        var objectMethods = method.name.split('.'),
            callFunction = function () {
                /*jshint maxcomplexity:8 */
                
                var callback = null,
                    args = Array.prototype.slice.call(arguments),
                    call = typeof method.call === 'function' ? method.call(args) : method.call;

                // get the callback if one is available
                if(typeof args[args.length-1] === 'function'){
                    callback = args[args.length-1];
                    Array.prototype.pop.call(args);
                }

                // add the defaultBlock if not given
                if(method.addDefaultblock) {
                    if(args.length !== method.addDefaultblock)
                        Array.prototype.push.call(args, (isFinite(c.ETH_DEFAULTBLOCK) ? utils.fromDecimal(c.ETH_DEFAULTBLOCK) : c.ETH_DEFAULTBLOCK));
                    else
                        args[args.length-1] = isFinite(args[args.length-1]) ? utils.fromDecimal(args[args.length-1]) : args[args.length-1];
                }

                // show deprecated warning
                if(method.newMethod)
                    console.warn('This method is deprecated please use web3.'+ method.newMethod +'() instead.');

                return web3.manager.send({
                    method: call,
                    params: args,
                    outputFormatter: method.outputFormatter,
                    inputFormatter: method.inputFormatter,
                    addDefaultblock: method.addDefaultblock
                }, callback);
            };

        if(objectMethods.length > 1) {
            if(!obj[objectMethods[0]])
                obj[objectMethods[0]] = {};

            obj[objectMethods[0]][objectMethods[1]] = callFunction;
        
        } else {

            obj[objectMethods[0]] = callFunction;
        }

    });
};

/// creates properties in a given object based on properties description on input
/// setups api calls for these properties
var setupProperties = function (obj, properties) {
    properties.forEach(function (property) {
        var objectProperties = property.name.split('.'),
            proto = {};

        proto.get = function () {

            // show deprecated warning
            if(property.newProperty)
                console.warn('This property is deprecated please use web3.'+ property.newProperty +' instead.');


            return web3.manager.send({
                method: property.getter,
                outputFormatter: property.outputFormatter
            });
        };

        if (property.setter) {
            proto.set = function (val) {

                // show deprecated warning
                if(property.newProperty)
                    console.warn('This property is deprecated please use web3.'+ property.newProperty +' instead.');

                return web3.manager.send({
                    method: property.setter,
                    params: [val],
                    inputFormatter: property.inputFormatter
                });
            };
        }

        proto.enumerable = !property.newProperty;

        if(objectProperties.length > 1) {
            if(!obj[objectProperties[0]])
                obj[objectProperties[0]] = {};

            Object.defineProperty(obj[objectProperties[0]], objectProperties[1], proto);        
        } else
            Object.defineProperty(obj, property.name, proto);

    });
};

/*jshint maxparams:4 */
var startPolling = function (method, id, callback, uninstall) {
    web3.manager.startPolling({
        method: method, 
        params: [id]
    }, id,  callback, uninstall); 
};
/*jshint maxparams:3 */

var stopPolling = function (id) {
    web3.manager.stopPolling(id);
};

var ethWatch = {
    startPolling: startPolling.bind(null, 'eth_getFilterChanges'), 
    stopPolling: stopPolling
};

var shhWatch = {
    startPolling: startPolling.bind(null, 'shh_getFilterChanges'), 
    stopPolling: stopPolling
};

/// setups web3 object, and it's in-browser executed methods
var web3 = {

    version: {
        api: version.version
    },

    manager: requestManager(),
    providers: {},

    setProvider: function (provider) {
        web3.manager.setProvider(provider);
    },
    
    /// Should be called to reset state of web3 object
    /// Resets everything except manager
    reset: function () {
        web3.manager.reset(); 
    },

    /// @returns hex string of the input
    toHex: utils.toHex,

    /// @returns ascii string representation of hex value prefixed with 0x
    toAscii: utils.toAscii,

    /// @returns hex representation (prefixed by 0x) of ascii string
    fromAscii: utils.fromAscii,

    /// @returns decimal representaton of hex value prefixed by 0x
    toDecimal: utils.toDecimal,

    /// @returns hex representation (prefixed by 0x) of decimal value
    fromDecimal: utils.fromDecimal,

    /// @returns a BigNumber object
    toBigNumber: utils.toBigNumber,

    toWei: utils.toWei,
    fromWei: utils.fromWei,
    isAddress: utils.isAddress,

    // provide network information
    net: {
        // peerCount: 
    },


    /// eth object prototype
    eth: {
        // DEPRECATED
        contractFromAbi: function (abi) {
            console.warn('Initiating a contract like this is deprecated please use var MyContract = eth.contract(abi); new MyContract(address); instead.');

            return function(addr) {
                // Default to address of Config. TODO: rremove prior to genesis.
                addr = addr || '0xc6d9d2cd449a754c494264e1809c50e34d64562b';
                var ret = web3.eth.contract(addr, abi);
                ret.address = addr;
                return ret;
            };
        },

        /// @param filter may be a string, object or event
        /// @param eventParams is optional, this is an object with optional event eventParams params
        /// @param options is optional, this is an object with optional event options ('max'...)
        /*jshint maxparams:4 */
        filter: function (fil, eventParams, options) {

            // if its event, treat it differently
            if (fil._isEvent)
                return fil(eventParams, options);

            return filter(fil, ethWatch, formatters.outputLogFormatter);
        },
        // DEPRECATED
        watch: function (fil, eventParams, options) {
            console.warn('eth.watch() is deprecated please use eth.filter() instead.');
            return this.filter(fil, eventParams, options);
        }
        /*jshint maxparams:3 */
    },

    /// db object prototype
    db: {},

    /// shh object prototype
    shh: {
        /// @param filter may be a string, object or event
        filter: function (fil) {
            return filter(fil, shhWatch, formatters.outputPostFormatter);
        },
        // DEPRECATED
        watch: function (fil) {
            console.warn('shh.watch() is deprecated please use shh.filter() instead.');
            return this.filter(fil);
        }
    }
};


// ADD defaultblock
Object.defineProperty(web3.eth, 'defaultBlock', {
    get: function () {
        return c.ETH_DEFAULTBLOCK;
    },
    set: function (val) {
        c.ETH_DEFAULTBLOCK = val;
        return c.ETH_DEFAULTBLOCK;
    }
});


/// setups all api methods
setupMethods(web3, web3Methods);
setupProperties(web3, web3Properties);
setupMethods(web3.net, net.methods);
setupProperties(web3.net, net.properties);
setupMethods(web3.eth, eth.methods);
setupProperties(web3.eth, eth.properties);
setupMethods(web3.db, db.methods());
setupMethods(web3.shh, shh.methods());
setupMethods(ethWatch, watches.eth());
setupMethods(shhWatch, watches.shh());

module.exports = web3;


},{"./solidity/formatters":2,"./utils/config":5,"./utils/utils":6,"./version.json":7,"./web3/db":10,"./web3/eth":11,"./web3/filter":13,"./web3/net":17,"./web3/requestmanager":19,"./web3/shh":20,"./web3/watches":22}],9:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file contract.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2014
 */

var web3 = require('../web3'); 
var abi = require('../solidity/abi');
var utils = require('../utils/utils');
var eventImpl = require('./event');
var signature = require('./signature');

var exportNatspecGlobals = function (vars) {
    // it's used byt natspec.js
    // TODO: figure out better way to solve this
    web3._currentContractAbi = vars.abi;
    web3._currentContractAddress = vars.address;
    web3._currentContractMethodName = vars.method;
    web3._currentContractMethodParams = vars.params;
};

var addFunctionRelatedPropertiesToContract = function (contract) {
    
    contract.call = function (options) {
        contract._isTransaction = false;
        contract._options = options;
        return contract;
    };


    contract.sendTransaction = function (options) {
        contract._isTransaction = true;
        contract._options = options;
        return contract;
    };
    // DEPRECATED
    contract.transact = function (options) {

        console.warn('myContract.transact() is deprecated please use myContract.sendTransaction() instead.');

        return contract.sendTransaction(options);
    };

    contract._options = {};
    ['gas', 'gasPrice', 'value', 'from'].forEach(function(p) {
        contract[p] = function (v) {
            contract._options[p] = v;
            return contract;
        };
    });

};

var addFunctionsToContract = function (contract, desc, address) {
    var inputParser = abi.inputParser(desc);
    var outputParser = abi.outputParser(desc);

    // create contract functions
    utils.filterFunctions(desc).forEach(function (method) {

        var displayName = utils.extractDisplayName(method.name);
        var typeName = utils.extractTypeName(method.name);

        var impl = function () {
            /*jshint maxcomplexity:7 */
            var params = Array.prototype.slice.call(arguments);
            var sign = signature.functionSignatureFromAscii(method.name);
            var parsed = inputParser[displayName][typeName].apply(null, params);

            var options = contract._options || {};
            options.to = address;
            options.data = sign + parsed;
            
            var isTransaction = contract._isTransaction === true || (contract._isTransaction !== false && !method.constant);
            var collapse = options.collapse !== false;
            
            // reset
            contract._options = {};
            contract._isTransaction = null;

            if (isTransaction) {
                
                exportNatspecGlobals({
                    abi: desc,
                    address: address,
                    method: method.name,
                    params: params
                });

                // transactions do not have any output, cause we do not know, when they will be processed
                web3.eth.sendTransaction(options);
                return;
            }
            
            var output = web3.eth.call(options);
            var ret = outputParser[displayName][typeName](output);
            if (collapse)
            {
                if (ret.length === 1)
                    ret = ret[0];
                else if (ret.length === 0)
                    ret = null;
            }
            return ret;
        };

        if (contract[displayName] === undefined) {
            contract[displayName] = impl;
        }

        contract[displayName][typeName] = impl;
    });
};

var addEventRelatedPropertiesToContract = function (contract, desc, address) {
    contract.address = address;
    contract._onWatchEventResult = function (data) {
        var matchingEvent = event.getMatchingEvent(utils.filterEvents(desc));
        var parser = eventImpl.outputParser(matchingEvent);
        return parser(data);
    };
    
    Object.defineProperty(contract, 'topics', {
        get: function() {
            return utils.filterEvents(desc).map(function (e) {
                return signature.eventSignatureFromAscii(e.name);
            });
        }
    });

};

var addEventsToContract = function (contract, desc, address) {
    // create contract events
    utils.filterEvents(desc).forEach(function (e) {

        var impl = function () {
            var params = Array.prototype.slice.call(arguments);
            var sign = signature.eventSignatureFromAscii(e.name);
            var event = eventImpl.inputParser(address, sign, e);
            var o = event.apply(null, params);
            var outputFormatter = function (data) {
                var parser = eventImpl.outputParser(e);
                return parser(data);
            };
            return web3.eth.filter(o, undefined, undefined, outputFormatter);
        };
        
        // this property should be used by eth.filter to check if object is an event
        impl._isEvent = true;

        var displayName = utils.extractDisplayName(e.name);
        var typeName = utils.extractTypeName(e.name);

        if (contract[displayName] === undefined) {
            contract[displayName] = impl;
        }

        contract[displayName][typeName] = impl;

    });
};


/**
 * This method should be called when we want to call / transact some solidity method from javascript
 * it returns an object which has same methods available as solidity contract description
 * usage example: 
 *
 * var abi = [{
 *      name: 'myMethod',
 *      inputs: [{ name: 'a', type: 'string' }],
 *      outputs: [{name: 'd', type: 'string' }]
 * }];  // contract abi
 *
 * var MyContract = web3.eth.contract(abi); // creation of contract prototype
 *
 * var contractInstance = new MyContract('0x0123123121');
 *
 * contractInstance.myMethod('this is test string param for call'); // myMethod call (implicit, default)
 * contractInstance.call().myMethod('this is test string param for call'); // myMethod call (explicit)
 * contractInstance.sendTransaction().myMethod('this is test string param for transact'); // myMethod sendTransaction
 *
 * @param abi - abi json description of the contract, which is being created
 * @returns contract object
 */
var contract = function (abi) {

    // return prototype
    if(abi instanceof Array && arguments.length === 1) {
        return Contract.bind(null, abi);

    // deprecated: auto initiate contract
    } else {

        console.warn('Initiating a contract like this is deprecated please use var MyContract = eth.contract(abi); new MyContract(address); instead.');

        return new Contract(arguments[1], arguments[0]);
    }

};

function Contract(abi, address) {

    // workaround for invalid assumption that method.name is the full anonymous prototype of the method.
    // it's not. it's just the name. the rest of the code assumes it's actually the anonymous
    // prototype, so we make it so as a workaround.
    // TODO: we may not want to modify input params, maybe use copy instead?
    abi.forEach(function (method) {
        if (method.name.indexOf('(') === -1) {
            var displayName = method.name;
            var typeName = method.inputs.map(function(i){return i.type; }).join();
            method.name = displayName + '(' + typeName + ')';
        }
    });

    var result = {};
    addFunctionRelatedPropertiesToContract(result);
    addFunctionsToContract(result, abi, address);
    addEventRelatedPropertiesToContract(result, abi, address);
    addEventsToContract(result, abi, address);

    return result;
}

module.exports = contract;


},{"../solidity/abi":1,"../utils/utils":6,"../web3":8,"./event":12,"./signature":21}],10:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file db.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */


/// @returns an array of objects describing web3.db api methods
var methods = function () {
    return [
    { name: 'putString', call: 'db_putString'},
    { name: 'getString', call: 'db_getString'},
    { name: 'putHex', call: 'db_putHex'},
    { name: 'getHex', call: 'db_getHex'}
    ];
};

module.exports = {
    methods: methods
};

},{}],11:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file eth.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 * @date 2015
 */

/**
 * Web3
 * 
 * @module web3
 */

/**
 * Eth methods and properties
 *
 * An example method object can look as follows:
 *
 *      {
 *      name: 'getBlock',
 *      call: blockCall,
 *      outputFormatter: formatters.outputBlockFormatter,
 *      inputFormatter: [ // can be a formatter funciton or an array of functions. Where each item in the array will be used for one parameter
 *           utils.toHex, // formats paramter 1
 *           function(param){ if(!param) return false; } // formats paramter 2
 *         ]
 *       },
 *
 * @class [web3] eth
 * @constructor
 */


var formatters = require('./formatters');
var utils = require('../utils/utils');


var blockCall = function (args) {
    return (utils.isString(args[0]) && args[0].indexOf('0x') === 0) ? "eth_getBlockByHash" : "eth_getBlockByNumber";
};

var transactionFromBlockCall = function (args) {
    return (utils.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'eth_getTransactionByBlockHashAndIndex' : 'eth_getTransactionByBlockNumberAndIndex';
};

var uncleCall = function (args) {
    return (utils.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'eth_getUncleByBlockHashAndIndex' : 'eth_getUncleByBlockNumberAndIndex';
};

var getBlockTransactionCountCall = function (args) {
    return (utils.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'eth_getBlockTransactionCountByHash' : 'eth_getBlockTransactionCountByNumber';
};

var uncleCountCall = function (args) {
    return (utils.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'eth_getUncleCountByBlockHash' : 'eth_getUncleCountByBlockNumber';
};

/// @returns an array of objects describing web3.eth api methods
var methods = [
    { name: 'getBalance', call: 'eth_getBalance', addDefaultblock: 2,
        outputFormatter: formatters.convertToBigNumber},
    { name: 'getStorage', call: 'eth_getStorage', addDefaultblock: 2},
    { name: 'getStorageAt', call: 'eth_getStorageAt', addDefaultblock: 3,
        inputFormatter: utils.toHex},
    { name: 'getCode', call: 'eth_getCode', addDefaultblock: 2},
    { name: 'getBlock', call: blockCall,
        outputFormatter: formatters.outputBlockFormatter,
        inputFormatter: [utils.toHex, function(param){ return (!param) ? false : true; }]},
    { name: 'getUncle', call: uncleCall,
        outputFormatter: formatters.outputBlockFormatter,
        inputFormatter: [utils.toHex, utils.toHex, function(param){ return (!param) ? false : true; }]},
    { name: 'getCompilers', call: 'eth_getCompilers' },
    { name: 'getBlockTransactionCount', call: getBlockTransactionCountCall,
        outputFormatter: utils.toDecimal,
        inputFormatter: utils.toHex },
    { name: 'getBlockUncleCount', call: uncleCountCall,
        outputFormatter: utils.toDecimal,
        inputFormatter: utils.toHex },
    { name: 'getTransaction', call: 'eth_getTransactionByHash',
        outputFormatter: formatters.outputTransactionFormatter },
    { name: 'getTransactionFromBlock', call: transactionFromBlockCall,
        outputFormatter: formatters.outputTransactionFormatter,
        inputFormatter: utils.toHex },
    { name: 'getTransactionCount', call: 'eth_getTransactionCount', addDefaultblock: 2,
        outputFormatter: utils.toDecimal},
    { name: 'sendTransaction', call: 'eth_sendTransaction',
        inputFormatter: formatters.inputTransactionFormatter },
    { name: 'call', call: 'eth_call', addDefaultblock: 2,
        inputFormatter: formatters.inputCallFormatter },
    { name: 'compile.solidity', call: 'eth_compileSolidity' },
    { name: 'compile.lll', call: 'eth_compileLLL', inputFormatter: utils.toHex },
    { name: 'compile.serpent', call: 'eth_compileSerpent', inputFormatter: utils.toHex },
    { name: 'flush', call: 'eth_flush' },

    // deprecated methods
    { name: 'balanceAt', call: 'eth_balanceAt', newMethod: 'eth.getBalance' },
    { name: 'stateAt', call: 'eth_stateAt', newMethod: 'eth.getStorageAt' },
    { name: 'storageAt', call: 'eth_storageAt', newMethod: 'eth.getStorage' },
    { name: 'countAt', call: 'eth_countAt', newMethod: 'eth.getTransactionCount' },
    { name: 'codeAt', call: 'eth_codeAt', newMethod: 'eth.getCode' },
    { name: 'transact', call: 'eth_transact', newMethod: 'eth.sendTransaction' },
    { name: 'block', call: blockCall, newMethod: 'eth.getBlock' },
    { name: 'transaction', call: transactionFromBlockCall, newMethod: 'eth.getTransaction' },
    { name: 'uncle', call: uncleCall, newMethod: 'eth.getUncle' },
    { name: 'compilers', call: 'eth_compilers', newMethod: 'eth.getCompilers' },
    { name: 'solidity', call: 'eth_solidity', newMethod: 'eth.compile.solidity' },
    { name: 'lll', call: 'eth_lll', newMethod: 'eth.compile.lll' },
    { name: 'serpent', call: 'eth_serpent', newMethod: 'eth.compile.serpent' },
    { name: 'transactionCount', call: getBlockTransactionCountCall, newMethod: 'eth.getBlockTransactionCount' },
    { name: 'uncleCount', call: uncleCountCall, newMethod: 'eth.getBlockUncleCount' },
    { name: 'logs', call: 'eth_logs' }
];

/// @returns an array of objects describing web3.eth api properties
var properties = [
    { name: 'coinbase', getter: 'eth_coinbase'},
    { name: 'mining', getter: 'eth_mining'},
    { name: 'gasPrice', getter: 'eth_gasPrice', outputFormatter: formatters.convertToBigNumber},
    { name: 'accounts', getter: 'eth_accounts' },
    { name: 'blockNumber', getter: 'eth_blockNumber', outputFormatter: utils.toDecimal},

    // deprecated properties
    { name: 'listening', getter: 'net_listening', setter: 'eth_setListening', newProperty: 'net.listening'},
    { name: 'peerCount', getter: 'net_peerCount', newProperty: 'net.peerCount'},
    { name: 'number', getter: 'eth_number', newProperty: 'eth.blockNumber'}
];


module.exports = {
    methods: methods,
    properties: properties
};


},{"../utils/utils":6,"./formatters":14}],12:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file event.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2014
 */

var abi = require('../solidity/abi');
var utils = require('../utils/utils');
var signature = require('./signature');

/// filter inputs array && returns only indexed (or not) inputs
/// @param inputs array
/// @param bool if result should be an array of indexed params on not
/// @returns array of (not?) indexed params
var filterInputs = function (inputs, indexed) {
    return inputs.filter(function (current) {
        return current.indexed === indexed;
    });
};

var inputWithName = function (inputs, name) {
    var index = utils.findIndex(inputs, function (input) {
        return input.name === name;
    });
    
    if (index === -1) {
        console.error('indexed param with name ' + name + ' not found');
        return undefined;
    }
    return inputs[index];
};

var indexedParamsToTopics = function (event, indexed) {
    // sort keys?
    return Object.keys(indexed).map(function (key) {
        var inputs = [inputWithName(filterInputs(event.inputs, true), key)];

        var value = indexed[key];
        if (value instanceof Array) {
            return value.map(function (v) {
                return abi.formatInput(inputs, [v]);
            }); 
        }
        return abi.formatInput(inputs, [value]);
    });
};

var inputParser = function (address, sign, event) {
    
    // valid options are 'earliest', 'latest', 'offset' and 'max', as defined for 'eth.filter'
    return function (indexed, options) {
        var o = options || {};
        o.address = address;
        o.topics = [];
        o.topics.push(sign);
        if (indexed) {
            o.topics = o.topics.concat(indexedParamsToTopics(event, indexed));
        }
        return o;
    };
};

var getArgumentsObject = function (inputs, indexed, notIndexed) {
    var indexedCopy = indexed.slice();
    var notIndexedCopy = notIndexed.slice();
    return inputs.reduce(function (acc, current) {
        var value;
        if (current.indexed)
            value = indexedCopy.splice(0, 1)[0];
        else
            value = notIndexedCopy.splice(0, 1)[0];

        acc[current.name] = value;
        return acc;
    }, {}); 
};
 
var outputParser = function (event) {
    
    return function (output) {
        var result = {
            event: utils.extractDisplayName(event.name),
            number: output.number,
            hash: output.hash,
            args: {}
        };

        output.topics = output.topic; // fallback for go-ethereum
        if (!output.topics) {
            return result;
        }
       
        var indexedOutputs = filterInputs(event.inputs, true);
        var indexedData = "0x" + output.topics.slice(1, output.topics.length).map(function (topics) { return topics.slice(2); }).join("");
        var indexedRes = abi.formatOutput(indexedOutputs, indexedData);

        var notIndexedOutputs = filterInputs(event.inputs, false);
        var notIndexedRes = abi.formatOutput(notIndexedOutputs, output.data);

        result.args = getArgumentsObject(event.inputs, indexedRes, notIndexedRes);

        return result;
    };
};

var getMatchingEvent = function (events, payload) {
    for (var i = 0; i < events.length; i++) {
        var sign = signature.eventSignatureFromAscii(events[i].name); 
        if (sign === payload.topics[0]) {
            return events[i];
        }
    }
    return undefined;
};


module.exports = {
    inputParser: inputParser,
    outputParser: outputParser,
    getMatchingEvent: getMatchingEvent
};


},{"../solidity/abi":1,"../utils/utils":6,"./signature":21}],13:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file filter.js
 * @authors:
 *   Jeffrey Wilcke <jeff@ethdev.com>
 *   Marek Kotewicz <marek@ethdev.com>
 *   Marian Oancea <marian@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 *   Gav Wood <g@ethdev.com>
 * @date 2014
 */

var utils = require('../utils/utils');

/// Should be called to check if filter implementation is valid
/// @returns true if it is, otherwise false
var implementationIsValid = function (i) {
    return !!i && 
        typeof i.newFilter === 'function' && 
        typeof i.getLogs === 'function' && 
        typeof i.uninstallFilter === 'function' &&
        typeof i.startPolling === 'function' &&
        typeof i.stopPolling === 'function';
};

/// This method should be called on options object, to verify deprecated properties && lazy load dynamic ones
/// @param should be string or object
/// @returns options string or object
var getOptions = function (options) {
    /*jshint maxcomplexity:9 */

    if (typeof options === 'string') {
        return options;
    } 

    options = options || {};

    if (options.topic) {
        console.warn('"topic" is deprecated, is "topics" instead');
        options.topics = options.topic;
    }

    if (options.earliest) {
        console.warn('"earliest" is deprecated, is "fromBlock" instead');
        options.fromBlock = options.earliest;
    }

    if (options.latest) {
        console.warn('"latest" is deprecated, is "toBlock" instead');
        options.toBlock = options.latest;
    }

    if (options.skip) {
        console.warn('"skip" is deprecated, is "offset" instead');
        options.offset = options.skip;
    }

    if (options.max) {
        console.warn('"max" is deprecated, is "limit" instead');
        options.limit = options.max;
    }

    // make sure topics, get converted to hex
    if(options.topics instanceof Array) {
        options.topics = options.topics.map(function(topic){
            return utils.toHex(topic);
        });
    }


    // evaluate lazy properties
    return {
        fromBlock: utils.toHex(options.fromBlock),
        toBlock: utils.toHex(options.toBlock),
        limit: utils.toHex(options.limit),
        offset: utils.toHex(options.offset),
        to: options.to,
        address: options.address,
        topics: options.topics
    };
};

/// Should be used when we want to watch something
/// it's using inner polling mechanism and is notified about changes
/// @param options are filter options
/// @param implementation, an abstract polling implementation
/// @param formatter (optional), callback function which formats output before 'real' callback 
var filter = function(options, implementation, formatter) {
    if (!implementationIsValid(implementation)) {
        console.error('filter implemenation is invalid');
        return;
    }

    options = getOptions(options);
    var callbacks = [];
    var filterId = implementation.newFilter(options);

    // call the callbacks
    var onMessages = function (messages) {
        messages.forEach(function (message) {
            message = formatter ? formatter(message) : message;
            callbacks.forEach(function (callback) {
                callback(message);
            });
        });
    };

    implementation.startPolling(filterId, onMessages, implementation.uninstallFilter);

    var watch = function(callback) {
        callbacks.push(callback);
    };

    var stopWatching = function() {
        implementation.stopPolling(filterId);
        implementation.uninstallFilter(filterId);
        callbacks = [];
    };

    var get = function () {
        var results = implementation.getLogs(filterId);

        return utils.isArray(results) ? results.map(function(message){
                return formatter ? formatter(message) : message;
            }) : results;
    };
    
    return {
        watch: watch,
        stopWatching: stopWatching,
        get: get,

        // DEPRECATED methods
        changed:  function(){
            console.warn('watch().changed() is deprecated please use filter().watch() instead.');
            return watch.apply(this, arguments);
        },
        arrived:  function(){
            console.warn('watch().arrived() is deprecated please use filter().watch() instead.');
            return watch.apply(this, arguments);
        },
        happened:  function(){
            console.warn('watch().happened() is deprecated please use filter().watch() instead.');
            return watch.apply(this, arguments);
        },
        uninstall: function(){
            console.warn('watch().uninstall() is deprecated please use filter().stopWatching() instead.');
            return stopWatching.apply(this, arguments);
        },
        messages: function(){
            console.warn('watch().messages() is deprecated please use filter().get() instead.');
            return get.apply(this, arguments);
        },
        logs: function(){
            console.warn('watch().logs() is deprecated please use filter().get() instead.');
            return get.apply(this, arguments);
        }
    };
};

module.exports = filter;


},{"../utils/utils":6}],14:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file formatters.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 * @date 2015
 */

var utils = require('../utils/utils');

/**
 * Should the input to a big number
 *
 * @method convertToBigNumber
 * @param {String|Number|BigNumber}
 * @returns {BigNumber} object
 */
var convertToBigNumber = function (value) {
    return utils.toBigNumber(value);
};

/**
 * Formats the input of a transaction and converts all values to HEX
 *
 * @method inputTransactionFormatter
 * @param {Object} transaction options
 * @returns object
*/
var inputTransactionFormatter = function (options){

    // make code -> data
    if (options.code) {
        options.data = options.code;
        delete options.code;
    }

    ['gasPrice', 'gas', 'value'].forEach(function(key){
        options[key] = utils.fromDecimal(options[key]);
    });

    return options;
};

/**
 * Formats the output of a transaction to its proper values
 * 
 * @method outputTransactionFormatter
 * @param {Object} transaction
 * @returns {Object} transaction
*/
var outputTransactionFormatter = function (tx){
    tx.gas = utils.toDecimal(tx.gas);
    tx.gasPrice = utils.toBigNumber(tx.gasPrice);
    tx.value = utils.toBigNumber(tx.value);
    return tx;
};

/**
 * Formats the input of a call and converts all values to HEX
 *
 * @method inputCallFormatter
 * @param {Object} transaction options
 * @returns object
*/
var inputCallFormatter = function (options){

    // make code -> data
    if (options.code) {
        options.data = options.code;
        delete options.code;
    }

    return options;
};


/**
 * Formats the output of a block to its proper values
 *
 * @method outputBlockFormatter
 * @param {Object} block object 
 * @returns {Object} block object
*/
var outputBlockFormatter = function(block){

    // transform to number
    block.gasLimit = utils.toDecimal(block.gasLimit);
    block.gasUsed = utils.toDecimal(block.gasUsed);
    block.size = utils.toDecimal(block.size);
    block.timestamp = utils.toDecimal(block.timestamp);
    block.number = utils.toDecimal(block.number);

    block.minGasPrice = utils.toBigNumber(block.minGasPrice);
    block.difficulty = utils.toBigNumber(block.difficulty);
    block.totalDifficulty = utils.toBigNumber(block.totalDifficulty);

    if(block.transactions instanceof Array) {
        block.transactions.forEach(function(item){
            if(!utils.isString(item))
                return outputTransactionFormatter(item);
        });
    }

    return block;
};

/**
 * Formats the output of a log
 * 
 * @method outputLogFormatter
 * @param {Object} log object
 * @returns {Object} log
*/
var outputLogFormatter = function(log){
    log.blockNumber = utils.toDecimal(log.blockNumber);
    log.transactionIndex = utils.toDecimal(log.transactionIndex);
    log.logIndex = utils.toDecimal(log.logIndex);

    return log;
};


/**
 * Formats the input of a whisper post and converts all values to HEX
 *
 * @method inputPostFormatter
 * @param {Object} transaction object
 * @returns {Object}
*/
var inputPostFormatter = function(post){

    post.payload = utils.toHex(post.payload);
    post.ttl = utils.fromDecimal(post.ttl);
    post.priority = utils.fromDecimal(post.priority);

    if(!(post.topics instanceof Array))
        post.topics = [post.topics];


    // format the following options
    post.topics = post.topics.map(function(topic){
        return utils.fromAscii(topic);
    });

    return post;
};

/**
 * Formats the output of a received post message
 *
 * @method outputPostFormatter
 * @param {Object}
 * @returns {Object}
 */
var outputPostFormatter = function(post){

    post.expiry = utils.toDecimal(post.expiry);
    post.sent = utils.toDecimal(post.sent);
    post.ttl = utils.toDecimal(post.ttl);
    post.workProved = utils.toDecimal(post.workProved);
    post.payloadRaw = post.payload;
    post.payload = utils.toAscii(post.payload);

    if(post.payload.indexOf('{') === 0 || post.payload.indexOf('[') === 0) {
        try {
            post.payload = JSON.parse(post.payload);
        } catch (e) { }
    }

    // format the following options
    post.topics = post.topics.map(function(topic){
        return utils.toAscii(topic);
    });

    return post;
};

module.exports = {
    convertToBigNumber: convertToBigNumber,
    inputTransactionFormatter: inputTransactionFormatter,
    outputTransactionFormatter: outputTransactionFormatter,
    inputCallFormatter: inputCallFormatter,
    outputBlockFormatter: outputBlockFormatter,
    outputLogFormatter: outputLogFormatter,
    inputPostFormatter: inputPostFormatter,
    outputPostFormatter: outputPostFormatter
};


},{"../utils/utils":6}],15:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file httpprovider.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 *   Marian Oancea <marian@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 * @date 2014
 */

var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest; // jshint ignore:line

var HttpProvider = function (host) {
    this.name  = 'HTTP';
    this.host = host || 'http://localhost:8080';
};

HttpProvider.prototype.send = function (payload, callback) {
    var request = new XMLHttpRequest();

    // ASYNC
    if(typeof callback === 'function') {
        request.onreadystatechange = function() {
            if(request.readyState === 4) {
                var result = '';
                try {
                    result = JSON.parse(request.responseText);
                } catch(error) {
                    result = error;
                }
                callback(result, request.status);
            }
        };

        request.open('POST', this.host, true);
        request.send(JSON.stringify(payload));

    // SYNC
    } else {
        request.open('POST', this.host, false);
        request.send(JSON.stringify(payload));

        // check request.status
        if(request.status !== 200)
            return;
        return JSON.parse(request.responseText);
        
    }
};

module.exports = HttpProvider;


},{"xmlhttprequest":4}],16:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file jsonrpc.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var messageId = 1;

/// Should be called to valid json create payload object
/// @param method of jsonrpc call, required
/// @param params, an array of method params, optional
/// @returns valid jsonrpc payload object
var toPayload = function (method, params) {
    if (!method)
        console.error('jsonrpc method should be specified!');

    return {
        jsonrpc: '2.0',
        method: method,
        params: params || [],
        id: messageId++
    }; 
};

/// Should be called to check if jsonrpc response is valid
/// @returns true if response is valid, otherwise false 
var isValidResponse = function (response) {
    return !!response &&
        !response.error &&
        response.jsonrpc === '2.0' &&
        typeof response.id === 'number' &&
        response.result !== undefined; // only undefined is not valid json object
};

/// Should be called to create batch payload object
/// @param messages, an array of objects with method (required) and params (optional) fields
var toBatchPayload = function (messages) {
    return messages.map(function (message) {
        return toPayload(message.method, message.params);
    }); 
};

module.exports = {
    toPayload: toPayload,
    isValidResponse: isValidResponse,
    toBatchPayload: toBatchPayload
};



},{}],17:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file eth.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var utils = require('../utils/utils');

/// @returns an array of objects describing web3.eth api methods
var methods = [
    // { name: 'getBalance', call: 'eth_balanceAt', outputFormatter: formatters.convertToBigNumber},
];

/// @returns an array of objects describing web3.eth api properties
var properties = [
    { name: 'listening', getter: 'net_listening'},
    { name: 'peerCount', getter: 'net_peerCount', outputFormatter: utils.toDecimal },
];


module.exports = {
    methods: methods,
    properties: properties
};


},{"../utils/utils":6}],18:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file qtsync.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 *   Marian Oancea <marian@ethdev.com>
 * @date 2014
 */

var QtSyncProvider = function () {
};

QtSyncProvider.prototype.send = function (payload) {
    var result = navigator.qt.callMethod(JSON.stringify(payload));
    return JSON.parse(result);
};

module.exports = QtSyncProvider;


},{}],19:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file requestmanager.js
 * @authors:
 *   Jeffrey Wilcke <jeff@ethdev.com>
 *   Marek Kotewicz <marek@ethdev.com>
 *   Marian Oancea <marian@ethdev.com>
 *   Fabian Vogelsteller <fabian@ethdev.com>
 *   Gav Wood <g@ethdev.com>
 * @date 2014
 */

var jsonrpc = require('./jsonrpc');
var c = require('../utils/config');

/**
 * It's responsible for passing messages to providers
 * It's also responsible for polling the ethereum node for incoming messages
 * Default poll timeout is 1 second
 */
var requestManager = function() {
    var polls = [];
    var timeout = null;
    var provider;

    var send = function (data, callback) {
        /*jshint maxcomplexity: 8 */

        // FORMAT BASED ON ONE FORMATTER function
        if(typeof data.inputFormatter === 'function') {
            data.params = Array.prototype.map.call(data.params, function(item, index){
                // format everything besides the defaultblock, which is already formated
                return (!data.addDefaultblock || index+1 < data.addDefaultblock) ? data.inputFormatter(item) : item;
            });

        // FORMAT BASED ON the input FORMATTER ARRAY
        } else if(data.inputFormatter instanceof Array) {
            data.params = Array.prototype.map.call(data.inputFormatter, function(formatter, index){
                // format everything besides the defaultblock, which is already formated
                return (!data.addDefaultblock || index+1 < data.addDefaultblock) ? formatter(data.params[index]) : data.params[index];
            });
        }


        var payload = jsonrpc.toPayload(data.method, data.params);
        
        if (!provider) {
            console.error('provider is not set');
            return null;
        }

        // HTTP ASYNC (only when callback is given, and it a HttpProvidor)
        if(typeof callback === 'function' && provider.name === 'HTTP'){
            provider.send(payload, function(result, status){

                if (!jsonrpc.isValidResponse(result)) {
                    if(typeof result === 'object' && result.error && result.error.message) {
                        console.error(result.error.message);
                        callback(result.error);
                    } else {
                        callback(new Error({
                            status: status,
                            error: result,
                            message: 'Bad Request'
                        }));
                    }
                    return null;
                }

                // format the output
                callback(null, (typeof data.outputFormatter === 'function') ? data.outputFormatter(result.result) : result.result);
            });

        // SYNC
        } else {
            var result = provider.send(payload);

            if (!jsonrpc.isValidResponse(result)) {
                if(typeof result === 'object' && result.error && result.error.message)
                    console.error(result.error.message);
                return null;
            }

            // format the output
            return (typeof data.outputFormatter === 'function') ? data.outputFormatter(result.result) : result.result;
        }
        
    };

    var setProvider = function (p) {
        provider = p;
    };

    /*jshint maxparams:4 */
    var startPolling = function (data, pollId, callback, uninstall) {
        polls.push({data: data, id: pollId, callback: callback, uninstall: uninstall});
    };
    /*jshint maxparams:3 */

    var stopPolling = function (pollId) {
        for (var i = polls.length; i--;) {
            var poll = polls[i];
            if (poll.id === pollId) {
                polls.splice(i, 1);
            }
        }
    };

    var reset = function () {
        polls.forEach(function (poll) {
            poll.uninstall(poll.id); 
        });
        polls = [];

        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        poll();
    };

    var poll = function () {
        polls.forEach(function (data) {
            // send async
            send(data.data, function(error, result){
                if (!(result instanceof Array) || result.length === 0) {
                    return;
                }
                data.callback(result);
            });
        });
        timeout = setTimeout(poll, c.ETH_POLLING_TIMEOUT);
    };
    
    poll();

    return {
        send: send,
        setProvider: setProvider,
        startPolling: startPolling,
        stopPolling: stopPolling,
        reset: reset
    };
};

module.exports = requestManager;


},{"../utils/config":5,"./jsonrpc":16}],20:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file shh.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var formatters = require('./formatters');

/// @returns an array of objects describing web3.shh api methods
var methods = function () {
    return [
    { name: 'post', call: 'shh_post', inputFormatter: formatters.inputPostFormatter },
    { name: 'newIdentity', call: 'shh_newIdentity' },
    { name: 'hasIdentity', call: 'shh_hasIdentity' },
    { name: 'newGroup', call: 'shh_newGroup' },
    { name: 'addToGroup', call: 'shh_addToGroup' },

    // deprecated
    { name: 'haveIdentity', call: 'shh_haveIdentity', newMethod: 'shh.hasIdentity' },
    ];
};

module.exports = {
    methods: methods
};


},{"./formatters":14}],21:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file signature.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

var web3 = require('../web3'); 
var c = require('../utils/config');

/// @param function name for which we want to get signature
/// @returns signature of function with given name
var functionSignatureFromAscii = function (name) {
    return web3.sha3(web3.fromAscii(name)).slice(0, 2 + c.ETH_SIGNATURE_LENGTH * 2);
};

/// @param event name for which we want to get signature
/// @returns signature of event with given name
var eventSignatureFromAscii = function (name) {
    return web3.sha3(web3.fromAscii(name));
};

module.exports = {
    functionSignatureFromAscii: functionSignatureFromAscii,
    eventSignatureFromAscii: eventSignatureFromAscii
};


},{"../utils/config":5,"../web3":8}],22:[function(require,module,exports){
/*
    This file is part of ethereum.js.

    ethereum.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ethereum.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with ethereum.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file watches.js
 * @authors:
 *   Marek Kotewicz <marek@ethdev.com>
 * @date 2015
 */

/// @returns an array of objects describing web3.eth.filter api methods
var eth = function () {
    var newFilter = function (args) {
        return typeof args[0] === 'string' ? 'eth_newBlockFilter' : 'eth_newFilter';
    };

    return [
    { name: 'newFilter', call: newFilter },
    { name: 'uninstallFilter', call: 'eth_uninstallFilter' },
    { name: 'getLogs', call: 'eth_getFilterLogs' }
    ];
};

/// @returns an array of objects describing web3.shh.watch api methods
var shh = function () {
    return [
    { name: 'newFilter', call: 'shh_newFilter' },
    { name: 'uninstallFilter', call: 'shh_uninstallFilter' },
    { name: 'getLogs', call: 'shh_getMessages' }
    ];
};

module.exports = {
    eth: eth,
    shh: shh
};


},{}],"bignumber.js":[function(require,module,exports){
/*! bignumber.js v2.0.0 https://github.com/MikeMcl/bignumber.js/LICENCE */

;(function (global) {
    'use strict';

    /*
      bignumber.js v2.0.0
      A JavaScript library for arbitrary-precision arithmetic.
      https://github.com/MikeMcl/bignumber.js
      Copyright (c) 2014 Michael Mclaughlin <M8ch88l@gmail.com>
      MIT Expat Licence
    */

    /*********************************** DEFAULTS ************************************/

    /*
     * The default values below must be integers within the inclusive ranges stated.
     * Most of these values can be changed at run-time using the BigNumber.config method.
     */

    /*
     * The limit on the value of DECIMAL_PLACES, TO_EXP_NEG, TO_EXP_POS, MIN_EXP,
     * MAX_EXP, and the argument to toExponential, toFixed, toFormat, and toPrecision,
     * beyond which an exception is thrown (if ERRORS is true).
     */
    var MAX = 1E9,                                   // 0 to 1e+9

        // Limit of magnitude of exponent argument to toPower.
        MAX_POWER = 1E6,                             // 1 to 1e+6

        // The maximum number of decimal places for operations involving division.
        DECIMAL_PLACES = 20,                         // 0 to MAX

        /*
         * The rounding mode used when rounding to the above decimal places, and when using
         * toExponential, toFixed, toFormat and toPrecision, and round (default value).
         * UP         0 Away from zero.
         * DOWN       1 Towards zero.
         * CEIL       2 Towards +Infinity.
         * FLOOR      3 Towards -Infinity.
         * HALF_UP    4 Towards nearest neighbour. If equidistant, up.
         * HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
         * HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
         * HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
         * HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
         */
        ROUNDING_MODE = 4,                           // 0 to 8

        // EXPONENTIAL_AT : [TO_EXP_NEG , TO_EXP_POS]

        // The exponent value at and beneath which toString returns exponential notation.
        // Number type: -7
        TO_EXP_NEG = -7,                             // 0 to -MAX

        // The exponent value at and above which toString returns exponential notation.
        // Number type: 21
        TO_EXP_POS = 21,                             // 0 to MAX

        // RANGE : [MIN_EXP, MAX_EXP]

        // The minimum exponent value, beneath which underflow to zero occurs.
        // Number type: -324  (5e-324)
        MIN_EXP = -MAX,                              // -1 to -MAX

        // The maximum exponent value, above which overflow to Infinity occurs.
        // Number type:  308  (1.7976931348623157e+308)
        MAX_EXP = MAX,                               // 1 to MAX

        // Whether BigNumber Errors are ever thrown.
        // CHANGE parseInt to parseFloat if changing ERRORS to false.
        ERRORS = true,                               // true or false
        parse = parseInt,                            // parseInt or parseFloat

        // Format specification for the BigNumber.prototype.toFormat method.
        FORMAT = {
            decimalSeparator: '.',
            groupSeparator: ',',
            groupSize: 3,
            secondaryGroupSize: 0,
            fractionGroupSeparator: '\xA0',              // non-breaking space
            fractionGroupSize: 0
        },

    /***********************************************************************************/

        P = BigNumber.prototype,
        DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_',
        outOfRange,
        id = 0,
        mathfloor = Math.floor,
        isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        trim = String.prototype.trim || function () {return this.replace(/^\s+|\s+$/g, '')},
        BASE = 1e14,
        LOG_BASE = 14,
        SQRT_BASE = 1e7,
        POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13],
        ONE = new BigNumber(1);


    // CONSTRUCTOR


    /*
     * The exported function.
     * Create and return a new instance of a BigNumber object.
     *
     * v {number|string|BigNumber} A numeric value.
     * [b] {number} The base of v. Integer, 2 to 64 inclusive.
     */
    function BigNumber( n, b ) {
        var d, e, i, isNum, str, valid,
            x = this;

        // Enable constructor usage without new.
        if ( !( x instanceof BigNumber ) ) return new BigNumber( n, b );

        // Duplicate.
        if ( n instanceof BigNumber ) {

            if ( b == null ) {
                id = 0;
                x['s'] = n['s'];
                x['e'] = n['e'];
                x['c'] = ( n = n['c'] ) ? n.slice() : n;
                return;
            }
            n += '';
        } else if ( isNum = ( str = typeof n ) == 'number' ) {

            // Fast path for integers.
            if ( b == null && n === ~~n ) {
                x['s'] = 1 / n < 0 ? ( n = -n, -1 ) : 1;
                for ( e = id = 0, i = n; i >= 10; i /= 10, e++ );
                x['e'] = e;
                x['c'] = [n];
                return;
            }

            // Minus zero?
            n = n === 0 && 1 / n < 0 ? '-0' : n + '';
        } else if ( str != 'string' ) {
            n += '';
        }
        str = n;

        if ( b == null && isValid.test(str) ) {

            // Determine sign.
            x['s'] = str.charCodeAt(0) === 45 ? ( str = str.slice(1), -1 ) : 1;

        // Either str is not a valid BigNumber or a base has been specified.
        } else {

            // Enable exponential notation to be used with base 10 argument.
            // Ensure return value is rounded to DECIMAL_PLACES as with other bases.
            if ( b == 10 ) {
                x = new BigNumber(str);
                return rnd( x, DECIMAL_PLACES + x['e'] + 1, ROUNDING_MODE );
            }
            str = trim.call(str).replace( /^\+(?!-)/, '' );
            x['s'] = str.charCodeAt(0) === 45 ? ( str = str.replace( /^-(?!-)/, '' ), -1 ) : 1;

            if ( b != null ) {

                if ( ( b == ~~b || !ERRORS ) && !( outOfRange = !( b >= 2 && b < 65 ) ) ) {
                    d = '[' + DIGITS.slice( 0, b = b | 0 ) + ']+';

                    // Before non-decimal number validity test and base conversion
                    // remove the `.` from e.g. '1.', and replace e.g. '.1' with '0.1'.
                    str = str.replace( /\.$/, '' ).replace( /^\./, '0.' );

                    // Any number in exponential form will fail due to the e+/-.
                    if ( valid = new RegExp( '^' + d + '(?:\\.' + d + ')?$',
                      b < 37 ? 'i' : '' ).test(str) ) {

                        if (isNum) {

                            if ( str.replace( /^0\.0*|\./, '' ).length > 15 ) {

                        // 'new BigNumber() number type has more than 15 significant digits: {n}'
                                ifExceptionsThrow( n, 0 );
                            }

                            // Prevent later check for length on converted number.
                            isNum = !isNum;
                        }
                        str = convertBase( str, 10, b, x['s'] );
                    } else if ( str != 'Infinity' && str != 'NaN' ) {

                        // 'new BigNumber() not a base {b} number: {str}'
                        ifExceptionsThrow( n, 1, b );
                        n = 'NaN';
                    }
                } else {

                    // 'new BigNumber() base not an integer: {b}'
                    // 'new BigNumber() base out of range: {b}'
                    ifExceptionsThrow( b, 2 );

                    // Ignore base.
                    valid = isValid.test(str);
                }
            } else {
                valid = isValid.test(str);
            }

            if ( !valid ) {

                // Infinity/NaN
                x['c'] = x['e'] = null;

                // NaN
                if ( str != 'Infinity' ) {

                    // No exception on NaN.
                    // 'new BigNumber() not a number: {n}'
                    if ( str != 'NaN' ) ifExceptionsThrow( n, 3 );
                    x['s'] = null;
                }
                id = 0;

                return;
            }
        }

        // Decimal point?
        if ( ( e = str.indexOf('.') ) > -1 ) str = str.replace( '.', '' );

        // Exponential form?
        if ( ( i = str.search( /e/i ) ) > 0 ) {

            // Determine exponent.
            if ( e < 0 ) e = i;
            e += +str.slice( i + 1 );
            str = str.substring( 0, i );
        } else if ( e < 0 ) {

            // Integer.
            e = str.length;
        }

        // Determine leading zeros.
        for ( i = 0; str.charCodeAt(i) === 48; i++ );

        // Determine trailing zeros.
        for ( b = str.length; str.charCodeAt(--b) === 48; );
        str = str.slice( i, b + 1 );

        if (str) {
            b = str.length;

            // Disallow numbers with over 15 significant digits if number type.
            // 'new BigNumber() number type has more than 15 significant digits: {n}'
            if ( isNum && b > 15 ) ifExceptionsThrow( n, 0 );
            e = e - i - 1;

             // Overflow?
            if ( e > MAX_EXP ) {

                // Infinity.
                x['c'] = x['e'] = null;

            // Underflow?
            } else if ( e < MIN_EXP ) {

                // Zero.
                x['c'] = [ x['e'] = 0 ];
            } else {
                x['e'] = e;
                x['c'] = [];

                // Transform base

                // e is the base 10 exponent.
                // i is where to slice str to get the first element of the coefficient array.
                i = ( e + 1 ) % LOG_BASE;
                if ( e < 0 ) i += LOG_BASE;

                // b is str.length.
                if ( i < b ) {
                    if (i) x['c'].push( +str.slice( 0, i ) );
                    for ( b -= LOG_BASE; i < b; x['c'].push( +str.slice( i, i += LOG_BASE ) ) );
                    str = str.slice(i);
                    i = LOG_BASE - str.length;
                } else {
                    i -= b;
                }

                for ( ; i--; str += '0' );
                x['c'].push( +str );
            }
        } else {

            // Zero.
            x['c'] = [ x['e'] = 0 ];
        }
        id = 0;
    }


    // CONSTRUCTOR PROPERTIES/METHODS


    BigNumber['ROUND_UP'] = 0;
    BigNumber['ROUND_DOWN'] = 1;
    BigNumber['ROUND_CEIL'] = 2;
    BigNumber['ROUND_FLOOR'] = 3;
    BigNumber['ROUND_HALF_UP'] = 4;
    BigNumber['ROUND_HALF_DOWN'] = 5;
    BigNumber['ROUND_HALF_EVEN'] = 6;
    BigNumber['ROUND_HALF_CEIL'] = 7;
    BigNumber['ROUND_HALF_FLOOR'] = 8;


    /*
     * Configure infrequently-changing library-wide settings.
     *
     * Accept an object or an argument list, with one or many of the following properties or
     * parameters respectively:
     * [ DECIMAL_PLACES [, ROUNDING_MODE [, EXPONENTIAL_AT [, RANGE [, ERRORS [, FORMAT ]]]]]]
     *
     *   DECIMAL_PLACES  {number}  Integer, 0 to MAX inclusive.
     *   ROUNDING_MODE   {number}  Integer, 0 to 8 inclusive.
     *   EXPONENTIAL_AT  {number|number[]}  Integer, -MAX to MAX inclusive or
     *                                      [ integer -MAX to 0 incl., 0 to MAX incl. ].
     *   RANGE           {number|number[]}  Non-zero integer, -MAX to MAX inclusive or
     *                                      [ integer -MAX to -1 incl., integer 1 to MAX incl. ].
     *   ERRORS          {boolean|number}   true, false, 1 or 0.
     *   FORMAT          {object}           See BigNumber.prototype.toFormat.
     *      decimalSeparator       {string}
     *      groupSeparator         {string}
     *      groupSize              {number}
     *      secondaryGroupSize     {number}
     *      fractionGroupSeparator {string}
     *      fractionGroupSize      {number}
     *
     * The validity of the values assigned to the above FORMAT object properties is not checked.
     *
     * E.g.
     * BigNumber.config(20, 4) is equivalent to
     * BigNumber.config({ DECIMAL_PLACES : 20, ROUNDING_MODE : 4 })
     *
     * Ignore properties/parameters set to null or undefined.
     * Return an object with the properties current values.
     */
    BigNumber['config'] = function () {
        var v, p,
            i = 0,
            r = {},
            a = arguments,
            o = a[0],
            c = 'config',
            inRange = function ( n, lo, hi ) {
              return !( ( outOfRange = n < lo || n > hi ) || parse(n) != n && n !== 0 );
            },
            has = o && typeof o == 'object'
              ? function () {if ( o.hasOwnProperty(p) ) return ( v = o[p] ) != null}
              : function () {if ( a.length > i ) return ( v = a[i++] ) != null};

        // [DECIMAL_PLACES] {number} Integer, 0 to MAX inclusive.
        if ( has( p = 'DECIMAL_PLACES' ) ) {

            if ( inRange( v, 0, MAX ) ) {
                DECIMAL_PLACES = v | 0;
            } else {

                // 'config() DECIMAL_PLACES not an integer: {v}'
                // 'config() DECIMAL_PLACES out of range: {v}'
                ifExceptionsThrow( v, p, c );
            }
        }
        r[p] = DECIMAL_PLACES;

        // [ROUNDING_MODE] {number} Integer, 0 to 8 inclusive.
        if ( has( p = 'ROUNDING_MODE' ) ) {

            if ( inRange( v, 0, 8 ) ) {
                ROUNDING_MODE = v | 0;
            } else {

                // 'config() ROUNDING_MODE not an integer: {v}'
                // 'config() ROUNDING_MODE out of range: {v}'
                ifExceptionsThrow( v, p, c );
            }
        }
        r[p] = ROUNDING_MODE;

        // [EXPONENTIAL_AT] {number|number[]}
        // Integer, -MAX to MAX inclusive or [ integer -MAX to 0 inclusive, 0 to MAX inclusive ].
        if ( has( p = 'EXPONENTIAL_AT' ) ) {

            if ( inRange( v, -MAX, MAX ) ) {
                TO_EXP_NEG = -( TO_EXP_POS = ~~( v < 0 ? -v : +v ) );
            } else if ( !outOfRange && v && inRange( v[0], -MAX, 0 ) && inRange( v[1], 0, MAX ) ) {
                TO_EXP_NEG = ~~v[0];
                TO_EXP_POS = ~~v[1];
            } else {

                // 'config() EXPONENTIAL_AT not an integer or not [integer, integer]: {v}'
                // 'config() EXPONENTIAL_AT out of range or not [negative, positive: {v}'
                ifExceptionsThrow( v, p, c, 1 );
            }
        }
        r[p] = [ TO_EXP_NEG, TO_EXP_POS ];

        // [RANGE][ {number|number[]} Non-zero integer, -MAX to MAX inclusive or
        // [ integer -MAX to -1 inclusive, integer 1 to MAX inclusive ].
        if ( has( p = 'RANGE' ) ) {

            if ( inRange( v, -MAX, MAX ) && ~~v ) {
                MIN_EXP = -( MAX_EXP = ~~( v < 0 ? -v : +v ) );
            } else if ( !outOfRange && v && inRange( v[0], -MAX, -1 ) && inRange( v[1], 1, MAX ) ) {
                MIN_EXP = ~~v[0];
                MAX_EXP = ~~v[1];
            } else {

                // 'config() RANGE not a non-zero integer or not [integer, integer]: {v}'
                // 'config() RANGE out of range or not [negative, positive: {v}'
                ifExceptionsThrow( v, p, c, 1, 1 );
            }
        }
        r[p] = [ MIN_EXP, MAX_EXP ];

        // [ERRORS] {boolean|number} true, false, 1 or 0.
        if ( has( p = 'ERRORS' ) ) {

            if ( v === !!v || v === 1 || v === 0 ) {
                outOfRange = id = 0;
                parse = ( ERRORS = !!v ) ? parseInt : parseFloat;
            } else {

                // 'config() ERRORS not a boolean or binary digit: {v}'
                ifExceptionsThrow( v, p, c, 0, 0, 1 );
            }
        }
        r[p] = ERRORS;

        // [FORMAT] {object}
        if ( has( p = 'FORMAT' ) ) {

            if ( typeof v == 'object' ) {
                FORMAT = v;
            } else if (ERRORS) {

                // 'config() FORMAT not an object: {v}'
                r = new Error( c + '() ' + p + ' not an object: ' + v );
                r['name'] = 'BigNumber Error';
                throw r;
            }
        }
        r[p] = FORMAT;

        return r;
    };


    // PRIVATE FUNCTIONS


    /*
     * Strip trailing zeros, calculate base 10 exponent and check against MIN_EXP and MAX_EXP.
     * Called by minus, plus and times.
     */
    function normalise( bn, c, e ) {
        var i = 1,
            j = c.length;

         // Remove trailing zeros.
        for ( ; !c[--j]; c.pop() );

        // Calculate the base 10 exponent. First get the number of digits of c[0].
        for ( j = c[0]; j >= 10; j /= 10, i++ );

        // Overflow?
        if ( ( e = i + e * LOG_BASE - 1 ) > MAX_EXP ) {

            // Infinity.
            bn['c'] = bn['e'] = null;

        // Underflow?
        } else if ( e < MIN_EXP ) {

            // Zero.
            bn['c'] = [ bn['e'] = 0 ];
        } else {
            bn['e'] = e;
            bn['c'] = c;
        }

        return bn;
    }


    /*
     * Returns the coefficient array as a string of base 10 digits.
     */
    function coefficientToString(a) {
        var s, z,
            i = 1,
            j = a.length,
            r = a[0] + '';

        for ( ; i < j; ) {
            s = a[i++] + '';
            z = LOG_BASE - s.length;
            for ( ; z--; s = '0' + s );
            r += s;
        }

        // '0'
        for ( j = r.length; r.charCodeAt(--j) === 48; );

        return r.slice( 0, j + 1 || 1 );
    }


    /*
     * Convert string of baseIn to an array of numbers of baseOut.
     * Eg. convertBase('255', 10, 16) returns [15, 15].
     * Eg. convertBase('ff', 16, 10) returns [2, 5, 5].
     */
    function toBaseOut( str, baseIn, baseOut ) {
        var j,
            arr = [0],
            arrL,
            i = 0,
            strL = str.length;

        for ( ; i < strL; ) {
            for ( arrL = arr.length; arrL--; arr[arrL] *= baseIn );
            arr[ j = 0 ] += DIGITS.indexOf( str.charAt( i++ ) );

            for ( ; j < arr.length; j++ ) {

                if ( arr[j] > baseOut - 1 ) {
                    if ( arr[j + 1] == null ) arr[j + 1] = 0;
                    arr[j + 1] += arr[j] / baseOut | 0;
                    arr[j] %= baseOut;
                }
            }
        }

        return arr.reverse();
    }

    /*
     * Convert a numeric string of baseIn to a numeric string of baseOut.
     */
    function convertBase( str, baseOut, baseIn, sign ) {
        var d, e, j, r, x, xc, y,
            i = str.indexOf( '.' ),
            rm = ROUNDING_MODE;

        if ( baseIn < 37 ) str = str.toLowerCase();

        // Non-integer.
        if ( i >= 0 ) {
            str = str.replace( '.', '' );
            y = new BigNumber(baseIn);
            x = y['pow']( str.length - i );

            // Convert str as if an integer, then restore the fraction part by dividing the result
            // by its base raised to a power. Use toFixed to avoid possible exponential notation.
            y['c'] = toBaseOut( x.toFixed(), 10, baseOut );
            y['e'] = y['c'].length;
        }

        // Convert the number as integer.
        xc = toBaseOut( str, baseIn, baseOut );
        e = j = xc.length;

        // Remove trailing zeros.
        for ( ; xc[--j] == 0; xc.pop() );
        if ( !xc[0] ) return '0';

        if ( i < 0 ) {
            --e;
        } else {
            x['c'] = xc;
            x['e'] = e;
            // sign is needed for correct rounding.
            x['s'] = sign;
            x = div( x, y, DECIMAL_PLACES, rm, baseOut );
            xc = x['c'];
            r = x['r'];
            e = x['e'];
        }
        d = e + DECIMAL_PLACES + 1;

        // The rounding digit, i.e. the digit after the digit that may be rounded up.
        i = xc[d];
        j = baseOut / 2;
        r = r || d < 0 || xc[d + 1] != null;

        r = rm < 4
          ? ( i != null || r ) && ( rm == 0 || rm == ( x['s'] < 0 ? 3 : 2 ) )
          : i > j || i == j &&
            ( rm == 4 || r || rm == 6 && xc[d - 1] & 1 || rm == ( x['s'] < 0 ? 8 : 7 ) );

        if ( d < 1 || !xc[0] ) {
            xc.length = 1;
            j = 0;

            if (r) {

                // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                xc[0] = 1;
                e = -DECIMAL_PLACES;
            } else {

                // Zero.
                e = xc[0] = 0;
            }
        } else {
            xc.length = d;

            if (r) {

                // Rounding up may mean the previous digit has to be rounded up and so on.
                for ( --baseOut; ++xc[--d] > baseOut; ) {
                    xc[d] = 0;

                    if ( !d ) {
                        ++e;
                        xc.unshift(1);
                    }
                }
            }

            // Determine trailing zeros.
            for ( j = xc.length; !xc[--j]; );
        }

        // E.g. [4, 11, 15] becomes 4bf.
        for ( i = 0, str = ''; i <= j; str += DIGITS.charAt( xc[i++] ) );

        // Negative exponent?
        if ( e < 0 ) {

            // Prepend zeros.
            for ( ; ++e; str = '0' + str );
            str = '0.' + str;

        // Positive exponent?
        } else {
            i = str.length;

            // Append zeros.
            if ( ++e > i ) {
                for ( e -= i; e-- ; str += '0' );
            } else if ( e < i ) {
                str = str.slice( 0, e ) + '.' + str.slice(e);
            }
        }

        // No negative numbers: the caller will add the sign.
        return str;
    }


    /*
     * Perform division in the specified base. Called by div and convertBase.
     */
    var div = ( function () {

        // Assumes non-zero x and k.
        function multiply( x, k, base ) {
            var m, temp, xlo, xhi,
                carry = 0,
                i = x.length,
                klo = k % SQRT_BASE,
                khi = k / SQRT_BASE | 0;

            for ( x = x.slice(); i--; ) {
                xlo = x[i] % SQRT_BASE;
                xhi = x[i] / SQRT_BASE | 0;
                m = khi * xlo + xhi * klo;
                temp = klo * xlo + ( ( m % SQRT_BASE ) * SQRT_BASE ) + carry;
                carry = ( temp / base | 0 ) + ( m / SQRT_BASE | 0 ) + khi * xhi;
                x[i] = temp % base;
            }
            if (carry) x.unshift(carry);

            return x;
        }

        function compare( a, b, aL, bL ) {
            var i, cmp;

            if ( aL != bL ) {
                cmp = aL > bL ? 1 : -1;
            } else {

                for ( i = cmp = 0; i < aL; i++ ) {

                    if ( a[i] != b[i] ) {
                        cmp = a[i] > b[i] ? 1 : -1;
                        break;
                    }
                }
            }
            return cmp;
        }

        function subtract( a, b, aL, base ) {
            var i = 0;

            // Subtract b from a.
            for ( ; aL--; ) {
                a[aL] -= i;
                i = a[aL] < b[aL] ? 1 : 0;
                a[aL] = i * base + a[aL] - b[aL];
            }

            // Remove leading zeros.
            for ( ; !a[0] && a.length > 1; a.shift() );
        }

        // x: dividend, y: divisor.
        return function ( x, y, dp, rm, base ) {
            var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0,
                yL, yz,
                s = x['s'] == y['s'] ? 1 : -1,
                xc = x['c'],
                yc = y['c'];

            // Either NaN, Infinity or 0?
            if ( !xc || !xc[0] || !yc || !yc[0] ) {

                return new BigNumber(

                  // Return NaN if either NaN, or both Infinity or 0.
                  !x['s'] || !y['s'] || ( xc ? yc && xc[0] == yc[0] : !yc ) ? NaN :

                    // Return +-0 if x is 0 or y is +-Infinity, or return +-Infinity as y is 0.
                    xc && xc[0] == 0 || !yc ? s * 0 : s / 0
                );
            }

            q = new BigNumber(s);
            qc = q['c'] = [];
            e = x['e'] - y['e'];
            s = dp + e + 1;

            if ( !base ) {
                base = BASE;

                //e = mathfloor( x['e'] / LOG_BASE ) - mathfloor( y['e'] / LOG_BASE );
                e = ( xL = x['e'] / LOG_BASE, i = xL | 0, xL > 0 || xL === i ? i : i - 1 ) -
                    ( yL = y['e'] / LOG_BASE, i = yL | 0, yL > 0 || yL === i ? i : i - 1 );

                s = s / LOG_BASE | 0;
            }

            // Result exponent may be one less then the current value of e.
            // The coefficients of the BigNumbers from convertBase may have trailing zeros.
            for ( i = 0; yc[i] == ( xc[i] || 0 ); i++ );
            if ( yc[i] > ( xc[i] || 0 ) ) e--;

            if ( s < 0 ) {
                qc.push(1);
                more = true;
            } else {
                xL = xc.length;
                yL = yc.length;
                i = 0;
                s += 2;

                /*
                // TODO: fast path division when divisor < base
                if ( yL == 1 ) {
                    n = 0;
                    yc = yc[0];
                    s++;
                    // n is the carry.
                    for ( ; ( i < xL || n ) && s--; i++ ) {
                        // Can't use this, it will overflow 2^53.
                        var t = n * base + ( xc[i] || 0 );
                        qc[i] = mathfloor( t / yc );
                        n = t % yc;
                    }
                    more = n || i < xL;

                // divisor >= base
                } else {
                */
                    // Normalise xc and yc so highest order digit of yc is >= base/2

                    n = mathfloor( base / ( yc[0] + 1 ) );

                    if ( n > 1 ) {
                        yc = multiply( yc, n, base );
                        xc = multiply( xc, n, base );
                        yL = yc.length;
                        xL = xc.length;
                    }

                    xi = yL;
                    rem = xc.slice( 0, yL );
                    remL = rem.length;

                    // Add zeros to make remainder as long as divisor.
                    for ( ; remL < yL; rem[remL++] = 0 );
                    yz = yc.slice();
                    yz.unshift(0);
                    yc0 = yc[0];
                    if ( yc[1] >= base / 2 ) yc0++;

                    do {
                        n = 0;

                        // Compare divisor and remainder.
                        cmp = compare( yc, rem, yL, remL );

                        // If divisor < remainder.
                        if ( cmp < 0 ) {

                            // Calculate trial digit, n.

                            rem0 = rem[0];
                            if ( yL != remL ) rem0 = rem0 * base + ( rem[1] || 0 );

                            // n is how many times the divisor goes into the current remainder.
                            n = mathfloor( rem0 / yc0 );


                            //  Algorithm:
                            //  1. product = divisor * trial digit (n)
                            //  2. if product > remainder: product -= divisor, n--
                            //  3. remainder -= product
                            //  4. if product was < remainder at 2:
                            //    5. compare new remainder and divisor
                            //    6. If remainder > divisor: remainder -= divisor, n++

                            if ( n > 1 ) {
                                if ( n >= base ) n = base - 1;

                                // product = divisor * trial digit.
                                prod = multiply( yc, n, base );
                                prodL = prod.length;
                                remL = rem.length;

                                // Compare product and remainder.
                                cmp = compare( prod, rem, prodL, remL );

                                // product > remainder.
                                if ( cmp == 1 ) {
                                    n--;

                                    // Subtract divisor from product.
                                    subtract( prod, yL < prodL ? yz : yc, prodL, base );
                                }
                            } else {

                                // cmp is -1.
                                // If n is 0, there is no need to compare yc and rem again below,
                                // so change cmp to 1 to avoid it.
                                // If n is 1, compare yc and rem again below.
                                if ( n == 0 ) cmp = n = 1;
                                prod = yc.slice();
                            }

                            prodL = prod.length;
                            if ( prodL < remL ) prod.unshift(0);

                            // Subtract product from remainder.
                            subtract( rem, prod, remL, base );

                            // If product was < previous remainder.
                            if ( cmp == -1 ) {
                                remL = rem.length;

                                // Compare divisor and new remainder.
                                cmp = compare( yc, rem, yL, remL );

                                // If divisor < new remainder, subtract divisor from remainder.
                                if ( cmp < 1 ) {
                                    n++;

                                    // Subtract divisor from remainder.
                                    subtract( rem, yL < remL ? yz : yc, remL, base );
                                }
                            }
                            remL = rem.length;
                        } else if ( cmp === 0 ) {
                            n++;
                            rem = [0];
                        }    // if cmp === 1, n will be 0

                        // Add the next digit, n, to the result array.
                        qc[i++] = n;

                        // Update the remainder.
                        if ( cmp && rem[0] ) {
                            rem[remL++] = xc[xi] || 0;
                        } else {
                            rem = [ xc[xi] ];
                            remL = 1;
                        }
                    } while ( ( xi++ < xL || rem[0] != null ) && s-- );

                    more = rem[0] != null;
                //}

                // Leading zero?
                if ( !qc[0] ) qc.shift();
            }

            if ( base == BASE ) {

                // To calculate q.e, first get the number of digits of qc[0].
                for ( i = 1, s = qc[0]; s >= 10; s /= 10, i++ );
                rnd( q, dp + ( q['e'] = i + e * LOG_BASE - 1 ) + 1, rm, more );

            // div is being used for base conversion.
            } else {
                q['e'] = e;
                q['r'] = +more;
            }
            return q;
        };
    })();


    /*
     * Return a string representing the value of BigNumber n in normal or exponential notation
     * rounded to the specified decimal places or significant digits.
     *
     * Called by toString (k: 1), toExponential (k: 1), toFixed (k: undefined), toPrecision (k: 2).
     * i is the index (with the value in normal notation) of the digit that may be rounded up.
     * d is the number of digits required including fraction-part trailing zeros.
     * z is the number of zeros to be appended.
     */
    function format( n, i, k ) {
        var d, str, z,
            e = ( n = new BigNumber(n) )['e'];

        // i == null when toExponential(no arg), or toString() when x >= toExpPos etc.
        if ( i == null ) {
            d = 0;
        } else {
            rnd( n, ++i, ROUNDING_MODE );

            // n['e'] may have changed if the value was rounded up.
            d = k ? i : i + n['e'] - e;
            e = n['e'];
        }
        str = coefficientToString( n['c'] );

        // toPrecision returns exponential notation if the number of significant digits specified
        // is less than the number of digits necessary to represent the integer part of the value
        // in normal notation.

        // Exponential notation.
        if ( k == 1 || k == 2 && ( i <= e || e <= TO_EXP_NEG ) ) {

            // Append zeros?
            for ( ; str.length < d; str += '0' );
            if ( str.length > 1 ) str = str.charAt(0) + '.' + str.slice(1);
            str += ( e < 0 ? 'e' : 'e+' ) + e;

        // Fixed point notation.
        } else {
            k = str.length;

            // Negative exponent?
            if ( e < 0 ) {
                z = d - k;

                // Prepend zeros.
                for ( ; ++e; str = '0' + str );
                str = '0.' + str;

            // Positive exponent?
            } else {

                if ( ++e > k ) {
                    z = d - e;

                    // Append zeros.
                    for ( e -= k; e-- ; str += '0' );
                    if ( z > 0 ) str += '.';
                } else {
                    z = d - k;

                    if ( e < k ) {
                        str = str.slice( 0, e ) + '.' + str.slice(e);
                    } else if ( z > 0 ) {
                        str += '.';
                    }
                }
            }

            // Append more zeros?
            if ( z > 0 ) for ( ; z--; str += '0' );
        }
        return n['s'] < 0 && n['c'][0] ? '-' + str : str;
    }


    // Assemble error messages. Throw BigNumber Errors.
    function ifExceptionsThrow( arg, i, j, isArray, isRange, isErrors) {

        if (ERRORS) {
            var error,
                method = ['new BigNumber', 'cmp', 'div', 'eq', 'gt', 'gte', 'lt',
                     'lte', 'minus', 'mod', 'plus', 'times', 'toFraction', 'divToInt'
                    ][ id ? id < 0 ? -id : id : 1 / id < 0 ? 1 : 0 ] + '()',
                message = outOfRange ? ' out of range' : ' not a' +
                  ( isRange ? ' non-zero' : 'n' ) + ' integer';

            message = ( [
                method + ' number type has more than 15 significant digits',
                method + ' not a base ' + j + ' number',
                method + ' base' + message,
                method + ' not a number' ][i] ||
                  j + '() ' + i + ( isErrors
                    ? ' not a boolean or binary digit'
                    : message + ( isArray
                      ? ' or not [' + ( outOfRange
                        ? ' negative, positive'
                        : ' integer, integer' ) + ' ]'
                      : '' ) ) ) + ': ' + arg;

            outOfRange = id = 0;
            error = new Error(message);
            error['name'] = 'BigNumber Error';
            throw error;
        }
    }


    /*
     * Round x to sd significant digits using rounding mode rm. Check for over/under-flow.
     */
    function rnd( x, sd, rm, r ) {
        var d, i, j, k, n, ni, rd, xc,
            pows10 = POWS_TEN;

        // if x is not Infinity or NaN...
        if ( xc = x['c'] ) {

            // rd: the rounding digit, i.e. the digit after the digit that may be rounded up
            // n: a base 1e14 number, the value of the element of array x.c containing rd
            // ni: the index of n within x.c
            // d: the number of digits of n
            // i: what would be the index of rd within n if all the numbers were 14 digits long
            // (i.e. they had leading zeros)
            // j: if > 0, the actual index of rd within n (if < 0, rd is a leading zero)
            out: {

                // Get the number of digits of the first element of xc.
                for ( d = 1, k = xc[0]; k >= 10; k /= 10, d++ );
                i = sd - d;

                // If the rounding digit is in the first element of xc...
                if ( i < 0 ) {
                    i += LOG_BASE;
                    j = sd;
                    n = xc[ ni = 0 ];

                    // Get the rounding digit at index j of n.
                    rd = n / pows10[ d - j - 1 ] % 10 | 0;
                } else {
                    ni = Math.ceil( ( i + 1 ) / LOG_BASE );

                    if ( ni >= xc.length ) {

                        if (r) {

                            // Needed by sqrt.
                            for ( ; xc.length <= ni; xc.push(0) );
                            n = rd = 0;
                            d = 1;
                            i %= LOG_BASE;
                            j = i - LOG_BASE + 1;
                        } else {
                            break out;
                        }
                    } else {
                        n = k = xc[ni];

                        // Get the number of digits of n.
                        for ( d = 1; k >= 10; k /= 10, d++ );

                        // Get the index of rd within n.
                        i %= LOG_BASE;

                        // Get the index of rd within n, adjusted for leading zeros.
                        // The number of leading zeros of n is given by LOG_BASE - d.
                        j = i - LOG_BASE + d;

                        // Get the rounding digit at index j of n.
                        rd = j < 0 ? 0 : n / pows10[ d - j - 1 ] % 10 | 0;
                    }
                }

                r = r || sd < 0 ||

                // Are there any non-zero digits after the rounding digit?
                // The expression  n % pows10[ d - j - 1 ]  returns all the digits of n to the right
                // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
                  xc[ni + 1] != null || ( j < 0 ? n : n % pows10[ d - j - 1 ] );

                r = rm < 4
                  ? ( rd || r ) && ( rm == 0 || rm == ( x['s'] < 0 ? 3 : 2 ) )
                  : rd > 5 || rd == 5 && ( rm == 4 || r || rm == 6 &&

                    // Check whether the digit to the left of the rounding digit is odd.
                    ( ( i > 0 ? j > 0 ? n / pows10[ d - j ] : 0 : xc[ni - 1] ) % 10 ) & 1 ||
                      rm == ( x['s'] < 0 ? 8 : 7 ) );

                if ( sd < 1 || !xc[0] ) {
                    xc.length = 0;

                    if (r) {

                        // Convert sd to decimal places.
                        sd -= x['e'] + 1;

                        // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                        xc[0] = pows10[ sd % LOG_BASE ];
                        x['e'] = -sd || 0;
                    } else {

                        // Zero.
                        xc[0] = x['e'] = 0;
                    }

                    return x;
                }

                // Remove excess digits.
                if ( i == 0 ) {
                    xc.length = ni;
                    k = 1;
                    ni--;
                } else {
                    xc.length = ni + 1;
                    k = pows10[ LOG_BASE - i ];

                    // E.g. 56700 becomes 56000 if 7 is the rounding digit.
                    // j > 0 means i > number of leading zeros of n.
                    xc[ni] = j > 0 ? mathfloor( n / pows10[ d - j ] % pows10[j] ) * k : 0;
                }

                // Round up?
                if (r) {

                    for ( ; ; ) {

                        // If the digit to be rounded up is in the first element of xc...
                        if ( ni == 0 ) {

                            // i will be the length of xc[0] before k is added.
                            for ( i = 1, j = xc[0]; j >= 10; j /= 10, i++ );
                            j = xc[0] += k;
                            for ( k = 1; j >= 10; j /= 10, k++ );

                            // if i != k the length has increased.
                            if ( i != k ) {
                                x['e']++;
                                if ( xc[0] == BASE ) xc[0] = 1;
                            }
                            break;
                        } else {
                            xc[ni] += k;
                            if ( xc[ni] != BASE ) break;
                            xc[ni--] = 0;
                            k = 1;
                        }
                    }
                }

                // Remove trailing zeros.
                for ( i = xc.length; xc[--i] === 0; xc.pop() );
            }

            // Overflow? Infinity.
            if ( x['e'] > MAX_EXP ) {
                x['c'] = x['e'] = null;

            // Underflow? Zero.
            } else if ( x['e'] < MIN_EXP ) {
                x['c'] = [ x['e'] = 0 ];
            }
        }

        return x;
    }


    // PROTOTYPE/INSTANCE METHODS


    /*
     * Return a new BigNumber whose value is the absolute value of this BigNumber.
     */
    P['absoluteValue'] = P['abs'] = function () {
        var x = new BigNumber(this);
        if ( x['s'] < 0 ) x['s'] = 1;
        return x;
    };


    /*
     * Return a new BigNumber whose value is the value of this BigNumber rounded to a whole number
     * in the direction of Infinity.
     */
    P['ceil'] = function () {
        return rnd( new BigNumber(this), this['e'] + 1, 2 );
    };


    /*
     * Return
     * 1 if the value of this BigNumber is greater than the value of BigNumber(y, b),
     * -1 if the value of this BigNumber is less than the value of BigNumber(y, b),
     * 0 if they have the same value,
     * or null if the value of either is NaN.
     */
    P['comparedTo'] = P['cmp'] = function ( y, b ) {
        var a,
            x = this,
            xc = x['c'],
            yc = ( id = -id, y = new BigNumber( y, b ) )['c'],
            i = x['s'],
            j = y['s'],
            k = x['e'],
            l = y['e'];

        // Either NaN?
        if ( !i || !j ) return null;

        a = xc && !xc[0];
        b = yc && !yc[0];

        // Either zero?
        if ( a || b ) return a ? b ? 0 : -j : i;

        // Signs differ?
        if ( i != j ) return i;

        a = i < 0;
        b = k == l;

        // Either Infinity?
        if ( !xc || !yc ) return b ? 0 : !xc ^ a ? 1 : -1;

        // Compare exponents.
        if ( !b ) return k > l ^ a ? 1 : -1;
        i = -1;
        j = ( k = xc.length ) < ( l = yc.length ) ? k : l;

        // Compare digit by digit.
        for ( ; ++i < j; ) if ( xc[i] != yc[i] ) return xc[i] > yc[i] ^ a ? 1 : -1;

        // Compare lengths.
        return k == l ? 0 : k > l ^ a ? 1 : -1;
    };


    /*
     * Return the number of decimal places of the value of this BigNumber, or null if the value of
     * this BigNumber is +-Infinity or NaN.
     */
    P['decimalPlaces'] = P['dp'] = function () {
        var n, v,
            c = this['c'];

        if ( !c ) return null;
        n = ( ( v = c.length - 1 ) - mathfloor( this['e'] / LOG_BASE ) ) * LOG_BASE;

        // Subtract the number of trailing zeros of the last number.
        if ( v = c[v] ) for ( ; v % 10 == 0; v /= 10, n-- );
        if ( n < 0 ) n = 0;

        return n;
    };


    /*
     *  n / 0 = I
     *  n / N = N
     *  n / I = 0
     *  0 / n = 0
     *  0 / 0 = N
     *  0 / N = N
     *  0 / I = 0
     *  N / n = N
     *  N / 0 = N
     *  N / N = N
     *  N / I = N
     *  I / n = I
     *  I / 0 = I
     *  I / N = N
     *  I / I = N
     *
     * Return a new BigNumber whose value is the value of this BigNumber divided by the value of
     * BigNumber(y, b), rounded according to DECIMAL_PLACES and ROUNDING_MODE.
     */
    P['dividedBy'] = P['div'] = function ( y, b ) {
        id = 2;
        return div( this, new BigNumber( y, b ), DECIMAL_PLACES, ROUNDING_MODE );
    };


    /*
     * Return a new BigNumber whose value is the integer part of dividing the value of this
     * BigNumber by the value of BigNumber(y, b).
     */
    P['dividedToIntegerBy'] = P['divToInt'] = function ( y, b ) {
        id = 13;
        return div( this, new BigNumber( y, b ), 0, 1 );
    };


    /*
     * Return true if the value of this BigNumber is equal to the value of BigNumber(n, b),
     * otherwise returns false.
     */
    P['equals'] = P['eq'] = function ( n, b ) {
        id = 3;
        return this['cmp']( n, b ) === 0;
    };


    /*
     * Return a new BigNumber whose value is the value of this BigNumber rounded to a whole number
     * in the direction of -Infinity.
     */
    P['floor'] = function () {
        return rnd( new BigNumber(this), this['e'] + 1, 3 );
    };


    /*
     * Return true if the value of this BigNumber is greater than the value of BigNumber(n, b),
     * otherwise returns false.
     */
    P['greaterThan'] = P['gt'] = function ( n, b ) {
        id = 4;
        return this['cmp']( n, b ) > 0;
    };


    /*
     * Return true if the value of this BigNumber is greater than or equal to the value of
     * BigNumber(n, b), otherwise returns false.
     */
    P['greaterThanOrEqualTo'] = P['gte'] = function ( n, b ) {
        id = 5;
        return ( b = this['cmp']( n, b ) ) == 1 || b === 0;
    };


    /*
     * Return true if the value of this BigNumber is a finite number, otherwise returns false.
     */
    P['isFinite'] = function () {
        return !!this['c'];
    };


    /*
     * Return true if the value of this BigNumber is an integer, otherwise return false.
     */
    P['isInteger'] = P['isInt'] = function () {
        return !!this['c'] && mathfloor( this['e'] / LOG_BASE ) > this['c'].length - 2;
    };


    /*
     * Return true if the value of this BigNumber is NaN, otherwise returns false.
     */
    P['isNaN'] = function () {
        return !this['s'];
    };


    /*
     * Return true if the value of this BigNumber is negative, otherwise returns false.
     */
    P['isNegative'] = P['isNeg'] = function () {
        return this['s'] < 0;
    };


    /*
     * Return true if the value of this BigNumber is 0 or -0, otherwise returns false.
     */
    P['isZero'] = function () {
        return !!this['c'] && this['c'][0] == 0;
    };


    /*
     * Return true if the value of this BigNumber is less than the value of BigNumber(n, b),
     * otherwise returns false.
     */
    P['lessThan'] = P['lt'] = function ( n, b ) {
        id = 6;
        return this['cmp']( n, b ) < 0;
    };


    /*
     * Return true if the value of this BigNumber is less than or equal to the value of
     * BigNumber(n, b), otherwise returns false.
     */
    P['lessThanOrEqualTo'] = P['lte'] = function ( n, b ) {
        id = 7;
        return ( b = this['cmp']( n, b ) ) == -1 || b === 0;
    };


    /*
     *  n - 0 = n
     *  n - N = N
     *  n - I = -I
     *  0 - n = -n
     *  0 - 0 = 0
     *  0 - N = N
     *  0 - I = -I
     *  N - n = N
     *  N - 0 = N
     *  N - N = N
     *  N - I = N
     *  I - n = I
     *  I - 0 = I
     *  I - N = N
     *  I - I = N
     *
     * Return a new BigNumber whose value is the value of this BigNumber minus the value of
     * BigNumber(y, b).
     */
    P['minus'] = function ( y, b ) {
        var i, j, t, xLTy,
            x = this,
            a = x['s'];

        id = 8;
        y = new BigNumber( y, b );
        b = y['s'];

        // Either NaN?
        if ( !a || !b ) return new BigNumber(NaN);

        // Signs differ?
        if ( a != b ) {
            y['s'] = -b;
            return x['plus'](y);
        }

        var xe = x['e'] / LOG_BASE,
            ye = y['e'] / LOG_BASE,
            xc = x['c'],
            yc = y['c'];

        if ( !xe || !ye ) {

            // Either Infinity?
            if ( !xc || !yc ) return xc ? ( y['s'] = -b, y ) : new BigNumber( yc ? x : NaN );

            // Either zero?
            if ( !xc[0] || !yc[0] ) {

                // Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
                return yc[0] ? ( y['s'] = -b, y ) : new BigNumber( xc[0] ? x :

                  // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
                  ROUNDING_MODE == 3 ? -0 : 0 );
            }
        }

        // Floor xe and ye
        i = xe | 0;
        xe = xe > 0 || xe === i ? i : i - 1;
        i = ye | 0;
        ye = ye > 0 || ye === i ? i : i - 1;
        xc = xc.slice();

        // Determine which is the bigger number.
        if ( a = xe - ye ) {

            if ( xLTy = a < 0 ) {
                a = -a, t = xc;
            } else {
                ye = xe, t = yc;
            }

            // Prepend zeros to equalise exponents.
            for ( t.reverse(), b = a; b--; t.push(0) );
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            j = ( xLTy = ( a = xc.length ) < ( b = yc.length ) ) ? a : b;

            for ( a = b = 0; b < j; b++ ) {

                if ( xc[b] != yc[b] ) {
                    xLTy = xc[b] < yc[b];
                    break;
                }
            }
        }

        // x < y? Point xc to the array of the bigger number.
        if (xLTy) t = xc, xc = yc, yc = t, y['s'] = -y['s'];

        b = ( j = yc.length ) - ( i = xc.length );

        // Append zeros to xc if shorter.
        // No need to add zeros to yc if shorter as subtraction only needs to start at yc.length.
        if ( b > 0 ) for ( ; b--; xc[i++] = 0 );
        b = BASE - 1;

        // Subtract yc from xc.
        for ( ; j > a; ) {

            if ( xc[--j] < yc[j] ) {
                for ( i = j; i && !xc[--i]; xc[i] = b );
                --xc[i];
                xc[j] += BASE;
            }
            xc[j] -= yc[j];
        }

        // Remove leading zeros and adjust exponent accordingly.
        for ( ; xc[0] == 0; xc.shift(), --ye );

        // Zero?
        if ( !xc[0] ) {

            // Following IEEE 754 (2008) 6.3,
            // n - n = +0  but  n - n = -0  when rounding towards -Infinity.
            y['s'] = ROUNDING_MODE == 3 ? -1 : 1;
            y['c'] = [ y['e'] = 0 ];
            return y;
        }

        // No need to check for Infinity as +x - +y != Infinity && -x - -y != Infinity when neither
        // x or y are Infinity.
        return normalise( y, xc, ye );
    };


    /*
     *   n % 0 =  N
     *   n % N =  N
     *   0 % n =  0
     *  -0 % n = -0
     *   0 % 0 =  N
     *   0 % N =  N
     *   N % n =  N
     *   N % 0 =  N
     *   N % N =  N
     *
     * Return a new BigNumber whose value is the value of this BigNumber modulo the value of
     * BigNumber(y, b).
     */
    P['modulo'] = P['mod'] = function ( y, b ) {
        id = 9;
        var x = this,
            xc = x['c'],
            yc = ( y = new BigNumber( y, b ) )['c'],
            xs = x['s'],
            ys = y['s'];

        // x or y NaN? y zero? x zero?
        b = !xs || !ys || yc && !yc[0];
        if ( b || xc && !xc[0] ) return new BigNumber( b ? NaN : x );

        x['s'] = y['s'] = 1;
        b = y['cmp'](x) == 1;
        x['s'] = xs;
        y['s'] = ys;

        return b ? new BigNumber(x) : x['minus']( div( x, y, 0, 1 )['times'](y) );
    };


    /*
     * Return a new BigNumber whose value is the value of this BigNumber negated, i.e. multiplied
     * by -1.
     */
    P['negated'] = P['neg'] = function () {
        var x = new BigNumber(this);
        x['s'] = -x['s'] || null;
        return x;
    };


    /*
     *  n + 0 = n
     *  n + N = N
     *  n + I = I
     *  0 + n = n
     *  0 + 0 = 0
     *  0 + N = N
     *  0 + I = I
     *  N + n = N
     *  N + 0 = N
     *  N + N = N
     *  N + I = N
     *  I + n = I
     *  I + 0 = I
     *  I + N = N
     *  I + I = I
     *
     * Return a new BigNumber whose value is the value of this BigNumber plus the value of
     * BigNumber(y, b).
     */
    P['plus'] = function ( y, b ) {
        var t,
            x = this,
            a = x['s'];

        id = 10;
        y = new BigNumber( y, b );
        b = y['s'];

        // Either NaN?
        if ( !a || !b ) return new BigNumber(NaN);

        // Signs differ?
         if ( a != b ) {
            y['s'] = -b;
            return x['minus'](y);
        }

        var xe = x['e'] / LOG_BASE,
            ye = y['e'] / LOG_BASE,
            xc = x['c'],
            yc = y['c'];

        if ( !xe || !ye ) {

            // Return +-Infinity if either Infinity.
            if ( !xc || !yc ) return new BigNumber( a / 0 );

            // Either zero? Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
            if ( !xc[0] || !yc[0] ) return yc[0] ? y : new BigNumber( xc[0] ? x : a * 0 );
        }

         // Floor xe and ye
        a = xe | 0;
        xe = xe > 0 || xe === a ? a : a - 1;
        a = ye | 0;
        ye = ye > 0 || ye === a ? a : a - 1;
        xc = xc.slice();

        // Prepend zeros to equalise exponents. Faster to use reverse then do unshifts.
        if ( a = xe - ye ) {
            if ( a > 0 ) {
                ye = xe, t = yc;
            } else {
                a = -a, t = xc;
            }

            for ( t.reverse(); a--; t.push(0) );
            t.reverse();
        }
        a = xc.length;
        b = yc.length;

        // Point xc to the longer array, and b to the shorter length.
        if ( a - b < 0 ) t = yc, yc = xc, xc = t, b = a;

        // Only start adding at yc.length - 1 as the further digits of xc can be left as they are.
        for ( a = 0; b; ) {
            a = ( xc[--b] = xc[b] + yc[b] + a ) / BASE | 0;
            xc[b] %= BASE;
        }


        if (a) {
            xc.unshift(a);
            ++ye;
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0
        // ye = MAX_EXP + 1 possible
        return normalise( y, xc, ye );
    };


    /*
     * Return a new BigNumber whose value is the value of this BigNumber rounded to a maximum of dp
     * decimal places using rounding mode rm, or to 0 and ROUNDING_MODE respectively if omitted.
     *
     * [dp] {number} Integer, 0 to MAX inclusive.
     * [rm] {number} Integer, 0 to 8 inclusive.
     */
    P['round'] = function ( dp, rm ) {

        dp = dp == null || ( ( ( outOfRange = dp < 0 || dp > MAX ) || parse(dp) != dp ) &&

          // 'round() decimal places out of range: {dp}'
          // 'round() decimal places not an integer: {dp}'
          !ifExceptionsThrow( dp, 'decimal places', 'round' ) ) ? 0 : dp | 0;

        // Include '&& rm !== 0' because with Opera -0 == parseFloat(-0) is false.
        rm = rm == null || ( ( ( outOfRange = rm < 0 || rm > 8 ) || parse(rm) != rm && rm !== 0 ) &&

          // 'round() mode not an integer: {rm}'
          // 'round() mode out of range: {rm}'
          !ifExceptionsThrow( rm, 'mode', 'round' ) ) ? ROUNDING_MODE : rm | 0;

        return rnd( new BigNumber(this), dp + this['e'] + 1, rm );
    };


    /*
     *  sqrt(-n) =  N
     *  sqrt( N) =  N
     *  sqrt(-I) =  N
     *  sqrt( I) =  I
     *  sqrt( 0) =  0
     *  sqrt(-0) = -0
     *
     * Return a new BigNumber whose value is the square root of the value of this BigNumber,
     * rounded according to DECIMAL_PLACES and ROUNDING_MODE.
     */
    P['squareRoot'] = P['sqrt'] = function () {
        var m, n, r, rep, t,
            x = this,
            c = x['c'],
            s = x['s'],
            e = x['e'],
            dp = DECIMAL_PLACES + 4,
            half = new BigNumber('0.5');

        // Negative/NaN/Infinity/zero?
        if ( s !== 1 || !c || !c[0] ) {
            return new BigNumber( !s || s < 0 && ( !c || c[0] ) ? NaN : c ? x : 1 / 0 );
        }

        // Initial estimate.
        s = Math.sqrt( +x );

        // Math.sqrt underflow/overflow?
        // Pass x to Math.sqrt as integer, then adjust the exponent of the result.
        if ( s == 0 || s == 1 / 0 ) {
            n = coefficientToString(c);
            if ( ( n.length + e ) % 2 == 0 ) n += '0';
            s = Math.sqrt(n);
            e = mathfloor( ( e + 1 ) / 2 ) - ( e < 0 || e % 2 );

            if ( s == 1 / 0 ) {
                n = '1e' + e;
            } else {
                n = s.toExponential();
                n = n.slice( 0, n.indexOf('e') + 1 ) + e;
            }
            r = new BigNumber(n);
        } else {
            r = new BigNumber( s.toString() );
        }

        // Check for zero. r could be zero if MIN_EXP is changed after the this value was created.
        // This would cause a division by zero (x/t) and hence Infinity below, which would cause
        // coefficientToString to throw.
        if ( r['c'][0] ) {
            e = r['e'];
            s = e + dp;
            if ( s < 3 ) s = 0;

            // Newton-Raphson iteration.
            for ( ; ; ) {
                t = r;
                r = half['times']( t['plus']( div( x, t, dp, 1 ) ) );

                if ( coefficientToString( t['c']   ).slice( 0, s ) === ( n =
                     coefficientToString( r['c'] ) ).slice( 0, s ) ) {

                    // The exponent of r may here be one less than the final result exponent,
                    // e.g 0.0009999 (e-4) --> 0.001 (e-3), so adjust s so the rounding digits are
                    // indexed correctly.
                    if ( r['e'] < e ) --s;
                    n = n.slice( s - 3, s + 1 );

                    // The 4th rounding digit may be in error by -1 so if the 4 rounding digits are
                    // 9999 or 4999 (i.e. approaching a rounding boundary) continue the iteration.
                    if ( n == '9999' || !rep && n == '4999' ) {

                        // On the first iteration only, check to see if rounding up gives the exact
                        // result as the nines may infinitely repeat.
                        if ( !rep ) {
                            rnd( t, t['e'] + DECIMAL_PLACES + 2, 0 );

                            if ( t['times'](t)['eq'](x) ) {
                                r = t;
                                break;
                            }
                        }
                        dp += 4;
                        s += 4;
                        rep = 1;
                    } else {

                        // If rounding digits are null, 0{0,4} or 50{0,3}, check for exact result.
                        // If not, then there are further digits and m will be truthy.
                        if ( !+n || !+n.slice(1) && n.charAt(0) == '5' ) {

                            // Truncate to the first rounding digit.
                            rnd( r, r['e'] + DECIMAL_PLACES + 2, 1 );
                            m = !r['times'](r)['eq'](x);
                        }
                        break;
                    }
                }
            }
        }

        return rnd( r, r['e'] + DECIMAL_PLACES + 1, ROUNDING_MODE, m );
    };


    /*
     *  n * 0 = 0
     *  n * N = N
     *  n * I = I
     *  0 * n = 0
     *  0 * 0 = 0
     *  0 * N = N
     *  0 * I = N
     *  N * n = N
     *  N * 0 = N
     *  N * N = N
     *  N * I = N
     *  I * n = I
     *  I * 0 = N
     *  I * N = N
     *  I * I = I
     *
     * Return a new BigNumber whose value is the value of this BigNumber times the value of
     * BigNumber(y, b).
     */
    P['times'] = function ( y, b ) {
        var c, e, k, m, r, xlo, xhi, ylo, yhi,
            x = this,
            xc = x['c'],
            yc = ( id = 11, y = new BigNumber( y, b ) )['c'],
            i = x['e'] / LOG_BASE,
            j = y['e'] / LOG_BASE,
            a = x['s'];

        y['s'] = a == ( b = y['s'] ) ? 1 : -1;

        // Either NaN/Infinity/0?
        if ( !i && ( !xc || !xc[0] ) || !j && ( !yc || !yc[0] ) ) {

            // Return NaN if either NaN, or x is 0 and y is Infinity, or y is 0 and x is Infinity.
            return new BigNumber( !a || !b || xc && !xc[0] && !yc || yc && !yc[0] && !xc ? NaN

              // Return +-Infinity if either is Infinity. Return +-0 if x or y is 0.
              : !xc || !yc ? y['s'] / 0 : y['s'] * 0 );
        }

        // e = mathfloor(i) + mathfloor(j);
        e = ( e = i | 0, i > 0 || i === e ? e : e - 1) +
            ( e = j | 0, j > 0 || j === e ? e : e - 1);

        a = xc.length;
        b = yc.length;

        // Ensure xc points to longer array and b to longer length.
        if ( a < b ) r = xc, xc = yc, yc = r, j = a, a = b, b = j;

        // Initialise the result array with zeros.
        for ( j = a + b, r = []; j--; r.push(0) );

        // Multiply!
        for ( i = b; --i >= 0; ) {
            c = 0;
            j = a + i;
            k = a;
            ylo = yc[i] % SQRT_BASE;
            yhi = yc[i] / SQRT_BASE | 0;

            for ( ; j > i; ) {
                xlo = xc[--k] % SQRT_BASE;
                xhi = xc[k] / SQRT_BASE | 0;
                m = yhi * xlo + xhi * ylo;
                xlo = ylo * xlo + ( ( m % SQRT_BASE ) * SQRT_BASE ) + r[j] + c;
                c = ( xlo / BASE | 0 ) + ( m / SQRT_BASE | 0 ) + yhi * xhi;
                r[j--] = xlo % BASE;
            }
            r[j] = c;
        }

        if (c) {
            ++e;
        } else {
            r.shift();
        }

        return normalise( y, r, e );
    };


    /*
     * Return a string representing the value of this BigNumber in exponential notation to dp fixed
     * decimal places and rounded using ROUNDING_MODE if necessary.
     *
     * [dp] {number} Integer, 0 to MAX inclusive.
     */
    P['toExponential'] = function (dp) {
        var x = this;

        return x['c'] ? format( x, dp == null || ( ( outOfRange = dp < 0 || dp > MAX ) ||

          // Include '&& dp !== 0' because with Opera -0 == parseFloat(-0) is false,
          // despite -0 == parseFloat('-0') && 0 == -0 being true.
          parse(dp) != dp && dp !== 0 ) &&

            // 'toExponential() decimal places not an integer: {dp}'
            // 'toExponential() decimal places out of range: {dp}'
            !ifExceptionsThrow( dp, 'decimal places', 'toExponential' )
              ? null : dp | 0, 1 ) : x.toString();
    };


    /*
     * Return a string representing the value of this BigNumber in normal notation to dp fixed
     * decimal places and rounded using ROUNDING_MODE if necessary.
     *
     * Note: as with JavaScript's number type, (-0).toFixed(0) is '0',
     * but e.g. (-0.00001).toFixed(0) is '-0'.
     *
     * [dp] {number} Integer, 0 to MAX inclusive.
     */
    P['toFixed'] = function (dp) {
        var str,
            x = this,
            neg = TO_EXP_NEG,
            pos = TO_EXP_POS;

        dp = dp == null || ( ( outOfRange = dp < 0 || dp > MAX ) ||

          // 'toFixed() decimal places not an integer: {dp}'
          // 'toFixed() decimal places out of range: {dp}'
          parse(dp) != dp && dp !== 0 ) && !ifExceptionsThrow( dp, 'decimal places', 'toFixed' )
            ? null : x['e'] + ( dp | 0 );

        TO_EXP_NEG = -( TO_EXP_POS = 1 / 0 );

        if ( dp == null || !x['c'] ) {
            str = x.toString();
        } else {
            str = format( x, dp );

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if ( x['s'] < 0 && x['c'] ) {

                // As e.g. (-0).toFixed(3), will wrongly be returned as -0.000 from toString.
                if ( !x['c'][0] ) {
                    str = str.replace( '-', '' );

                // As e.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                } else if ( str.indexOf('-') < 0 ) {
                    str = '-' + str;
                }
            }
        }

        TO_EXP_NEG = neg;
        TO_EXP_POS = pos;

        return str;
    };


    /*
     * Return a string representing the value of this BigNumber in fixed-point notation rounded
     * using ROUNDING_MODE to dp decimal places, and formatted according to the properties of the
     * FORMAT object (see BigNumber.config).
     *
     * FORMAT = {
     *      decimalSeparator : '.',
     *      groupSeparator : ',',
     *      groupSize : 3,
     *      secondaryGroupSize : 0,
     *      fractionGroupSeparator : '\xA0',    // non-breaking space
     *      fractionGroupSize : 0
     * };
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
     * (TODO: If dp is invalid the error message will give toFixed as the offending method.)
     */
    P['toFormat'] = function (dp) {
        var x = this;

        if ( !x['c'] ) return x.toString();

        var i,
            isNeg = x['s'] < 0,
            groupSeparator = FORMAT['groupSeparator'],
            g1 = +FORMAT['groupSize'],
            g2 = +FORMAT['secondaryGroupSize'],
            arr = x.toFixed(dp).split('.'),
            intPart = arr[0],
            fractionPart = arr[1],
            intDigits = isNeg ? intPart.slice(1) : intPart,
            len = intDigits.length;

        if (g2) i = g1, g1 = g2, g2 = i, len -= i;

        if ( g1 > 0 && len > 0 ) {
            i = len % g1 || g1;
            intPart = intDigits.substr( 0, i );
            for ( ; i < len; i += g1 ) intPart += groupSeparator + intDigits.substr( i, g1 );
            if ( g2 > 0 ) intPart += groupSeparator + intDigits.slice(i);
            if (isNeg) intPart = '-' + intPart;
        }

        return fractionPart
          ? intPart + FORMAT['decimalSeparator'] + ( ( g2 = +FORMAT['fractionGroupSize'] )
            ? fractionPart.replace( new RegExp( '\\d{' + g2 + '}\\B', 'g' ),
              '$&' + FORMAT['fractionGroupSeparator'] )
            : fractionPart )
          : intPart;
    };


    /*
     * Return a string array representing the value of this BigNumber as a simple fraction with an
     * integer numerator and an integer denominator. The denominator will be a positive non-zero
     * value less than or equal to the specified maximum denominator. If a maximum denominator is
     * not specified, the denominator will be the lowest value necessary to represent the number
     * exactly.
     *
     * [maxD] {number|string|BigNumber} Integer >= 1 and < Infinity.
     */
    P['toFraction'] = function (maxD) {
        var arr, d0, d2, e, exp, n, n0, q, s,
            n1 = d0 = new BigNumber(ONE),
            d1 = n0 = new BigNumber(ONE),
            x = this,
            xc = x['c'],
            d = new BigNumber(ONE);

        // NaN, Infinity.
        if ( !xc ) return x.toString();
        s = coefficientToString(xc);

        // Initial denominator.
        e = d['e'] = s.length - x['e'] - 1;
        d['c'][0] = POWS_TEN[ ( exp = e % LOG_BASE ) < 0 ? LOG_BASE + exp : exp ];

        // If max denominator is undefined or null, or NaN...
        if ( maxD == null || ( !( id = 12, n = new BigNumber(maxD) )['s'] ||

               // or less than 1, or Infinity...
               ( outOfRange = n['cmp'](n1) < 0 || !n['c'] ) ||

                 // or not an integer...
                 ( ERRORS && mathfloor( n['e'] / LOG_BASE ) < n['c'].length - 1 ) ) &&

                   // 'toFraction() max denominator not an integer: {maxD}'
                   // 'toFraction() max denominator out of range: {maxD}'
                   !ifExceptionsThrow( maxD, 'max denominator', 'toFraction' ) ||

                     // or greater than the max denominator needed to specify the value exactly...
                     ( maxD = n )['cmp'](d) > 0 ) {

            // d is e.g. 10, 100, 1000, 10000... , n1 is 1.
            maxD = e > 0 ? d : n1;
        }

        exp = MAX_EXP;
        MAX_EXP = 1 / 0;
        n = new BigNumber(s);

        // n0 = d1 = 0
        n0['c'][0] = 0;

        for ( ; ; )  {
            q = div( n, d, 0, 1 );
            d2 = d0['plus']( q['times'](d1) );
            if ( d2['cmp'](maxD) == 1 ) break;
            d0 = d1;
            d1 = d2;
            n1 = n0['plus']( q['times']( d2 = n1 ) );
            n0 = d2;
            d = n['minus']( q['times']( d2 = d ) );
            n = d2;
        }

        d2 = div( maxD['minus'](d0), d1, 0, 1 );
        n0 = n0['plus']( d2['times'](n1) );
        d0 = d0['plus']( d2['times'](d1) );
        n0['s'] = n1['s'] = x['s'];
        e *= 2;

        // Determine which fraction is closer to x, n0/d0 or n1/d1
        arr = div( n1, d1, e, ROUNDING_MODE )['minus'](x)['abs']()['cmp'](
              div( n0, d0, e, ROUNDING_MODE )['minus'](x)['abs']() ) < 1
                ? [ n1.toString(), d1.toString() ]
                : [ n0.toString(), d0.toString() ];

        MAX_EXP = exp;

        return arr;
    };


    /*
     * Return the value of this BigNumber converted to a number primitive.
     */
    P['toNumber'] = function () {
        var x = this;

        // Ensure zero has correct sign.
        return +x || ( x['s'] ? 0 * x['s'] : NaN );
    };


    /*
     * Return a BigNumber whose value is the value of this BigNumber raised to the power e.
     * If e is negative round according to DECIMAL_PLACES and ROUNDING_MODE.
     *
     * e {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P['toPower'] = P['pow'] = function (e) {

        // e to integer, avoiding NaN or Infinity becoming 0.
        var i = e * 0 == 0 ? ~~e : e,
            x = new BigNumber(this),
            y = new BigNumber(ONE);

        // Pass +-Infinity for out of range exponents.
        if ( ( ( ( outOfRange = e < -MAX_POWER || e > MAX_POWER ) && (i = e * 1 / 0) ) ||

            // Any exponent that fails the parse becomes NaN.
            // Include 'e !== 0' because on Opera  -0 == parseFloat(-0)  is false, despite
            // -0 === parseFloat(-0) && -0 == parseFloat('-0')  evaluating true.
            parse(e) != e && e !== 0 && !(i = NaN) ) &&

              // 'pow() exponent not an integer: {e}'
              // 'pow() exponent out of range: {e}'
              // Pass zero to Math.pow, as any value to the power zero is 1.
              !ifExceptionsThrow( e, 'exponent', 'pow' ) || !i ) {

            // i is +-Infinity, NaN or 0.
            return new BigNumber( Math.pow( +x, i ) );
        }
        i = i < 0 ? -i : i;

        for ( ; ; ) {
            if ( i & 1 ) y = y['times'](x);
            i >>= 1;
            if ( !i ) break;
            x = x['times'](x);
        }

        return e < 0 ? ONE['div'](y) : y;
    };


    /*
     * Return a string representing the value of this BigNumber to sd significant digits and rounded
     * using ROUNDING_MODE if necessary. If sd is less than the number of digits necessary to
     * represent the integer part of the value in normal notation, then use exponential notation.
     *
     * sd {number} Integer, 1 to MAX inclusive.
     */
    P['toPrecision'] = function (sd) {
        var x = this;

         // ERRORS true: Throw if sd not undefined, null or an integer in range.
         // ERRORS false: Ignore sd if not a number or not in range.
         // Truncate non-integers.
        return sd == null || ( ( ( outOfRange = sd < 1 || sd > MAX ) || parse(sd) != sd ) &&

          // 'toPrecision() precision not an integer: {sd}'
          // 'toPrecision() precision out of range: {sd}'
          !ifExceptionsThrow( sd, 'precision', 'toPrecision' ) ) || !x['c']
            ? x.toString() : format( x, --sd | 0, 2 );
    };


    /*
     * Return a string representing the value of this BigNumber in base b, or base 10 if b is
     * omitted. If a base is specified, including base 10, round according to DECIMAL_PLACES and
     * ROUNDING_MODE. If a base is not specified, and this BigNumber has a positive exponent that is
     * equal to or greater than TO_EXP_POS, or a negative exponent equal to or less than TO_EXP_NEG,
     * return exponential notation.
     *
     * [b] {number} Integer, 2 to 64 inclusive.
     */
    P['toString'] = function (b) {
        var u, str, strL,
            x = this,
            xe = x['e'];

        // Infinity or NaN?
        if ( xe === null ) {
            str = x['s'] ? 'Infinity' : 'NaN';

        // Exponential format?
        } else if ( b == u && ( xe <= TO_EXP_NEG || xe >= TO_EXP_POS ) ) {
            return format( x, u, 1 );
        } else {
            str = coefficientToString( x['c'] );

            // Negative exponent?
            if ( xe < 0 ) {

                // Prepend zeros.
                for ( ; ++xe; str = '0' + str );
                str = '0.' + str;

            // Positive exponent?
            } else if ( strL = str.length, xe > 0 ) {

                // Append zeros.
                if ( ++xe > strL ) {
                    for ( xe -= strL; xe-- ; str += '0' );
                } else if ( xe < strL ) {
                    str = str.slice( 0, xe ) + '.' + str.slice(xe);
                }

            // Exponent zero.
            } else {
                u = str.charAt(0);

                if ( strL > 1 ) {
                    str = u + '.' + str.slice(1);

                // Avoid '-0'
                } else if ( u == '0' ) {
                    return u;
                }
            }

            if ( b != null ) {

                if ( !( outOfRange = !( b >= 2 && b < 65 ) ) && ( b == ~~b || !ERRORS ) ) {
                    str = convertBase( str, b | 0, 10, x['s'] );

                    // Avoid '-0'
                    if ( str == '0' ) return str;
                } else {

                    // 'toString() base not an integer: {b}'
                    // 'toString() base out of range: {b}'
                    ifExceptionsThrow( b, 'base', 'toS' );
                }
            }

        }

        return x['s'] < 0 ? '-' + str : str;
    };


    /*
     * Return as toString, but do not accept a base argument.
     */
    P['valueOf'] = P['toJSON'] = function () {
        return this.toString();
    };


    // Add aliases for BigDecimal methods.
    //P['add'] = P['plus'];
    //P['subtract'] = P['minus'];
    //P['multiply'] = P['times'];
    //P['divide'] = P['div'];
    //P['remainder'] = P['mod'];
    //P['compareTo'] = P['cmp'];
    //P['negate'] = P['neg'];


    // EXPORT


    // Node and other CommonJS-like environments that support module.exports.
    if ( typeof module !== 'undefined' && module.exports ) {
        module.exports = BigNumber;
    //AMD.
    } else if ( typeof define == 'function' && define.amd ) {
        define( function () {return BigNumber} );
    //Browser.
    } else {
        global['BigNumber'] = BigNumber;
    }
})(this);

},{}],"ethereum.js":[function(require,module,exports){
var web3 = require('./lib/web3');
web3.providers.HttpProvider = require('./lib/web3/httpprovider');
web3.providers.QtSyncProvider = require('./lib/web3/qtsync');
web3.eth.contract = require('./lib/web3/contract');
web3.abi = require('./lib/solidity/abi');

module.exports = web3;

},{"./lib/solidity/abi":1,"./lib/web3":8,"./lib/web3/contract":9,"./lib/web3/httpprovider":15,"./lib/web3/qtsync":18}]},{},["ethereum.js"])


//# sourceMappingURL=ethereum.js.map