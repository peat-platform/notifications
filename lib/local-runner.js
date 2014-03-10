/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

var notifApi = require('./main.js');


var config = {

   subs_sink : {spec : 'tcp://127.0.0.1:49500', bind : true, type : 'sub', subscribe : '', id : 'NotificationReceiver'},
   subs_broadcaster : {spec : 'tcp://127.0.0.1:49501', bind : true, type : 'pub', id : 'NotificationBroadcaster'},

   mongrel_handler : {
      source : { spec : 'tcp://127.0.0.1:49503', id : 'e', bind : false, type : 'pull', isMongrel2 : true },
      sink : { spec : 'tcp://127.0.0.1:49504', id : 'NotifRec', bind : false, type : 'pub', isMongrel2 : true }
   },
   logger_params   : {
      'path'      : '/opt/openi/cloudlet_platform/logs/data_api',
      'log_level' : 'debug',
      'as_json'   : false
   }
};


notifApi(config);