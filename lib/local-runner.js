/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

var notifApi = require('./main.js');


var config = {

   notif_sink : {spec : 'tcp://127.0.0.1:49500', bind : true, type : 'sub', subscribe : '', id : 'NotifReceiver'},
   notif_broadcaster : {spec : 'tcp://127.0.0.1:49501', bind : true, type : 'pub', id : 'NotificationBroadcaster'},
   
   dao_sink        : { spec:'tcp://127.0.0.1:49999', bind:false, type:'push', id:'dao_sink' },
   mongrel_handler : {
      source    : { spec : 'tcp://127.0.0.1:49503', id : 'e', bind : false, type : 'pull', isMongrel2 : true },
      sink      : { spec : 'tcp://127.0.0.1:49504', id : 'NotifRec', bind : false, type : 'pub', isMongrel2 : true},
      subsource : { spec : 'tcp://127.0.0.1:49505', id : 'f', bind : false, type : 'pull', isMongrel2 : true },
      subsink   : { spec : 'tcp://127.0.0.1:49506', id : 'subRec', bind : false, type : 'pub', isMongrel2 : true }
   },
   comms           : {
      sink : { spec : 'tcp://127.0.0.1:49998', bind : false, type : 'push', id : 'communication_id' }
   },
   logger_params   : {
      'path'      : '/opt/openi/cloudlet_platform/logs/notification.log',
      'log_level' : 'debug',
      'as_json'   : false
   },
   trusted_security_framework_public_key: '-----BEGIN PUBLIC KEY-----\n'+
   'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKT8kGk6ZNo3sC4IIo29leRLVD23T2r0\n'+
   'vWXBEkk2pV42HsxKAmPs789AGHH9XwbGpD7FvrcBWWgb65v32Hg/NGkCAwEAAQ==\n'+
   '-----END PUBLIC KEY-----'
};


notifApi(config);