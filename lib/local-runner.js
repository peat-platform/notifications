/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

<<<<<<< HEAD
var notifApi = require('./main.js')


var params = {
   mongrel_sub_q        : {spec:'tcp://127.0.0.1:48501', id:'mongrel_sub_q_data_1'       },
   internal_sub_q       : {spec:'tcp://127.0.0.1:48511', id:'internal_sub_q_data_1'      },
   subsc_api_mong_sub_q : {spec:'tcp://127.0.0.1:48500', id:'subsc_api_mong_sub_q_data_1'},
   notif_mong_sub_q     : {spec:'tcp://127.0.0.1:48511', id:'notif_mong_sub_q_data_1'},
   logger_params : {
      'path'     : '/opt/openi/cloudlet_platform/logs/data_api',
      'log_level': 'debug',
      'as_json'  : false
=======
var notifApi = require('./main.js');


var config = {

   subs_sink        : {spec : 'tcp://127.0.0.1:49500', bind : true, type : 'sub', subscribe : '', id : 'NotificationReceiver'},
   subs_broadcaster : {spec : 'tcp://127.0.0.1:49501', bind : true, type : 'pub', id : 'NotificationBroadcaster'},

   mongrel_handler : {
      source : { spec : 'tcp://127.0.0.1:49503', id : 'e', bind : false, type : 'pull', isMongrel2 : true },
      sink   : { spec : 'tcp://127.0.0.1:49504', id : 'NotificationReceiver', bind : false, type : 'pub', isMongrel2 : true }
   },
   logger_params   : {
      'path'      : '/opt/openi/cloudlet_platform/logs/data_api',
      'log_level' : 'debug',
      'as_json'   : false
>>>>>>> 3d394e7c511da9f65ec2cc2d635e241ce1cac0af
   }
};


notifApi(config);
