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
//var async        = require('async');
var couchbase    = require('couchbase');
var openiUtils   = require('openi-cloudlet-utils');
var zmq          = require('m2nodehandler');
var gcm          = require('gcm');
var http         = require('http');
var https        = require('https');
var loglet       = require('loglet');
var GCM          = require('gcm').GCM;
var gcm;

loglet = loglet.child({component: 'notifications'});

var HTTPStatus  = require('http-status');

var logger;
var sendToMongrel2;
var sendToCommunications;

var cluster  = null;
var bucket   = null;
var dbs      = {};


var sse_connections = {};

var init = function (config) {

   sendToMongrel2       = zmq.sender(config.mongrel_handler.sink);
   sendToCommunications = zmq.sender(config.comms.sink);

   if(logger == undefined) {
      logger = openiLogger(config.logger_params);
   }

   gcm = new GCM("AIzaSyBZx2ZhdYDskEQ95HR7uKIeEEiCCzTYQWA");

   if(cluster == undefined) {
      cluster = new couchbase.Cluster('couchbase://localhost');
   }

   dbs['objects']     = cluster.openBucket('objects');
   dbs['types']       = cluster.openBucket('types');
   dbs['attachments'] = cluster.openBucket('attachments');
   dbs['permissions'] = cluster.openBucket('permissions');

   bucket = dbs['objects'];
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
   if(err) {
      loglet.error(err);
   }
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
         })
      }
      else if (endpoint.indexOf('http') !== -1) {
         req = http.request(options,function(res){
         })
      }
      else {
         req = http.request(options,function(res) {
         });
      }
      req.end();

      req.on('error', function(e) {
         console.error(e);
      });
   }
};

var sendGCM = function(msg) {

   var object       = msg.key;
   var subscription = msg.value;

   var message = {
      registration_id: subscription.endpoint, // required
      collapse_key: 'openi_notification',
      tty: 600,
      'data.cloudlet': subscription.cloudletid,
      'data.value': 'Test'
   };

   gcm.send(message, function(err, messageId){
      if (err) {
         logger.log("GCM: Something has gone wrong!");
      } else {
         logger.log("GCM: Sent with message ID: ", messageId);
      }
   });
}

var addSSEConnection = function(msg){
   var subParam = msg.path.replace('/sse/', '');

   var subIds = subParam.split('+');

   for(var i = 0 ; i < subIds.length; i++) {

      sse_connections[subIds[i]] = {uuid: msg.uuid, connId: msg.connId};
   }
};

var sendSSE = function(msg){

   var conn = sse_connections[msg.subId];

   if (undefined !== conn){
      var body = 'data: ' + JSON.stringify(msg) + '\n\n';
      sendToMongrel2.send(conn.uuid, conn.connId, zmq.status.OK_200, zmq.standard_headers.stream, body)
   }
};

var processSubscription = function (msg) {

   var object       = msg.key;
   var subscription = msg.value;

   switch(subscription.notification_type.toLowerCase()) {
   case 'email':
      sendToCommunications.send(subscription);
      return;
   case 'notification':
      sendEndpointNotification(msg);
      return;
   case 'sms':
      sendToCommunications.send(subscription);
      return;
   case 'sse':
      sendSSE(msg);
      return;
   case 'gcm':
      sendGCM(msg);
      return;
   }

};

var checkPermissions = function(msg, callback) {

   if (openiUtils.isTypeId(msg.database) || openiUtils.isAttachmentId(openiUtils.extractAttachmentId(msg.database))){
      success_function()
   }
   else{

      var cloudlet_id = msg.token.user_id
      var third_party = msg.token.context

      var key         = third_party + "+" + cloudlet_id

      dbs['permissions'].get(key, function (err, db_body) {


         if(err) {
            loglet.error(err);
            callback(null, { 'error': 'permission denied' }, HTTPStatus.UNAUTHORIZED);
         }
         else{
            var type_id = msg.json['typeid']

            if (undefined === db_body.value._current.perms['@types'][type_id]){
               callback(null, { 'error': 'permission denied' }, HTTPStatus.UNAUTHORIZED);
               return
            }
            var create_a = db_body.value._current.perms['@types'][type_id]['@app_level'].create
            var create_b = db_body.value._current.perms['@types'][type_id]['@cloudlet_level'].create
            var read_a   = db_body.value._current.perms['@types'][type_id]['@app_level'].read
            var read_b   = db_body.value._current.perms['@types'][type_id]['@cloudlet_level'].read
            var update_a = db_body.value._current.perms['@types'][type_id]['@app_level'].update
            var update_b = db_body.value._current.perms['@types'][type_id]['@cloudlet_level'].update
            var delete_a = db_body.value._current.perms['@types'][type_id]['@app_level'].delete
            var delete_b = db_body.value._current.perms['@types'][type_id]['@cloudlet_level'].delete

            var create = (create_a || create_b)
            var read   = (read_a   || read_b  )
            var update = (update_a || update_b)
            var delet  = (delete_a || delete_b)

            if (read){
               return true
            }
            else{
               callback(null, { 'error': 'permission denied' }, HTTPStatus.UNAUTHORIZED);
            }
         }
      });
   }
}


