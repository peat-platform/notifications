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
var subscriber = require('./Alt_subscribe.js')
var logger;

var subtypes = ['PUSH', 'NOTIFICATION', 'SMS', 'EMAIL','push', 'notification', 'sms', 'email','Push', 'Notification', 'Sms', 'Email']



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

var checkSubscriptions = function (msg, callback) {
	console.log("Check Subs")
	subscriber.getSub(msg,function(err,result,httpStatusCode)
      {
   		console.log(result)
   		callback()
   	}
   )
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

   var actions = msg.msg.dao_actions
   var resp = msg.response

   var database = actions.last().database

    console.log(actions.last())

    if (database.indexOf("c_") === -1 || database.indexOf("+s_") !== -1) {
      console.log("no object accessed")
      return
    };

    if (resp.body.indexOf("error") !== -1) {
    	var err = true
    	callback(err)
    };

   if (resp.status >= 200 && resp.status <= 299) 
   {
   	var names = database.split('+')

   	msg.msg.path = "/api/v1/notification/"+names[0]

   	checkSubscriptions(msg.msg ,function()
          {
            console.log("Checked")
            callback()
          }
      );
   };
  
   

}


module.exports.init = init
module.exports.getAction = getAction
module.exports.getAccess = getAccess
module.exports.getCloudlet = getCloudlet
module.exports.passThrough = passThrough
module.exports.processDAOMessage = processDAOMessage




