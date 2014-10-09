/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the APACHE2 license.
 */


'use strict';

var dbc          = require('dbc');
var openiLogger  = require('openi-logger');
var async        = require('async');
var couchbase    = require('couchbase');
var openiUtils   = require('openi-cloudlet-utils');
var zmq          = require('m2nodehandler');
var http         = require('http');
var https        = require('https');

var HTTPStatus  = require('http-status');

var logger;
var db;
var sendToMongrel2;

var sse_connections = {};

var init = function (config) {

   logger         = openiLogger(config.logger_params);
   sendToMongrel2 = zmq.sender(config.mongrel_handler.sink);

   db = new couchbase.Connection({host: 'localhost:8091', bucket: 'openi'}, function(err){
      if (err) {
         console.log('Connection Error', err);
      } else {
         console.log('Notification: Connected to "OPENi" Bucket');
      }
   });
};


var getPathSize = function (path) {
   var parts = path.split('/');
   return parts.length || 0
};


var getCloudlet = function (path) {
   var parts   = path.split('/');
   var cletPos = 4;
   return parts[cletPos];
};


var getSubId = function (path) {
   var parts   = path.split('/');
   var cletPos = 5;
   return parts[cletPos];
};

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
      return "Reason unknown";
      break;
   }
};

var sendEndpointNotification = function(msg){
   console.log(msg);

   if(undefined !== msg.endpoint) {

      var endpoint = msg.endpoint;

      if(endpoint.indexOf("https") !== -1) {

      }
      else if (endpoint.indexOf("http") !== -1) {

      }
      else {

      }
   }
};


var addSSEConnection = function(msg){
   var subId = msg.path.replace("/sse/", "")

   sse_connections[subId] = {uuid: msg.uuid, connId: msg.connId}
};


var sendSSE = function(msg){
   console.log ("$$$$$$$$$$$$$$$$$$$$$$$$$$");
   console.log (msg);
   console.log ("$$$$$$$$$$$$$$$$$$$$$$$$$$");

   var conn = sse_connections[msg.subId];

   if (undefined !== conn){
      var body = 'data: ' + JSON.stringify(msg) + '\n\n';
      sendToMongrel2.send(conn.uuid, conn.connId, zmq.status.OK_200, zmq.standard_headers.stream, body)
   }
};


var processSubscription = function (msg) {

   var object       = msg.key;
   var subscription = msg.value;

   switch(subscription.type.toLowerCase())
   {
      case "email":
         console.log("email");
         return;
         break;

      case "notification":
         console.log("notification");

         return;
         break;

      case "sms":
         console.log("sms");
         return;
         break;

      case "sse":
         sendSSE(msg);
         return;
         break;
   }

};


var postSub = function (msg, callback) {

	var subscription = msg.json;

   dbc.hasMember(subscription, 'objectid');
   dbc.hasMember(subscription, 'type');

   subscription._date_created  = new Date().toJSON();
   subscription._date_modified = new Date().toJSON();


   var subId         = 's_' + openiUtils.hash(subscription);
   var cloudlet      = getCloudlet(msg.path);
   var objectRestURL = "http://" + msg.headers.host + '/api/v1/subscription/' + cloudlet + '/' + subId;

   subscription._id = objectRestURL;

   var dbName = cloudlet + '+' + subId;

   db.add(dbName, subscription, function (err, result) {

      if (err) {
         logger.log('error', err );
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
      }
   })
};

var getSubscriptionsForObject = function (msg, callback) {
   msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
   msg.skip     = (typeof msg.skip  !== 'number' || isNaN(msg.skip))                    ? 0  : msg.skip;
   msg.startkey = typeof msg.startkey !== 'string' ? "" : msg.startkey;

   var params = {
      startkey_docid : msg.startkey,
      skip           : msg.skip,
      stale          : false,
      limit          : msg.count,
      startkey       : msg.objectId,
      endkey         : msg.objectId
   };

   db.view("subscription_views", "subs_by_objectId", params).query(function(err, res)
   {
      console.log(res);
      if (res === null) {
         callback(null,  { 'error' : 'Query responce was null or undefined' }, HTTPStatus.INTERNAL_SERVER_ERROR)
      }
      else {
         for (var i = 0; i < res.length; i++){
            res[i].subId = res[i].id.split("+")[1];
            processSubscription(res[i])
         }
      }
   });
};