var postSub = function (msg, callback) {

	var subscription = msg.json;

   checkPermissions(msg, callback);

   //Permission is msg.token.user_id + '+' + msg.token.context

   //permission _current.perms.@types.[type]

   dbc.hasMember(subscription, 'cloudletid');
   dbc.hasMember(subscription, 'notification_type');
   dbc.conditionalHasMember(subscription, 'endpoint', (subscription.notification_type.toLowerCase() === 'notification' || subscription.notification_type.toLowerCase() === 'gcm') )

   subscription._date_created  = new Date().toJSON();
   subscription._date_modified = new Date().toJSON();


   var subId         = 's_' + openiUtils.hash(subscription);
   var cloudlet      = openiUtils.extractCloudletId(msg.path);
   if (null === cloudlet | undefined === cloudlet){
      cloudlet = msg.cloudletId
   }
   var objectRestURL = 'http://' + msg.headers.host + '/api/v1/subscription/' + cloudlet + '/' + subId;

   subscription._id = objectRestURL;

   var dbName = cloudlet + '+' + subId;

   bucket.insert(dbName, subscription, function (err, result) {

      if (err) {
         logger.log('error', err );
         loglet.error(err);
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
var getSubscriptions = function (msg) {
   msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
   msg.skip     = (typeof msg.skip  !== 'number' || isNaN(msg.skip))                    ? 0  : msg.skip;
   msg.startkey = typeof msg.startkey !== 'string' ? '' : msg.startkey;

   var endkey = (msg.objectId !== undefined) ? [msg.cloudletId,msg.objectId] : [msg.cloudletId,null]


   var params = {
      startkey_docid : msg.startkey,
      skip           : msg.skip,
      stale          : false,
      limit          : msg.count,
      startkey       : [msg.cloudletId,null],
      endkey         : endkey
   };

   var ViewQuery = couchbase.ViewQuery;
   var query = ViewQuery.from('subscription_views', 'subs')
      .skip(msg.skip)
      .limit(msg.count)
      .stale(ViewQuery.Update.BEFORE)
      .id_range([msg.cloudletId,null], endkey)

   if (undefined !== msg.reduce && msg.reduce ) {
      query.reduce(msg.reduce)
   }
   else {
      query.reduce(false)
   }

   if (undefined !== msg.group_level ) {
      query.group(msg.group_level)
   }
   delete query.options.group

   bucket.query(query, function (err, res) {

      var respObj = {
         "meta": msg.meta,
         result: []
      };

      if(err) {
         loglet.error(err);
      }
      var respObj = [];
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

   var cloudlet = msg.cloudletId
   var subId    = getSubId(msg.path)

   if( getPathSize(msg.path) > 5 )
   {
      var dbName = cloudlet + '+' + subId;

      bucket.get(dbName, function (err, result) {

         if (err) {
            logger.log('error', err );
            loglet.error(err);
            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
            callback(null,
               { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
               httpCode)
         }
         else if (result === null){
            callback(null,
               {'error' : 'Not Found'},
               HTTPStatus.NOT_FOUND)
         } else {
            var subscription = result.value;
            subscription['_revision'] = result.cas['0'] + '-' + result.cas['1'];

            callback(null, subscription , HTTPStatus.OK)
         }
      })
   }
   else {
      msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
      msg.skip     = (typeof msg.skip  !== 'number' || isNaN(msg.skip))                    ? 0  : msg.skip;
      msg.startkey = typeof msg.startkey !== 'string' ? '' : msg.startkey;

      var params = {
         startkey_docid : msg.startkey,
         skip           : msg.skip,
         stale          : false,
         limit          : msg.count,
         startkey       : cloudlet,
         endkey         : cloudlet
      };

      var ViewQuery = couchbase.ViewQuery;

      var query = ViewQuery.from('subscription_views', 'subs')
         .skip(msg.skip)
         .limit(msg.count)
         .stale(ViewQuery.Update.BEFORE)
         .id_range(cloudlet, cloudlet)

      if (undefined !== msg.reduce && msg.reduce ) {
         query.reduce(msg.reduce)
      }
      else {
         query.reduce(false)
      }

      if (undefined !== msg.group_level ) {
         query.group(msg.group_level)
      }
      delete query.options.group

      bucket.query(query, function (err, res) {

         var respObj = {
            "meta": msg.meta,
            result: []
         };

         if(err) {
            loglet.error(err);
         }
         var respObj = [];
         if (res === null) {
            callback(null,  { 'error' : 'Query responce was null or undefined' }, HTTPStatus.INTERNAL_SERVER_ERROR)
         }
         else {
            for (var i = 0; i < res.length; i++) {
               respObj[i] = {'@cloudlet': res[i].key, '@id': res[i].value}
            }
            callback(null, respObj, HTTPStatus.OK)
         }
      });

      /*bucket.view('subscription_views', 'subs_by_cloudletId', params).query(function(err, res)
      {
         if(err) {
            loglet.error(err);
         }
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
      });*/
   }
};


var putSub = function (msg, callback) {

   var subscription = msg.json;


   dbc.hasMember(subscription, 'objectid');
   dbc.hasMember(subscription, 'notification_type');
   dbc.hasMember(subscription, '_revision' );

   var cloudlet = getCloudlet(msg.path);
   var subId    = getSubId(msg.path);

   var dbName = cloudlet + '+' + subId;

   bucket.get(dbName, function (err, db_body) {

      if(err) {
         loglet.error(err);
      }

      var revisionParts = subscription['_revision'].split('-');
      var sub = db_body.value;


      if (db_body.cas['0'] !== revisionParts[0] && db_body.cas['1'] !== revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      if (db_body.value === subscription
            && db_body.cas['1'] !== revisionParts[1]){
         callback(null, { 'error' : 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      sub.objectid = subscription.objectid;
      sub.notification_type     = subscription.notification_type;
      sub.endpoint = subscription.endpoint;
      sub.data     = subscription.data;

      sub._date_modified = new Date().toJSON();


      bucket.set(dbName, sub, {cas: db_body.cas}, function (err,result) {

         if (err) {
            logger.log('error', err );
            loglet.error(err);

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





