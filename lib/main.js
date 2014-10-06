/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq = require('m2nodehandler')
var helper = require('./helper.js')
var subsHelp = require('./Alt_subscribe.js')

var header_json_ACAO = { 'Content-Type' : 'application/json charset=utf-8', 'Access-Control-Allow-Origin' : '*'}

var notifApi = function (config) {

   var connected = []

   helper.init(config.logger_params)
   subsHelp.init(config.logger_params)

   console.log('Starting...')

   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink)
   var sendToComms = zmq.sender(config.comms.sink)

   /**
    * Notification Handlers
    * This section handles the internal Notification calls.
    */
   zmq.receiver(config.notif_sink, null, function (msg) {
      console.log(msg)
      console.log('\r\n')
      /*
       * Pass the msg to the helper. Have it discover if a notification needs to be sent out for this update.
       * processDAOMessage(msg, callback)
       */
      helper.processDAOMessage(msg, function (err) {
        if (err) {
          console.log('helper.js - ##### ERROR #####')
        }
        else {
         console.log('complete')
        }
      })

      var response = zmq.Response(zmq.status.OK_200, header_json_ACAO, msg)

      for (var i = 0 ; i < connected.length ; i++) {
         var client = connected[i]
         sendToMongrel2.send(client.uuid, client.connId, response)
      }

   })

   zmq.receiver(config.mongrel_handler.source, config.mongrel_handler.sink, function (msg) {
      console.log('{uuid : ' + msg.uuid + ', connId : ' + msg.connId + ' }')
      connected.push({'uuid' : msg.uuid, 'connId' : msg.connId })
   })




   /**
    * Subscription API Handlers
    * This section handles the API calls for Subscription CRUD operations.
    */
   var subsToMongrel2 = zmq.sender(config.mongrel_handler.sink)


   zmq.receiver(config.mongrel_handler.subsource, config.mongrel_handler.subsink, function (msg) {

      //console.log(msg)

      subsHelp.evaluateMessage(msg, function (err, results, httpStatusCode) {

         console.log(Object.keys(results).length)

         console.log(results)

         var resp           = {};
         var headers        = zmq.header_json;

         resp             = results;

         console.log(resp)

         var response = zmq.Response(httpStatusCode, zmq.header_json, resp)

         subsToMongrel2.send(msg.uuid, msg.connId, response)
      });
   })
}


module.exports = notifApi