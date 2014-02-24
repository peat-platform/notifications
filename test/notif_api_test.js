'use strict';

var base_path      = require('./basePath.js');
var notif_api   = require(base_path + '../lib/helper.js');


notif_api.init({
   'path'      : 'build/data_api',
   'log_level' : 'debug',
   'as_json'   : false
});

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports['testAccess'] = {
  setUp: function(done) {
    // setup here
    this.testCorrectName = "/notif/subscription/aaaa";
    this.testCorrectName1 = "/notif/subscription/bbbb";
    this.testCorrectName2 = "/notif/subscription/cccc";
    this.testCorrectName3 = "/notif/subscription/dddd";
    this.testIncorrectName = "/notif/subscription";
    done()
  },
  'incorrect format name': function(test) {
    // tests here
    var actual = notif_api.getAccess(this.testIncorrectName);

    test.deepEqual(actual, "subscription", "string returned not expected");
    test.done()
  },
  'correct cloudlet name'  : function(test) {
    // tests here
    var actual = notif_api.getAccess(this.testCorrectName);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "subscription", "string returned not expected");
    test.done()
  },
  'correct object name'  : function(test) {
    // tests here
    var actual = notif_api.getAccess(this.testCorrectName1);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "subscription", "string returned not expected");
    test.done()
  },
  'correct objectField name'  : function(test) {
    // tests here
    var actual = notif_api.getAccess(this.testCorrectName2);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "subscription", "string returned not expected");
    test.done()
  },
  'correct photo_type+oids name'  : function(test) {
    // tests here
    var actual = notif_api.getAccess(this.testCorrectName3);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "subscription", "string returned not expected");
    test.done()
  }
};

exports['testGetCloudlet'] = {
  setUp: function(done) {
    // setup here
    this.testCorrectName = "/notif/subscription/aaaa";
    this.testCorrectName1 = "/notif/subscription/bbbb";
    this.testCorrectName2 = "/notif/subscription/cccc";
    this.testCorrectName3 = "/notif/subscription/dddd";
    this.testIncorrectName = "/notif/subscription";
    done()
  },
  'incorrect format name': function(test) {
    // tests here
    var actual = notif_api.getCloudlet(this.testIncorrectName);
    test.equal(actual, undefined, "should return null");
    test.done()
  },
  'correct cloudlet name'  : function(test) {
    // tests here
    var actual = notif_api.getCloudlet(this.testCorrectName);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "aaaa", "string returned not expected");
    test.done()
  },
  'correct object name'  : function(test) {
    // tests here
    var actual = notif_api.getCloudlet(this.testCorrectName1);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "bbbb", "string returned not expected");
    test.done()
  },
  'correct objectField name'  : function(test) {
    // tests here
    var actual = notif_api.getCloudlet(this.testCorrectName2);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "cccc", "string returned not expected");
    test.done()
  },
  'correct photo_type+oids name'  : function(test) {
    // tests here
    var actual = notif_api.getCloudlet(this.testCorrectName3);

    test.notEqual(actual, null, "should return an object");
    test.deepEqual(actual, "dddd", "string returned not expected");
    test.done()
  }
};

exports['testGetAction'] = {
   setUp                              : function (done) {
      // setup here
      done()
   },
   'correct format path, get method'  : function (test) {
      // tests here
      var testInputPath = "GEt"
      var actual = notif_api.getAction(testInputPath)

      test.equals(actual, "GET", "should be the HTTP GET method.")
      test.done();
   },
   'correct format path, put method'  : function (test) {
      // tests here
      var testInputPath = "Put"
      var actual = notif_api.getAction(testInputPath)

      test.equals(actual, "PUT", "should be the HTTP PUT method.")
      test.done();
   },
   'correct format path, post method' : function (test) {
      // tests here
      var testInputPath = "poST"
      var actual = notif_api.getAction(testInputPath)

      test.equals(actual, "PUT", "should be the HTTP POST method.")
      test.done();
   },
   // 'correct format path, echo method'  : function(test) {
   //     // tests here
   //     var testInputPath = "this is a echo request"
   //     var actual        = notif_api.getAction(testInputPath)

   //     test.equals(actual, "ECHO", "should be the HTTP ECHO method.")
   //     test.done();
   // },
   'incorrect format path'            : function (test) {
      // tests here
      var testInputPath = "this is a request without a method"
      var actual = notif_api.getAction(testInputPath)

      test.equals(actual, null, "should have returned null")
      test.done();
   }
};


exports['testPassThrough'] = {
   'correct format'                   : function (test) {
      // tests here
      var testInput = {
         action : 'put',
         uuid   : '123123',
         connId : '345345345',
         body   : 'body text'
      }
      var actual = notif_api.passThrough(testInput);

      test.equals(actual.status, 200, "should be 200")
      test.equals(actual.body, '{"action":"put","uuid":"123123","connId":"345345345","body":"body text"}', "should match")
      test.equals(actual.headers['Content-Type'], 'application/json; charset=utf-8', "should match")
      test.done();
   },
   'correct format path, post method' : function (test) {

      var testInput = {
         action : false,
         uuid   : '123123',
         connId : '345345345',
         body   : 'body text'
      }
      var actual = notif_api.passThrough(testInput);

      console.log(actual)

      test.equals(actual, null, "should be null.")
      test.done();
   }
};


exports['testProcessMongrel2'] = {

   'correct format'   : function (test) {
      // tests here
      var testInput = {
         action  : 'get',
         uuid    : '123123',
         connId  : '345345345',
         path    : '/notif/subscription/aaaa',
         headers : {
            METHOD : 'GET'
         }
      }

      var actual = notif_api.processMongrel2Message(testInput);


      test.equals(actual.uuid, '123123', "should be '123123'")
      test.equals(actual.connId, '345345345', "should be 345345345")
      test.equals(actual.action, 'GET', "should be GET")
      test.equals(actual.cloudlet, 'aaaa', "should be aaaa")
      test.equals(actual.access, 'subscription', "should be subscription")
      test.done();
   },
   'incorrect format' : function (test) {
      // tests here
      var testInput = {
         action  : 'put',
         uuid    : '123123',
         connId  : '345345345',
         path    : '/notif/subscription',
         headers : {
            METHOD : 'GET'
         }
      }

      var actual = notif_api.processMongrel2Message(testInput);


      test.equals(actual.uuid, '123123', "should be '123123'")
      test.equals(actual.connId, '345345345', "should be 345345345")
      test.equals(actual.action, 'GET', "should be GET")
      test.equals(actual.cloudlet, 'aaaa', "should be aaaa")
      test.equals(actual.access, 'subscription', "should be subscription")
      test.done();
   }

};