var getSub = function (msg, callback) {

   //console.log(msg)
   var cloudlet = getCloudlet(msg.path);
   var subId    = getSubId(msg.path);
   var database = msg.dao_actions[0].database;
   var object   = database.split("+")[1];

   console.log(object);

   if( getPathSize(msg.path) > 5 )
   {
      var dbName = cloudlet + '+' + subId;
      console.log(dbName);
      console.log("######");

      db.get(dbName, function (err, result) {
         //console.log(result)

         var subscription = result.value;
         subscription["_revision"] = result.cas['0'] + "-" + result.cas['1'];

         if (err) {
            logger.log('error', err );
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
      msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
      msg.skip     = (typeof msg.skip  !== 'number' || isNaN(msg.skip))                    ? 0  : msg.skip;
      msg.startkey = typeof msg.startkey !== 'string' ? "" : msg.startkey;

      var params = {
         startkey_docid : msg.startkey,
         skip           : msg.skip,
         stale          : false,
         limit          : msg.count,
         startkey       : object,
         endkey         : object
      };


      db.view("subscription_views", "subs_by_objectId", params).query(function(err, res)
      {
         console.log(res);
         if (res === null) {
            callback(null,  { 'error' : 'Query responce was null or undefined' }, HTTPStatus.INTERNAL_SERVER_ERROR)
         }
         else {
            for (var i = 0; i < res.length; i++){
               res[i].subId = res[i].id.split("+")[1];
               processSubscription(res[i])
            }         
         }
      });
   }
};


var putSub = function (msg, callback) {

   var subscription = msg.json;


  dbc.hasMember(subscription, 'objectid');
  dbc.hasMember(subscription, 'type');
  dbc.hasMember(subscription, '_revision' );
  dbc.hasMember(subscription, '_date_modified' );

  var cloudlet = getCloudlet(msg.path);
  var subId    = getSubId(msg.path);

  var dbName = cloudlet + '+' + subId;

  db.get(dbName, function (err, db_body) {

      var revisionParts = subscription["_revision"].split('-');
      var sub = db_body.value;


      if (db_body.cas['0'] != revisionParts[0] && db_body.cas['1'] != revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      if (db_body.value === subscription
            && db_body.cas['1'] != revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      sub.objectid = subscription.objectid;
      sub.type     = subscription.type;
      sub.endpoint = subscription.endpoint;
      sub.data     = subscription.data;

      sub._date_modified = new Date().toJSON();


      db.set(dbName, sub, {cas: db_body.cas}, function (err,result) {

         if (err) {
            logger.log('error', err );

            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;

            callback(null, { 'error' : 'Error updating entity: ' + getCouchbaseError(err) },
               httpCode)
         }
         else {
            callback(null, { 'id' : subscription.id }, HTTPStatus.OK)
         }
      })
   })
};


var addSubscription = function (msg, myCallback) {

   dbc.hasMember(msg.json, 'subscriptions');

   dbc.assert(msg.json.subscriptions.length > 0);

   var sub = {};
   sub.cloudlet = getCloudlet(msg.path);
   sub.host = msg.headers.host;

   var json = msg.json;
   

   var arr = {};

   console.log(json.subscriptions.length);

   for (var i = 0 ; i < json.subscriptions.length ; i++) {
      
      sub.subscription = json.subscriptions[i];
      arr[i] = actionToFunction(sub)
      
   }


   async.series(arr, function (err, results, httpStatusCode) {
      myCallback(err, results, httpStatusCode)
   })

};


var evaluateMessage = function (msg, callback) {
   var resp_msg = '';

   var pathSize = getPathSize(msg.path);
   console.log(msg);

   switch(msg.headers.METHOD){
   case 'POST':
      	postSub(msg, callback);
      break;
   case 'GET':
      	getSub(msg, callback);
      break;
   case 'PUT':
      	putSub(msg, callback);
      break;
   case 'DELETE':
      	deleteSub(msg, callback);
      break;
   default:
      break;
   }
};

module.exports.init                      = init;
module.exports.evaluateMessage           = evaluateMessage;
module.exports.getSub                    = getSub;
module.exports.getSubscriptionsForObject = getSubscriptionsForObject;
module.exports.addSSEConnection          = addSSEConnection;





