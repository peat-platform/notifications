/**
 * Created by dconway on 10/03/14.
 */


/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the MIT license.
 */

/**
 * {

 *
 *
 */

/*var tmp = { 'app_Id' : 'string',
 'subscriptions'   : [
 {
 'cloudlet' : 'address',
 'data'     : 'me.email address',
 'type'     : 'PUSH',
 'endpoint' : 'string'
 }
 ]
 }*/

'use strict';

var dbc = require('dbc')
var openiLogger = require('openi-logger')
var async = require('async')
var nano = require('nano')('http://dev.openi-ict.eu:5984');
var logger;

var cloudlet = 'c_testcloudlet'

var update = function (obj, key, callback) {
   var db = this;
   db.get(key, function (error, existing) {
      if (!error) {
         obj._rev = existing._rev;
         for (var keys in existing) {
            console.log(existing.hasOwnProperty(keys) && !obj.hasOwnProperty(keys))
            if (existing.hasOwnProperty(keys) && !obj.hasOwnProperty(keys)) {
               obj[keys] = existing[keys]
               console.log(obj[keys])
            }
         }
         console.log("OBJ" + JSON.stringify(obj))
      }
      db.insert(obj, key, callback);
   });
}

var init = function (logger_params) {
   logger = openiLogger(logger_params)
}

var pushSub = function (msg, callback) {
   //This is where the subscription will be added to the dao somehow.

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
}

var notifSub = function (msg, callback) {
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

var getSubs = function (msg, callback) {
   var db = nano.use(cloudlet);

   var doc = 'subscriptions'


   db.get(doc, null, function (err, body) {
      if (err) {
         logger.log('error', err)
         callback(null, { 'value' : false, 'data' : 'Error adding data to datastore' })
      }
      else {
         callback(null, {
            'value' : true,
            'data'  : body
         })
      }
   })
}


var evaluateAction = function (msg, callback) {
   dbc.hasMember(msg, 'subscription')
   dbc.hasMember(msg.subscription, 'data')
   dbc.hasMemberIn(msg.subscription, 'type', ['PUSH', 'NOTIFICATION', 'SMS', 'EMAIL'])
   dbc.hasMember(msg.subscription, 'endpoint')

   //console.log("EVALUATING...")

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

   dbc.hasMember(msg.json, 'app_Id')
   dbc.hasMember(msg.json, 'subscriptions')

   dbc.assert(msg.json.subscriptions.length > 0)

   var json = msg.json
   json.cloudlet = getCloudlet(msg.path)
   var arr = {}

   //create copy of "json" to work with
   var singleSubs = JSON.parse(JSON.stringify(json))
   delete singleSubs.subscriptions

   for (var i = 0 ; i < json.subscriptions.length ; i++) {
      //substitute Subscription list for current subs item
      singleSubs.subscription = json.subscriptions[i]

      console.log(singleSubs)

      arr[i] = actionToFunction(singleSubs)

   }

   console.log("ARR" + JSON.stringify(arr))
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

var evaluateMessage = function (msg, callback) {
   var resp_msg = ''

   var pathSize = getPathSize(msg.path)
   console.log(pathSize)
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
         /*
          Get Select Subscriptions
          */
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





