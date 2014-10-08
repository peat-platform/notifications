/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq      = require('m2nodehandler')
var helper   = require('./helper.js')
var subsHelp = require('./subscription_helper.js')

var header_json_ACAO = { 'Content-Type' : 'application/json charset=utf-8', 'Access-Control-Allow-Origin' : '*'}

var notifApi = function (config) {

   helper.init(config.logger_params)
   subsHelp.init(config)

   console.log('Starting...')

   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink)
   var sendToComms    = zmq.sender(config.comms.sink)

   /**
    * Notification Handlers
    * This section handles the internal Notification calls.
    */
   zmq.receiver(config.notif_sink, null, function (msg) {

      console.log(msg)
      console.log('\r\n')

      helper.processDAOMessage(msg, function (err) {
        if (err) {
          console.log('helper.js - ##### ERROR #####')
        }
        else {
         console.log('complete')
        }
      })

   })


   zmq.receiver(config.mongrel_handler.source, config.mongrel_handler.sink, function (msg) {
      subsHelp.addSSEConnection(msg)
   })


   /**
    * Subscription API Handlers
    * This section handles the API calls for Subscription CRUD operations.
    */
   var subsToMongrel2 = zmq.sender(config.mongrel_handler.sink)

   zmq.receiver(config.mongrel_handler.subsource, config.mongrel_handler.subsink, function (msg) {

      subsHelp.evaluateMessage(msg, function (err, results, httpStatusCode) {

         var resp           = {};
         var headers        = zmq.header_json;

         resp             = results;

         subsToMongrel2.send(msg.uuid, msg.connId, httpStatusCode, zmq.header_json, resp)
      });
   })
}


module.exports = notifApi