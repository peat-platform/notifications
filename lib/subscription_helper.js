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
var sendToCommunications;

var sse_connections = {};

var init = function (config) {

   logger               = openiLogger(config.logger_params);
   sendToMongrel2       = zmq.sender(config.mongrel_handler.sink);
   sendToCommunications = zmq.sender(config.comms.sink);

   db = new couchbase.Connection({host: 'localhost:8091', bucket: 'openi', connectionTimeout:60000}, function(err){
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

   case 12:
      if (0 === documentName.indexOf('t_')){
         return 'OPENi Type already exists (' + rest_uuid + ').';
      }
      return 'Incorrect revision number provided';

   default:
      return 'Reason unknown';

   }
};

var sendEndpointNotification = function(msg){
   console.log(msg);

   var sub = msg.value;

   dbc.hasMember(sub, 'endpoint');

   var req = null;

   var url = sub.endpoint.split('/');

   //check for presence of colon (http://, https://) and set hostname accordingly
   var hostname = (url[0].indexOf(':') >= 0) ? url[2] : url[0];
   //same check but setting path instead of hostname
   var path = (url[0].indexOf(':') >= 0) ? url.slice(3,url.length).join('/') : url.slice(1,url.length).join('/');

   var options = {
      hostname: '127.0.0.1',
      port: 6000,
      path: '/',
      method: 'GET'
   };

   if(undefined !== sub.endpoint) {

      var endpoint = sub.endpoint;

      if(endpoint.indexOf('https') !== -1) {

         options.port = 443;
         options.hostname = endpoint.replace('https://','');

         req = https.request(options,function(res){
            console.log(res)
         })
      }
      else if (endpoint.indexOf('http') !== -1) {
         req = http.request(options,function(res){
            console.log(res)
         })
      }
      else {
         req = http.request(options,function(res) {
            console.log(res)
         });
      }
      req.end();

      req.on('error', function(e) {
         console.error(e);
      });
   }
};



var addSSEConnection = function(msg){
   var subParam = msg.path.replace('/sse/', '');

   var subIds = subParam.split('+');

   for(var i = 0 ; i < subIds.length; i++) {

      sse_connections[subIds[i]] = {uuid: msg.uuid, connId: msg.connId};

      console.log(subIds[i])
   }

   /*db.set(subId, sse_connections[subId], function (err, result) {

      if (err) {
         logger.log('error', err );
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         //callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
         console.log("SSE Created")
      }
   })*/
};


var sendSSE = function(msg){

   var conn = sse_connections[msg.subId];
   console.log(msg.subId);

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
      case 'email':
         sendToCommunications.send(subscription);
         return;

      case 'notification':
         sendEndpointNotification(msg);
         console.log('notification');
         return;

      case 'sms':
         sendToCommunications.send(subscription)
         return;

      case 'sse':
         sendSSE(msg);
         console.log('sse');
         return;
   }

};


var postSub = function (msg, callback) {

	var subscription = msg.json;

   dbc.hasMember(subscription, 'cloudletid');
   dbc.hasMember(subscription, 'type');
   dbc.conditionalHasMember(subscription, 'endpoint', (subscription.type.toLowerCase() === 'notification') )

   subscription._date_created  = new Date().toJSON();
   subscription._date_modified = new Date().toJSON();


   var subId         = 's_' + openiUtils.hash(subscription);
   var cloudlet      = getCloudlet(msg.path);
   var objectRestURL = 'http://' + msg.headers.host + '/api/v1/subscription/' + cloudlet + '/' + subId;

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
         callback(null, { 'id' : subId }, HTTPStatus.CREATED)
      }
   })
};
/**
 * Get subscriptions for update object/cloudlet trigger sent from DAO
 * @param msg
 * @param callback
 */
var getSubscriptions = function (msg, callback) {
   msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
   msg.skip     = (typeof msg.skip  !== 'number' || isNaN(msg.skip))                    ? 0  : msg.skip;
   msg.startkey = typeof msg.startkey !== 'string' ? "" : msg.startkey;

   var endkey = (msg.objectId !== undefined) ? [msg.cloudletId,msg.objectId] : [msg.cloudletId,null]


   var params = {
      startkey_docid : msg.startkey,
      skip           : msg.skip,
      stale          : false,
      limit          : msg.count,
      startkey       : [msg.cloudletId,null],
      endkey         : endkey
   };

   console.log(params.startkey)
   console.log(params.endkey)

   db.view('subscription_views', 'subs', params).query(function(err, res)
   {
      if (res === null) {
         callback(null,  { 'error' : 'Query responce was null or undefined' }, HTTPStatus.INTERNAL_SERVER_ERROR)
      }
      else {
         for (var i = 0; i < res.length; i++){
            res[i].subId = res[i].id.split('+')[1];
            processSubscription(res[i])
         }
      }
   });
};


var getSub = function (msg, callback) {

   dbc.hasMember(msg, 'path');

   var cloudlet = getCloudlet(msg.path)
   var subId    = getSubId(msg.path)

   if( getPathSize(msg.path) > 5 )
   {
      var dbName = cloudlet + '+' + subId;

      db.get(dbName, function (err, result) {

         if (err) {
            logger.log('error', err );
            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
            callback(null,
               { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
               httpCode)
         }
         else if (result === null){
            callback(null,
               {"error" : 'Not Found'},
               HTTPStatus.NOT_FOUND)
         } else {
            var subscription = result.value;
            subscription['_revision'] = result.cas['0'] + "-" + result.cas['1'];

            callback(null, subscription , HTTPStatus.OK)
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
         startkey       : cloudlet,
         endkey         : cloudlet
      };


      db.view('subscription_views', 'subs_by_cloudletId', params).query(function(err, res)
      {
         var respObj = [];
         if (res === null) {
            callback(null,  { 'error' : 'Query responce was null or undefined' }, HTTPStatus.INTERNAL_SERVER_ERROR)
         }
         else {
            for (var i = 0; i < res.length; i++){
               respObj[i] = {'@cloudlet' : res[i].key, '@id' : res[i].value}
            }
            callback(null,  respObj, HTTPStatus.OK)
         }
      });
   }
};


var putSub = function (msg, callback) {

   var subscription = msg.json;


  dbc.hasMember(subscription, 'objectid');
  dbc.hasMember(subscription, 'type');
  dbc.hasMember(subscription, '_revision' );

  var cloudlet = getCloudlet(msg.path);
  var subId    = getSubId(msg.path);

  var dbName = cloudlet + '+' + subId;

  db.get(dbName, function (err, db_body) {

      var revisionParts = subscription['_revision'].split('-');
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

module.exports.init                        = init;
module.exports.evaluateMessage             = evaluateMessage;
module.exports.getSub                      = getSub;
module.exports.getSubscriptions            = getSubscriptions;
module.exports.addSSEConnection            = addSSEConnection;





