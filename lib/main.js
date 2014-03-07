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

var header_json_ACAO  = { 'Content-Type' : 'application/json charset=utf-8', 'Access-Control-Allow-Origin' : '*'}

var notifApi = function (config) {

   var connected = []

   helper.init(config.logger_params)

   console.log('Starting...')

   //var subs_broadcaster = zmq.sender(config.subs_broadcaster)

   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink)

   zmq.receiver(config.subs_sink, function (msg) {
      console.log(msg.clients)
      console.log(connected)
      var response = zmq.Response(zmq.status.OK_200, header_json_ACAO, msg.mongrel_resp)

      for (var i = 0 ; i < connected.length ; i++) {
         var client = connected[i]
         sendToMongrel2.send(client.uuid, client.connId, response)
      }
   })

   zmq.receiver(config.mongrel_handler.source, function (msg) {
      console.log('{uuid : ' + msg.uuid + ', connId : ' + msg.connId + ' }')
      connected.push({'uuid' : msg.uuid, 'connId' : msg.connId })
   })
}


module.exports = notifApi