/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var zmq          = require('m2nodehandler');
var dbc          = require('dbc')
var openiLogger  = require('openi-logger')

var cloudlet = {'aaaa':{'me':{'age':23,'name':'Castro Hebert','gender':'male','company':'Bulljuice','email':'castrohebert@bulljuice.com','phone':'+1 (836) 512-3958','address':'333 Bergen Court, Romeville, Connecticut, 672','about':'Duis cillum et aute irure consectetur ullamco ad non exercitation mollit voluptate. Ut aute mollit duis nostrud labore cillum sint elit Lorem. Do pariatur dolore ex consectetur esse aliquip adipisicing ea nulla anim consectetur ex. Quis aute officia aliqua labore irure Lorem. Ullamco eiusmod est tempor eiusmod ipsum officia culpa culpa sunt eu labore ullamco qui.\r\n','friends':[{'id':0,'name':'Maricela Rogers'},{'id':1,'name':'Bridgett James'},{'id':2,'name':'Hopper Stone'}],'subscriptions':[{'facebook':[{'email':{'email':false,'sms':false,'ping':true,'post':false}},{'address':{'email':false,'sms':true,'ping':true,'post':false}},{'password':{'email':true,'sms':true,'ping':true,'post':false}}]},{'twitter':[{'email':{'email':false,'sms':false,'ping':true,'post':false}},{'chat':{'email':true,'sms':true,'ping':true,'post':true}},{'password':{'email':false,'sms':true,'ping':true,'post':true}}]},{'myspace':[{'chant':{'email':false,'sms':true,'ping':true,'post':true}},{'password':{'email':true,'sms':true,'ping':true,'post':false}},{'friend':{'email':false,'sms':false,'ping':false,'post':true}}]}]}},'bbbb':{'me':{'age':39,'name':'Dollie Shields','gender':'female','company':'Paragonia','email':'dollieshields@paragonia.com','phone':'+1 (814) 506-2738','address':'261 Chester Street, Saticoy, Alabama, 3090','about':'Reprehenderit nisi occaecat incididunt aliquip sunt do id veniam. Tempor nisi labore cillum fugiat id eiusmod consequat irure tempor cupidatat ipsum aute. Exercitation dolore ut consequat occaecat cupidatat incididunt amet. Ipsum duis commodo dolor Lorem. Tempor quis non consequat veniam aliquip velit nulla. Laborum occaecat occaecat dolore amet cupidatat irure et fugiat exercitation cillum officia ex nulla velit. Commodo incididunt sit commodo sit ullamco laborum.\r\n','friends':[{'id':0,'name':'Robert Le'},{'id':1,'name':'Dorthy Barnett'},{'id':2,'name':'Mullins Franks'}],'subscriptions':[{'facebook':[{'friend':{'email':false,'sms':false,'ping':false,'post':true}},{'chat':{'email':true,'sms':false,'ping':true,'post':true}},{'password':{'email':true,'sms':true,'ping':false,'post':true}}]},{'tumblr':[{'chat':{'email':true,'sms':false,'ping':false,'post':false}},{'password':{'email':true,'sms':false,'ping':false,'post':true}},{'email':{'email':true,'sms':false,'ping':false,'post':false}}]},{'myspace':[{'email':{'email':false,'sms':true,'ping':false,'post':false}},{'chat':{'email':true,'sms':true,'ping':false,'post':false}},{'password':{'email':true,'sms':true,'ping':false,'post':true}}]}]}},'cccc':{'me':{'age':20,'name':'Elsa Kinney','gender':'female','company':'Katakana','email':'elsakinney@katakana.com','phone':'+1 (897) 557-3176','address':'154 Midwood Street, Kennedyville, Minnesota, 4912','about':'Irure culpa laborum do do laboris consequat deserunt consectetur aute. Ut do duis incididunt quis id do ex deserunt ea ut officia dolore. Exercitation voluptate dolor qui ullamco nisi aliqua nisi. Irure occaecat eu commodo qui fugiat culpa labore. Cillum ea Lorem id sunt adipisicing labore ullamco consequat ut adipisicing duis. Veniam ipsum nulla ullamco reprehenderit. Excepteur Lorem veniam magna nulla nostrud aliquip aute et non duis sint.\r\n','friends':[{'id':0,'name':'Burton Patton'},{'id':1,'name':'Bass Craft'},{'id':2,'name':'Wallace Hughes'}],'subscriptions':[{'tumblr':[{'email':{'email':true,'sms':false,'ping':true,'post':true}},{'chat':{'email':false,'sms':true,'ping':false,'post':true}},{'friend':{'email':true,'sms':false,'ping':false,'post':false}}]},{'myspace':[{'email':{'email':true,'sms':true,'ping':false,'post':true}},{'chat':{'email':false,'sms':false,'ping':false,'post':false}},{'friend':{'email':true,'sms':true,'ping':true,'post':false}}]},{'twitter':[{'email':{'email':false,'sms':true,'ping':false,'post':true}},{'chat':{'email':false,'sms':false,'ping':true,'post':true}},{'friend':{'email':false,'sms':true,'ping':false,'post':false}}]}]}}}


var init = function(logger_params){
   this.logger = openiLogger(logger_params);
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

var getAction = function(method) {

   method  = method.toLowerCase()
   var res = null;

   switch(method){
   case 'post':
      res = 'PUT'
      break
   case 'put':
      res = 'PUT'
      break;
   case 'get':
      res = 'GET'
      break
   }


   return res
}

var getAccess = function (path) {

   var parts   = path.split('/')
   var namePos = 2;

   return parts[namePos]
}


var getCloudlet = function (path) {

   var parts   = path.split('/')
   var cletPos = 3;
   return parts[cletPos];

}


var processMongrel2Message = function (msg, callback) {

   this.logger.logMongrel2Message(msg)

   var notif_msg = {
      uuid         : msg.uuid,
      connId       : msg.connId,
      action       : getAction  (msg.headers['METHOD']),
      cloudlet     : getCloudlet(msg.path),
      access  : getAccess  (msg.path),
      object_data  : msg.json
   }

   //console.log(typeof notif_msg.object_data)
   //console.log(typeof msg.json)

   this.logger.log('debug', notif_msg)

   evaluateMethod(notif_msg,this.logger, function(response) {
      console.log('-----replying------')
      console.log(response)
      callback(response)
   })
}

var evaluateMethod = function (msg,logger, callback) {

   logger.log('debug', msg)

   dbc.assert(null !== msg, 'Message cannot be null')
   dbc.hasMember(msg, 'cloudlet')

   var status = zmq.status.OK_200
   var body   = {}
   //console.log('******' + cloudlet[msg.cloudlet] + '******')

   if (cloudlet[msg.cloudlet] != null) {

      body['result'] = 'success'
      body['data'] = cloudlet[msg.cloudlet]['me'][access]
   }
   else {
      body['result'] = 'failure'
   }

   callback(zmq.Response(status, zmq.header_json, body))

}

module.exports.init                   = init
module.exports.getAction              = getAction
module.exports.getAccess              = getAccess
module.exports.getCloudlet            = getCloudlet
module.exports.passThrough            = passThrough
module.exports.processMongrel2Message = processMongrel2Message




