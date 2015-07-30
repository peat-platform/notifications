/*
 * peat_data_api
 * peat-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq      = require('m2nodehandler');
var helper   = require('./helper.js');
var subsHelp = require('./subscription_helper.js');
var loglet   = require('loglet');
var jwt      = require('jsonwebtoken');

loglet = loglet.child({component: 'notifications'});


var notifApi = function (config) {

   helper.init(config.logger_params);
   subsHelp.init(config);

   console.log('Starting...');

   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink);


   /**
    * Notification Handlers
    * This section handles the internal Notification calls.
    */
   zmq.receiver(config.notif_sink, null, function (msg) {
      if(msg.type !== undefined && msg.type === 'appSubs'){
         subsHelp.createAppSubscriptions(msg);
      }
      else {
         subsHelp.getSubscriptions(msg)
      }
   });


   zmq.receiver(config.mongrel_handler.source, config.mongrel_handler.sink, function (msg) {
      subsHelp.addSSEConnection(msg)
   });


   /**
    * Subscription API Handlers
    * This section handles the API calls for Subscription CRUD operations.
    */
   var subsToMongrel2 = zmq.sender(config.mongrel_handler.sink);
   var senderToObjs   = zmq.sender(config.mongrel_handler.sink);

   zmq.receiver(config.mongrel_handler.subsource, config.mongrel_handler.subsink, function (msg) {

      if ( undefined === msg.headers.authorization ) {
         sendToMongrel2.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json,
            { 'error': 'Missing Auth token: ' });
         return
      }

      var tokenB64 = msg.headers.authorization.replace('Bearer ', '');

      jwt.verify(tokenB64, config.trusted_security_framework_public_key, function (err, token) {

         if ( undefined !== err && null !== err ) {
            sendToMongrel2.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json,
               { 'error': 'Invalid token: ' + err });
         }

         if ( token['peat-token-type'] !== undefined && token['peat-token-type'] !== "session" )
         {
            sendToMongrel2.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json,
               { 'error': 'Invalid token type: "session" Please use correct token type.' });
         }
         if ( token ) {
            msg.token = token;
         }
         subsHelp.evaluateMessage(msg, function (err, results, httpStatusCode) {
            if ( err ) {
               loglet.error(err);
            }
            subsToMongrel2.send(msg.uuid, msg.connId, httpStatusCode, zmq.standard_headers.json, results)
         });

      });

   })
};


module.exports = notifApi;
