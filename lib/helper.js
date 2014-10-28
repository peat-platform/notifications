/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq = require('m2nodehandler');
var dbc = require('dbc');
var openiLogger = require('openi-logger');
var subscriber = require('./subscription_helper.js');
var logger;


var init = function (logger_params) {
   logger = openiLogger(logger_params)
};


var getAction = function (method) {

   method = method.toLowerCase();
   var res = null;

   switch (method) {
   case 'post':
      res = 'PUT';
      break
      case 'put':
      res = 'PUT';
      break
   case 'get':
      res = 'GET';
      break
   }


   return res
};


var getAccess = function (path) {

   var parts = path.split('/');
   var namePos = 3;

   return parts[namePos]
};


var getCloudlet = function (path) {

   var parts = path.split('/');
   var cletPos = 4;
   return parts[cletPos]

}


var getObject = function (path) {

   var parts = path.split('/');
   var namePos = 5;

   return parts[namePos]

};


var checkSubscriptions = function (msg) {
	console.log('Check Subs');
   subscriber.getSubscriptions(msg,null)
};


module.exports.init               = init;
module.exports.getAction          = getAction;
module.exports.getAccess          = getAccess;
module.exports.getCloudlet        = getCloudlet;
module.exports.checkSubscriptions = checkSubscriptions;