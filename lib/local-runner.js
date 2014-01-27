/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

var notifApi = require('./main.js')

// data_api_mong_sub_q 	=> notif_api_mong_sub_q
// 
//
//

var params = {
   mongrel_sub_q       	: {spec:'tcp://127.0.0.1:48501', id:'mongrel_sub_q_data_1'      },
   notif_api_mong_sub_q : {spec:'tcp://127.0.0.1:48500', id:'notif_api_mong_sub_q_data_1'},
   logger_params : {
      'path'     : '/opt/openi/cloudlet_platform/logs/data_api',
      'log_level': 'debug',
      'as_json'  : false
   }
}


notifApi(params)