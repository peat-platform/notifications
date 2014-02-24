/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

<<<<<<< HEAD
var zmq      = require('m2nodehandler');
var helper   = require('./helper.js');
=======
var zmq = require('m2nodehandler')
var helper = require('./helper.js')
>>>>>>> 3d394e7c511da9f65ec2cc2d635e241ce1cac0af

var notifApi = function (config) {

<<<<<<< HEAD
   helper.init(params.logger_params)
=======
   var connected = []
>>>>>>> 3d394e7c511da9f65ec2cc2d635e241ce1cac0af

   helper.init(config.logger_params)

   console.log('Starting...')

   var subs_broadcaster = zmq.sender(config.subs_broadcaster)

<<<<<<< HEAD
      helper.processMongrel2Message(msg, function (notif_msg) {
         if (null != notif_msg) {
            mongPush.publish(msg.uuid, msg.connId, notif_msg)
            internalPush.publish(msg.uuid, msg.connId, notif_msg)
         }
      });
   });
=======
   var sendToMongrel2 = zmq.sender(config.mongrel_handler.sink)
>>>>>>> 3d394e7c511da9f65ec2cc2d635e241ce1cac0af

   zmq.receiver(config.subs_sink, function (msg) {
      console.log(msg.clients)
      console.log(connected)
      var response = zmq.Response(zmq.status.OK_200, { 'Content-Type' : 'application/json charset=utf-8', 'Access-Control-Allow-Origin' : '*'}, msg.mongrel_resp)

<<<<<<< HEAD
         console.log(msg)
         /*notifier.handleMessage(msg, function (notif_msg) {
            if (null != notif_msg) {
               //console.log("***** Sub *****")
            mong2Push.publish(msg.uuid, msg.connId, notif_msg)
            };
         });*/
         //console.log("*****" + notif_msg + "*****")
         //mongPush.push(notif_msg)
         //mongPush.publish(msg.uuid, msg.connId, notif_msg)
      });
=======
      for (var i = 0 ; i < connected.length ; i++) {
         var client = connected[i]
         sendToMongrel2.send(client.uuid, client.connId, response)
      }
   })
>>>>>>> 3d394e7c511da9f65ec2cc2d635e241ce1cac0af

   zmq.receiver(config.mongrel_handler.source, function (msg) {
      console.log('{uuid : ' + msg.uuid + ', connId : ' + msg.connId + ' }')
      connected.push({'uuid' : msg.uuid, 'connId' : msg.connId })
   })
}


module.exports = notifApi