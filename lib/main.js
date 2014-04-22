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
var subsHelp = require('./subscribe.js')

var header_json_ACAO = { 'Content-Type' : 'application/json charset=utf-8', 'Access-Control-Allow-Origin' : '*'}

var notifApi = function (config) {

   var connected = []

   helper.init(config.logger_params)
   subsHelp.init(config.logger_params)

   console.log('Starting...')

   //var subs_broadcaster = zmq.sender(config.subs_broadcaster)

   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink)
   var sendToComms = zmq.sender(config.comms.sink)

   zmq.receiver(config.notif_sink, null, function (msg) {
      console.log(msg)
      console.log('\r\n')
      /*
       * Pass the msg to the helper. Have it discover if a notification needs to be sent out for this update.
       * processDAOMessage(msg, callback)
       */
      //console.log(connected)
      helper.processDAOMessage(msg, function () {
         console.log('complete')
      })

      var response = zmq.Response(zmq.status.OK_200, header_json_ACAO, msg)

      for (var i = 0 ; i < connected.length ; i++) {
         var client = connected[i]
         sendToMongrel2.send(client.uuid, client.connId, response)
      }

      //console.log("Sending Communication")
      /*var comms = {
         'type'    : 'EMAIL',
         'subject' : 'test email',
         'to'      : 'dconway@tssg.org',
         'text'    : msg,
         'html'    : 'Hi <b>There</b></br><p>' + msg + '</p>'
      }
      sendToComms.send(comms)*/
   })

   zmq.receiver(config.mongrel_handler.source, config.mongrel_handler.sink, function (msg) {
      console.log('{uuid : ' + msg.uuid + ', connId : ' + msg.connId + ' }')
      connected.push({'uuid' : msg.uuid, 'connId' : msg.connId })
   })


   /**
    * Subscription API Handlers
    * @type {*}
    */
   var subsToMongrel2 = zmq.sender(config.mongrel_handler.sink)


   zmq.receiver(config.mongrel_handler.subsource, config.mongrel_handler.subsink, function (msg) {

      console.log(msg)

      subsHelp.evaluateMessage(msg, function (err, results) {

         var response = zmq.Response(zmq.status.OK_200, zmq.header_json, results)

         subsToMongrel2.send(msg.uuid, msg.connId, response)
      });
   })
}


module.exports = notifApi