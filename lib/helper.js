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
var subscriber = require('./subscription_helper.js')
var logger;


var last = function (arr) {
   return arr[arr.length - 1]
}


var init = function (logger_params) {
   logger = openiLogger(logger_params)
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


var processDAOMessage = function (msg, callback) {

   var actions = msg.msg.dao_actions
   var resp    = msg.response
   var status  = msg.status

   var database = last(actions).key
   if (database == undefined){
   	database = ""
   }
    console.log(last(actions))

    if (database.indexOf("c_") === -1 || database.indexOf("+s_") !== -1) {
      console.log("no object accessed")
      return
    };

    if (undefined !== resp["error"]) {
    	var err = true
    	callback(err)
    };

   if (status >= 200 && status <= 299)
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


module.exports.init              = init
module.exports.getAction         = getAction
module.exports.getAccess         = getAccess
module.exports.getCloudlet       = getCloudlet
module.exports.processDAOMessage = processDAOMessage




