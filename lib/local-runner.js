/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

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
   }
}


notifApi(params)