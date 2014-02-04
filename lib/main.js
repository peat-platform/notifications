/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq      = require('../../m2nodehandler/lib/m2nodehandler.js');
var helper   = require('./helper.js');
var notifier = require('./notifier.js');

var notifApi = function(params){

   helper.init(params.logger_params)
/*
   var daoPush = zmq.bindToPushQ({
      spec : params.dao_sub_q.spec
   });
*/

   var mongPush = zmq.bindToMong2PubQ({
      spec : params.mongrel_sub_q.spec,
      id   : params.mongrel_sub_q.id
   });
   var internalPush = zmq.bindToInternalPubQ({
      spec : params.internal_sub_q.spec,
      id   : params.internal_sub_q.id
   });

/*
   zmq.bindToPullQ({
      spec : params.notif_api_sub_q.spec,
      id   : params.notif_api_sub_q.id
   }, function(msg) {

      var response = helper.passThrough(msg)

      if (null != response) {
         mongPush.publish(msg.uuid, msg.connId, response)
      }

   });
*/

   zmq.bindToMong2PullQ({
      spec : params.subsc_api_mong_sub_q.spec,
      id   : params.subsc_api_mong_sub_q.id
   }, function(msg) {

      helper.processMongrel2Message(msg, function (notif_msg) {
         if (null != notif_msg) {
            //console.log("*****" + notif_msg + "*****")
         mongPush.publish(msg.uuid, msg.connId, notif_msg)
         internalPush.publish(msg.uuid, msg.connId, notif_msg)
         };
      });
      //console.log("*****" + notif_msg + "*****")
      //mongPush.push(notif_msg)
      //mongPush.publish(msg.uuid, msg.connId, notif_msg)
   });

   zmq.bindToSubsQ({
         spec : params.notif_mong_sub_q.spec,
         id   : params.notif_mong_sub_q.id
      }, function(msg) {

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

}


module.exports = notifApi