/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the APACHE2 license.
 */


'use strict';

var dbc = require('dbc')
var openiLogger = require('openi-logger')
var async = require('async')
var couchbase = require('couchbase')
var openiUtils = require('openi-cloudlet-utils')

var HTTPStatus  = require('http-status');

var logger;
var db;


var init = function (logger_params) {
   logger = openiLogger(logger_params)
   db = new couchbase.Connection({host: 'localhost:8091', bucket: 'openi'}, function(err){
      if (err) {
         console.log('Connection Error', err);
      } else {
         console.log('Connected!');
      }
   });
}

var getCouchbaseError = function(err, documentName, rest_uuid){

   switch (err.code){
   case 13:
      return 'Entity with that id does not exist';
      break;
   case 12:
      if (0 === documentName.indexOf('t_')){
         return 'OPENi Type already exists (' + rest_uuid + ').';
      }
      return 'Incorrect revision number provided';
      break;
   default:
      return "Reason unknown"
      break;
   }
}

var pushSub = function (msg, callback) {

   console.log()
   console.log()	
   console.log(msg.subscription)
   var subId = 's_' + openiUtils.hash(msg.subscription)
   console.log(subId)
   console.log("----")

   var dbName = msg.cloudlet + '+' + subId

   db.add(dbName, msg.subscription, function (err, result) {

      if (err) {
         logger.log('error', err )
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : dbName }, HTTPStatus.CREATED)
      }
   })
}

/*
   var db = nano.use(msg.cloudlet);
   db.update = update

   var doc = 'subscriptions'
   var sub = {}
   var arr = []
   arr.push(msg.subscription)
   sub[msg.app_Id] = arr

   db.update(sub, doc, function (err) {
      if (err) {
         logger.log('error', err)
         callback(null, { 'value' : false, 'data' : 'Error adding data to datastore' })
      }
      else {
         callback(null, {
            'value' : true,
            'data'  : 'Added Subscription: ' + msg.cloudlet + ', ' + msg.data + ', ' + msg.type + ', ' + msg.endpoint
         })
      }
   })
}*/

/*var notifSub = function (msg, callback) {
   //This is where the subscription will be added to the dao somehow.

   //console.log("Adding Notification")

   var db = nano.use(msg.cloudlet);
   db.update = update


   var doc = 'subscriptions'
   var sub = {}
   var arr = []
   arr.push(msg.subscription)
   sub[msg.app_Id] = arr

   db.update(sub, doc, function (err) {
      if (err) {
         logger.log('error', err)
         callback(null, { 'value' : false, 'data' : 'Error adding data to datastore' })
      }
      else {
         callback(null, {
            'value' : true,
            'data'  : 'Added Subscription to ' + msg.subscription.cloudletid +
               ' for \'' + msg.subscription.data + '\' of type ' + msg.subscription.type +
               ' to ' + msg.subscription.endpoint
         })
      }
   })
}

*/var getSubs = function (msg, callback) {

    console.log(msg)

    console.log(dbname)

   
   var dbname = getCloudlet(msg.path) + "+" + getSubId(msg.path)

   console.log(dbname)

   db.get(dbname, null, function (err, body) {
      if (err) {
         logger.log('error', err)
         callback(null, { 'value' : false, 'data' : 'Error getting subs' })
      }
      else {
         callback(null,  body )
      }
   })
}


var evaluateAction = function (msg, callback) {
   dbc.hasMember(msg, 'subscription')
   dbc.hasMember(msg.subscription, 'objectid')
   dbc.hasMemberIn(msg.subscription, 'type', ['PUSH', 'NOTIFICATION', 'SMS', 'EMAIL'])
   dbc.hasMember(msg.subscription, 'endpoint')

   console.log("EVALUATING...")
   console.log(msg)

   var resp_msg = ''
   /**
    * Endpoint Validation should be done at some statge:
    * Email match email format,
    * SMS match phone number format,
    * Push match URL format.
    */
   switch (msg.subscription.type.toUpperCase()) {
   case 'PUSH':
      //URL Endpoint
      resp_msg = pushSub(msg, callback)
      break;
   case 'NOTIFICATION':
      resp_msg = notifSub(msg, callback)
      break;
   case 'SMS':
      resp_msg = pushSub(msg, callback)
      break;
   case 'EMAIL':
      resp_msg = pushSub(msg, callback)
      break;
   }
   console.log(resp_msg)
   return resp_msg;
}

var actionToFunction = function (action) {
   return ( function (action) {
      return function (callback) {
         evaluateAction(action, callback)
      }
   }(action) )
}

var addSubscription = function (msg, myCallback) {

   //console.log("Add Sunbcription")

   dbc.hasMember(msg.json, 'subscriptions')

   dbc.assert(msg.json.subscriptions.length > 0)

   var sub = {};
   sub.cloudlet = getCloudlet(msg.path)
   sub.host = msg.headers.host

   var json = msg.json
   

   var arr = {}

   console.log(json.subscriptions.length)

   for (var i = 0 ; i < json.subscriptions.length ; i++) {
      
      sub.subscription = json.subscriptions[i]
      console.log(sub)

      arr[i] = actionToFunction(sub)
      
   }

   console.log(arr)

   async.series(arr, function (err, results) {
      myCallback(err, results)
   })

   //return arr

}
var getPathSize = function (path) {
   var parts = path.split('/')
   return parts.length || 0
}

var getCloudlet = function (path) {
   var parts = path.split('/')
   var cletPos = 4;
   return parts[cletPos];
}

var getSubId = function (path) {
   var parts = path.split('/')
   var cletPos = 5;
   return parts[cletPos];
}

var evaluateMessage = function (msg, callback) {
   var resp_msg = ''

   var pathSize = getPathSize(msg.path)
   switch (msg.headers.METHOD) {
   case 'POST':
      //URL Endpoint
      if (pathSize > 5) {
         /*
          Do Subscription Update
          */
      }
      else {
         //resp_msg = pushSub(msg, callback)
         addSubscription(msg, callback)
      }
      break;
   case 'GET':
      if (pathSize > 5) {
         getSubs(msg, callback)
      }
      else {
         getSubs(msg, callback)
      }
      break;
   case 'DELETE':
      /*
       Do Subscription Delete
       */
      pushSub(msg, callback)
      break;

      /*async.series(resp_msg, function (err, results) {
       callback(resp_msg, results)
       })*/
   }
}

module.exports.init = init
module.exports.evaluateMessage = evaluateMessage





