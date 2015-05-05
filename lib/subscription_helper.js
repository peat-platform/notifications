/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the APACHE2 license.
 */


'use strict';

var dbc         = require('dbc');
var openiLogger = require('openi-logger');
var couchbase   = require('couchbase');
var openiUtils  = require('openi-cloudlet-utils');
var zmq         = require('m2nodehandler');
var http        = require('http');
var https       = require('https');
var loglet      = require('loglet');
var GCM         = require('gcm').GCM;
var HTTPStatus  = require('http-status');

loglet = loglet.child({component: 'notifications'});

var gcm;
var logger;
var sendToMongrel2;
var sendToCommunications;

var cluster = null;
var bucket  = null;
var dbs     = {};

var sse_connections = {};

var init = function (config) {

   sendToMongrel2       = zmq.sender(config.mongrel_handler.sink);
   sendToCommunications = zmq.sender(config.comms.sink);

   if (logger == undefined) {
      logger = openiLogger(config.logger_params);
   }

   gcm = new GCM("AIzaSyBZx2ZhdYDskEQ95HR7uKIeEEiCCzTYQWA");

   if (cluster == undefined) {
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

var getCouchbaseError = function (err, documentName, rest_uuid) {
   if (err) {
      loglet.error(err);
   }
   switch (err.code) {
      case 13:
         return 'Entity with that id does not exist';

      case 12:
         if (0 === documentName.indexOf('t_')) {
            return 'OPENi Type already exists (' + rest_uuid + ').';
         }
         return 'Incorrect revision number provided';

      default:
         return 'Reason unknown';

   }
};

var sendEndpointNotification = function (msg) {
   var sub = msg.value;

   dbc.hasMember(sub, 'endpoint');

   var req = null;

   var url = sub.endpoint.split('/');

   //check for presence of colon (http://, https://) and set hostname accordingly
   var hostname = (url[0].indexOf(':') >= 0) ? url[2] : url[0];
   //same check but setting path instead of hostname
   var path = (url[0].indexOf(':') >= 0) ? url.slice(3, url.length).join('/') : url.slice(1, url.length).join('/');

   var options = {
      hostname : '127.0.0.1',
      port     : 6000,
      path     : '/',
      method   : 'GET'
   };

   if (undefined !== sub.endpoint) {

      var endpoint = sub.endpoint;
      if (endpoint.indexOf('https') !== -1) {
         options.port = 443;
         options.hostname = endpoint.replace('https://', '');
         req = https.request(options, function (res) {
         })
      }
      else if (endpoint.indexOf('http') !== -1) {
         req = http.request(options, function (res) {
         })
      }
      else {
         req = http.request(options, function (res) {
         });
      }
      req.end();

      req.on('error', function (e) {
         console.error(e);
      });
   }
};

var sendGCM = function (msg) {

   var subscription = msg.value;

   var message = {
      registration_id: subscription.endpoint,
      collapse_key   : 'openi_notification',
      tty            : 600,
      'data.cloudlet': subscription.cloudletid,
      'data.type'    : subscription.typeid,
      'data.date'    : new Date().getTime(),
      'data.object'  : msg.objectId
   };

   gcm.send(message, function (err, messageId) {
      if (err) {
         logger.log("GCM: Something has gone wrong!");
      }
      else {
         logger.log("GCM: Sent with message ID: ", messageId);
      }
   });
};

var addSSEConnection = function (msg) {
   var subParam = msg.path.replace('/sse/', '');
   var subIds   = subParam.split('+');

   for (var i = 0; i < subIds.length; i++) {

      sse_connections[subIds[i]] = {uuid: msg.uuid, connId: msg.connId};
   }
};

var sendSSE = function (msg) {
   var conn = sse_connections[msg.subId];

   if (undefined !== conn) {
      var body = 'data: ' + JSON.stringify(msg) + '\n\n';
      sendToMongrel2.send(conn.uuid, conn.connId, zmq.status.OK_200, zmq.standard_headers.stream, body)
   }
};

var processSubscription = function (msg) {
   var object       = msg.key;
   var subscription = msg.value;

   switch (subscription.notification_type.toLowerCase()) {
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

var checkPermissions = function (msg, callback, success_function) {

   if (openiUtils.isTypeId(msg.database) || openiUtils.isAttachmentId(openiUtils.extractAttachmentId(msg.database))) {
      success_function()
   }
   else {

      var cloudlet_id = msg.token.user_id;
      var third_party = msg.token.context;

      var key = third_party + "+" + cloudlet_id;

      dbs['permissions'].get(key, function (err, db_body) {

         if (err) {
            if(err.code === 13){
               callback(null, {'error': 'No Permissions exist to allow subscription to this cloudlet.'}, HTTPStatus.INTERNAL_SERVER_ERROR);
            }
            loglet.error(err);
            console.log(err)
            callback(null, {'error': 'Database Error'}, HTTPStatus.INTERNAL_SERVER_ERROR);
         }
         else {
            var type_id = msg.json['typeid'];

            if (undefined === db_body.value._current.perms['@types'][type_id]) {
               callback(null, {'error': 'Unauthorised Access to type/object'}, HTTPStatus.UNAUTHORIZED);
               return
            }

            var read_a   = db_body.value._current.perms['@types'][type_id]['@app_level'].read;
            var read_b   = db_body.value._current.perms['@types'][type_id]['@cloudlet_level'].read;

            var read   = (read_a || read_b  );

            if (read) {
               success_function()
            }
            else {
               callback(null, {'error': 'Permission Denied: Read access not permitted'}, HTTPStatus.UNAUTHORIZED);
            }
         }
      });
   }
}


var postSub = function (msg, callback) {

   var subscription = msg.json;

   if(subscription === null || subscription === ""){
      error = {'error': 'Invalid subscription JSON'}
      callback(null,error,HTTPStatus.BAD_REQUEST)
   }

   checkPermissions(msg, callback, function() {

      //All properties lowercase for subscription JSON.
      dbc.hasMember(subscription, 'cloudletid');
      dbc.hasMember(subscription, 'typeid');
      dbc.hasMember(subscription, 'notification_type');
      dbc.conditionalHasMember(subscription, 'endpoint', (subscription.notification_type.toLowerCase() === 'notification' || subscription.notification_type.toLowerCase() === 'gcm'))

      var error = null

      if ( !openiUtils.isCloudletId(subscription.cloudletid) ) {
         error = { 'error': ' "cloudletid" is not a valid ID' }
         callback(null, error, HTTPStatus.BAD_REQUEST)
      }
      else if ( !openiUtils.isTypeId(subscription.typeid) ) {
         error = { 'error': ' "typeid" is not a valid ID' }
         callback(null, error, HTTPStatus.BAD_REQUEST)
      }

      subscription._date_created = new Date().toJSON();
      subscription._date_modified = new Date().toJSON();

      var subId = 's_' + openiUtils.hash(subscription);
      var cloudlet = openiUtils.extractCloudletId(msg.path);

      if ( null === cloudlet || undefined === cloudlet ) {
         //CamelCase for msg property
         cloudlet = msg.cloudletId
      }

      subscription._id = cloudlet + '/' + subId;

      var dbName = cloudlet + '+' + subId;
      if ( error === null ) {
         bucket.insert(dbName, subscription, function (err, result) {

            if ( err ) {
               logger.log('error', err);
               loglet.error(err);
               var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
               callback(null,
                  { 'error': 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
                  httpCode)
            }
            else {
               callback(null, { 'id': subId }, HTTPStatus.CREATED)
            }
         })
      }
   });
};


/**
 * Get subscriptions for update object/cloudlet trigger sent from DAO
 * @param msg
 */
var getSubscriptions = function (msg) {
   msg.count    = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
   msg.skip     = (typeof msg.skip !== 'number' || isNaN(msg.skip)) ? 0 : msg.skip;
   msg.startkey = typeof msg.startkey !== 'string' ? '' : msg.startkey;
   var endkey   = (msg.objectId !== undefined) ? [msg.cloudletId, msg.objectId] : [msg.cloudletId, null]

   var ViewQuery = couchbase.ViewQuery;
   var query = ViewQuery.from('subscription_views', 'subs')
      .skip(msg.skip)
      .limit(msg.count)
      .stale(ViewQuery.Update.BEFORE)
      .id_range([msg.cloudletId, null], endkey);

   if (undefined !== msg.reduce && msg.reduce) {
      query.reduce(msg.reduce)
   }
   else {
      query.reduce(false)
   }

   if (undefined !== msg.group_level) {
      query.group(msg.group_level)
   }
   delete query.options.group;

   bucket.query(query, function (err, res) {


      if (err) {
         loglet.error(err);
      }

      if (res !== null) {
         for (var i = 0; i < res.length; i++) {
            res[i].subId = res[i].id.split('+')[1];
            res[i].objectId = msg.objectId;
            processSubscription(res[i])
         }
      }
   });
};


var getSub = function (msg, callback) {

   dbc.hasMember(msg, 'path');

   var cloudlet = msg.cloudletId;
   var subId = getSubId(msg.path);

   if (getPathSize(msg.path) > 5) {
      var dbName = cloudlet + '+' + subId;

      bucket.get(dbName, function (err, result) {

         if (err) {
            logger.log('error', err);
            loglet.error(err);
            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
            callback(null,
               {'error': 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName)},
               httpCode)
         }
         else if (result === null) {
            callback(null,
               {'error': 'Not Found'},
               HTTPStatus.NOT_FOUND)
         }
         else {
            var subscription = result.value;
            subscription['_revision'] = result.cas['0'] + '-' + result.cas['1'];

            callback(null, subscription, HTTPStatus.OK)
         }
      })
   }
   else {
      msg.count = (typeof msg.count !== 'number' || isNaN(msg.count) || msg.count > 30) ? 30 : msg.count;
      msg.skip = (typeof msg.skip !== 'number' || isNaN(msg.skip)) ? 0 : msg.skip;
      msg.startkey = typeof msg.startkey !== 'string' ? '' : msg.startkey;

      var ViewQuery = couchbase.ViewQuery;

      if(msg.path.indexOf('subscriber') > -1){
         var view = 'subscribers'
      }
      else {
         view = 'subs'
      }

      var query = ViewQuery.from('subscription_views', view)
         .skip(msg.skip)
         .limit(msg.count)
         .stale(ViewQuery.Update.BEFORE)
         .range([cloudlet, null], [cloudlet+"^",null], true);


      if (undefined !== msg.reduce && msg.reduce) {
         query.reduce(msg.reduce)
      }
      else {
         query.reduce(false)
      }

      if (undefined !== msg.group_level) {
         query.group(msg.group_level)
      }
      delete query.options.group;

      bucket.query(query, function (err, res) {

         if (err) {
            loglet.error(err);
         }

         var respObj = [];
         if (res === null) {
            callback(null, {'error': 'Query responce was null or undefined'}, HTTPStatus.INTERNAL_SERVER_ERROR)
         }
         else {
            for (var i = 0; i < res.length; i++) {
               var key = res[i].key[0] !== undefined ? res[i].key[0] : res[i].key;
               respObj[i] = {'@cloudlet': key, '@id': res[i].value}
            }
            callback(null, respObj, HTTPStatus.OK)
         }
      });

   }
};


var putSub = function (msg, callback) {

   var subscription = msg.json;


   dbc.hasMember(subscription, 'objectid');
   dbc.hasMember(subscription, 'notification_type');
   dbc.hasMember(subscription, '_revision');

   var cloudlet = getCloudlet(msg.path);
   var subId = getSubId(msg.path);

   var dbName = cloudlet + '+' + subId;

   bucket.get(dbName, function (err, db_body) {

      if (err) {
         loglet.error(err);
      }

      var revisionParts = subscription['_revision'].split('-');
      var sub = db_body.value;


      if (db_body.cas['0'] !== revisionParts[0] && db_body.cas['1'] !== revisionParts[1]) {
         callback(null, {'error': 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      if (db_body.value === subscription
         && db_body.cas['1'] !== revisionParts[1]) {
         callback(null, {'error': 'Entity already updated'},
            HTTPStatus.CONFLICT);
         return;
      }

      sub.objectid          = subscription.objectid;
      sub.notification_type = subscription.notification_type;
      sub.endpoint          = subscription.endpoint;
      sub.data              = subscription.data;

      sub._date_modified = new Date().toJSON();

      bucket.set(dbName, sub, {cas: db_body.cas}, function (err, result) {

         if (err) {
            logger.log('error', err);
            loglet.error(err);

            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;

            callback(null, {'error': 'Error updating entity: ' + getCouchbaseError(err)},
               httpCode)
         }
         else {
            callback(null, {'id': subscription.id}, HTTPStatus.OK)
         }
      })
   })
};


var evaluateMessage = function (msg, callback) {

   switch (msg.headers.METHOD) {
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

module.exports.init             = init;
module.exports.evaluateMessage  = evaluateMessage;
module.exports.getSub           = getSub;
module.exports.getSubscriptions = getSubscriptions;
module.exports.addSSEConnection = addSSEConnection;





