/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq = require('m2nodehandler')
var dbc = require('dbc')
var openiLogger = require('openi-logger')
var nano = require('nano')('http://dev.openi-ict.eu:5984');
var logger;


Array.prototype.last = function () {
   return this[this.length - 1]
}

var init = function (logger_params) {
   logger = openiLogger(logger_params)
}


var passThrough = function (msg) {

   dbc.assert(null !== msg, 'Message cannot be null')
   dbc.hasMember(msg, 'action')
   dbc.hasMember(msg, 'uuid')
   dbc.hasMember(msg, 'connId')

   if (msg.action) {
      return zmq.Response(zmq.status.OK_200, zmq.header_json, msg)
   }
   return null
}

var getAction = function (method) {

   method = method.toLowerCase()
   var res = null

   switch (method) {
   case 'post':
      res = 'PUT'
      break
   case 'put':
      res = 'PUT'
      break
   case 'get':
      res = 'GET'
      break
   }


   return res
}

var getAccess = function (path) {

   var parts = path.split('/')
   var namePos = 3

   return parts[namePos]
}


var getCloudlet = function (path) {

   var parts = path.split('/')
   var cletPos = 4
   return parts[cletPos]

}

var getObject = function (path) {

   var parts = path.split('/')
   var namePos = 5

   return parts[namePos]

}

var putData = function (msg, callback) {

   var body = {}

   console.log('PUT DATA')

   /*if (cloudlet[msg.cloudlet] != null) {
    var subscription = cloudlet[msg.cloudlet]['me']['subscription']
    if (subscription != null && ( msg.object_name != null && msg.object_data != null )) {
    subscription = cloudlet[msg.cloudlet]['me']['subscription']
    var flag = true
    for (var i = 0 ; i < subscription.length ; i++) {
    console.log('>>>>>>' + JSON.stringify(subscription[i]))
    if (msg.object_name === Object.keys(subscription[i])[0] && flag) {
    body['result'] = 'successs'
    body['old_data'] = cloudlet[msg.cloudlet]['me']['subscription'][i]
    cloudlet[msg.cloudlet]['me']['subscription'][i] = msg.object_data
    body['updated'] = cloudlet[msg.cloudlet]['me']['subscription'][i]
    flag = false
    }
    }
    if (flag) {
    body['result'] = 'successs'
    body['old_data'] = ''
    cloudlet[msg.cloudlet]['me']['subscription'].push(msg.object_data)
    body['updated'] = cloudlet[msg.cloudlet]['me']['subscription'].last()
    flag = false
    }
    }
    else {
    body['result'] = 'failure'
    }
    }
    else {
    body['result'] = 'failure'
    }*/

   callback(body)

}


var getData = function (msg, callback) {

   var body = {}

   /*if (cloudlet[msg.cloudlet] != null) {
    var subscription = cloudlet[msg.cloudlet]['me']['subscription']
    if (msg.object_name != null) {
    var flag = true
    for (var i in subscription) {
    //console.log(JSON.stringify(subscription[i]))
    if (msg.object_name === Object.keys(subscription[i])[0]) {
    body['result'] = 'successs'
    body['old_data'] = cloudlet[msg.cloudlet]['me']['subscription'][i]
    flag = false
    }
    }
    if (flag) {
    body['result'] = 'failure'
    }
    }
    else {
    body['result'] = 'success'
    body['data'] = cloudlet[msg.cloudlet]['me']['subscription']
    }
    }
    else {
    body['result'] = 'failure'
    }
    */
   callback(body)

}


var evaluateMethod = function (msg, logger, callback) {

   logger.log('debug', msg)

   dbc.assert(null !== msg, 'Message cannot be null')
   dbc.hasMember(msg, 'cloudlet')

   var status = zmq.status.OK_200


   if (msg.action === 'GET') {
      //console.log('******' + String(msg.action) + '******')
      getData(msg, function (responsebody) {
         if (responsebody['result'] === 'failure') {
            status = zmq.status.BAD_REQUEST_400
         }

         callback(zmq.Response(status, zmq.header_json, responsebody))
      })
   }
   else if (msg.action === 'PUT') {
      //console.log('>>>>>>' + String(msg.action) + '<<<<<<')
      putData(msg, function (responsebody) {
         if (responsebody['result'] === 'failure') {
            status = zmq.status.BAD_REQUEST_400
         }

         callback(zmq.Response(status, zmq.header_json, responsebody))
      })
   }


}

var processDAOMessage = function (msg, callback) {

   /*
    * Function to get cloudlet subscriptions and see if this cloudlet is subscribed to the changed values.
    *  database: 'c_testcloudlet',
    object_name: 'watch',
    revision: '20-eb90520b78d06bb08bf5f420d3c27d71',
    object_data:
    { count: 21,
    test: true,
    _rev: '20-eb90520b78d06bb08bf5f420d3c27d71' } }

    *
    */
   var db = nano.use(msg.database)

   db.get('subscriptions', {revs_info: false}, function (err, db_body) {

      if (err) {
         logger.log('error', err )
         callback(null, { 'value' : false, 'error' : 'Error getting data from datastore' })
      }
      else {
         callback(null,  { 'value' : true, 'data' : db_body })
      }
   })


   var action = msg.action

   switch (action) {
   case 'POST':
      console.log('POST')
      break;
   case 'PUT':
      console.log('PUT')
      break;
   case 'DELETE':
      console.log('DELETE')
      break;
   }
   callback()

}

/*var processSubscription = function (msg, callback) {


 var notif_msg = {
 uuid        : msg.uuid,
 connId      : msg.connId,
 action      : getAction(msg.headers['METHOD']),
 cloudlet    : getCloudlet(msg.path),
 object_name : getObject(msg.path),
 object_data : msg.json
 }

 //console.log(typeof notif_msg.object_data)
 //console.log(typeof msg.json)

 logger.log('debug', notif_msg)

 evaluateMethod(notif_msg, logger, function (response) {
 //console.log('-----replying------')
 console.log(response)
 callback(response)
 })
 }*/

var evaluateMessage = function (msg, myCallback) {

   dbc.hasMember(msg, 'app_Id')
   dbc.hasMember(msg, 'subs')

   dbc.assert(msg.subs.length > 0)

   //var arr = {}

   /*for (var i = 0 ; i < msg.subs.length ; i++) {

    var action = msg.dao_actions[i]
    arr[i] = actionToFunction(action)

    }

    async.series(arr, function (err, results) {
    myCallback(err, results)
    })*/

}


module.exports.init = init
module.exports.getAction = getAction
module.exports.getAccess = getAccess
module.exports.getCloudlet = getCloudlet
module.exports.passThrough = passThrough
module.exports.processDAOMessage = processDAOMessage




