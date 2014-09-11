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

var subtypes = ['PUSH', 'NOTIFICATION', 'SMS', 'EMAIL','push', 'notification', 'sms', 'email','Push', 'Notification', 'Sms', 'Email']


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

var postSub = function (msg, callback) {

	var subscription = msg.json

   dbc.hasMember(subscription, 'objectid')
   dbc.hasMember(subscription, 'type')
   dbc.hasMember(subscription, 'endpoint')

   subscription._date_created  = new Date().toJSON()
   subscription._date_modified = new Date().toJSON()


   var subId         = 's_' + openiUtils.hash(subscription)
   var cloudlet      = getCloudlet(msg.path)
   var objectRestURL = "http://" + msg.headers.host + '/api/v1/subscription/' + cloudlet + '/' + subId;

   subscription._id = objectRestURL

   var dbName = cloudlet + '+' + subId

   db.add(dbName, subscription, function (err, result) {

      if (err) {
         logger.log('error', err )
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
      }
   })
}


var getSub = function (msg, callback) {

   if( getPathSize(msg.path) > 5 )
   {
      var dbName = getCloudlet(msg.path) + '+' + getSubId(msg.path)
      console.log(dbName)

      db.get(dbName, function (err, result) {
         console.log(result)

         var subscription = result.value
         subscription["_revision"] = result.cas['0'] + "-" + result.cas['1']

         if (err) {
            logger.log('error', err )
            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
            callback(null,
               { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
               httpCode)
         }
         else {
            callback(null, subscription , HTTPStatus.CREATED)
         }
      })
   }
   else {
   db.view('dev_subscriptions', 'subscriptions').query(function(err, res)
   {
      var respObj = [];

      for (var i = 0; i < res.length; i++){
         respObj[i] = {'@cloudlet' : res[i].key, '@id' : res[i].value}
      }

      callback(null,  respObj, HTTPStatus.OK)
   });
 }
}


var putSub = function (msg, callback) {

   var subscription = msg.json


  dbc.hasMember(subscription, 'objectid')
  dbc.hasMember(subscription, 'type')
  dbc.hasMember(subscription, 'endpoint')
  dbc.hasMember(subscription, '_revision' )
  dbc.hasMember(subscription, '_date_modified' )

  var cloudlet = getCloudlet(msg.path)
  var subId    = getSubId(msg.path)

  var dbName = cloudlet + '+' + subId

  db.get(dbName, function (err, db_body) {

      var revisionParts = subscription["_revision"].split('-');
      var sub = db_body.value


      if (db_body.cas['0'] != revisionParts[0] && db_body.cas['1'] != revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT)
         return;
      }

      if (db_body.value === subscription
            && db_body.cas['1'] != revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT)
         return;
      }

      sub.objectid = subscription.objectid
      sub.type     = subscription.type
      sub.endpoint = subscription.endpoint
      sub.data     = subscription.data

      sub._date_modified = new Date().toJSON()


      db.set(dbName, sub, {cas: db_body.cas}, function (err,result) {

         if (err) {
            logger.log('error', err )

            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;

            callback(null, { 'error' : 'Error updating entity: ' + getCouchbaseError(err) },
               httpCode)
         }
         else {
            callback(null, { 'id' : msg.id }, HTTPStatus.OK)
         }
      })
   })


   /*var subId = 's_' + openiUtils.hash(msg.subscription)


   var revisionParts = msg.revision.split('-');

   var objectRestURL = "http://" + msg.host + '/api/v1/subscription/' + msg.cloudlet + '/' + subId;

   

   db.add(dbName, msg.subscription, function (err, result) {

      if (err) {
         logger.log('error', err )
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
      }
   })*/
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
      arr[i] = actionToFunction(sub)
      
   }


   async.series(arr, function (err, results, httpStatusCode) {
      myCallback(err, results, httpStatusCode)
   })

}


var evaluateMessage = function (msg, callback) {
   var resp_msg = ''

   var pathSize = getPathSize(msg.path)
   console.log(msg)

   switch(msg.headers.METHOD){
   case 'POST':
      	postSub(msg, callback)
      break;
   case 'GET':
      	getSub(msg, callback)
      break;
   case 'PUT':
      	putSub(msg, callback)
      break;
   case 'DELETE':
      	deleteSub(msg, callback)
      break;
   default:
      break;
   }
}

module.exports.init = init
module.exports.evaluateMessage = evaluateMessage





