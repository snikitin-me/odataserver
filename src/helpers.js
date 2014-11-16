// helpers.js
//------------------------------
//
// 2014-11-15, Jonas Colmsjö
//
//------------------------------
//
// Misc helpers fucntions
//
//
// Using Google JavaScript Style Guide
// http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml
//
//------------------------------



(function(self_, undefined) {

  var h = self_.helpers || {};
  var u = require('underscore');
  var crypto = require('crypto');
  var Writable = require('stream').Writable;

  var CONFIG = require('./config.js');

  // change to false to stop logging
  h.debug = false;
  h.info = true;
  h.noLogging = false;

  h.log = {

    debug: function(o) {
      if (h.debug && !h.noLogging) console.log('DEBUG: ' + o);
    },

    info: function(text) {
      if (h.info && !h.noLogging) console.log('INFO: ' + text);
    },

    log: function(text) {
      if (!h.noLogging) console.log(text);
    }
  };

  // converts a number to a string and pads it with zeros: pad(5,1) -> 00001
  // a - the number to convert
  // b - number of resulting characters
  h.pad = function(a, b) {
    return (1e15 + a + "").slice(-b);
  };


  // Calculate hash from a leveldb stream
  h.calcHash = function(leveldb, alg, enc, cb) {
    var hash = crypto.createHash(alg);

    hash.setEncoding(enc);

    leveldb.on('end', function() {
      hash.end();
      cb(hash.read());
    });

    // read all file and pipe it (write it) to the hash object
    leveldb.pipeReadStream(hash);
  };


  h.hashString = function(alg, enc, data) {
    var hashSum = crypto.createHash(alg);
    hashSum.update(data);
    return hashSum.digest(enc);
  };

  //
  // Leveldb Helpers
  // ----------------

  // Store data/blobs in chunks in the database. Keys have the following form:
  // key~rev#~chunk#
  // rev# and chunk# are 9 digits key~000000001~000000001
  //


  // Read keys into an array and process with callback
  // maximum 999.999.999 revisions and 999.999.999 chunks
  h.readKeys = function(leveldb, keyPrefix, cb) {

    var _keyStream = leveldb.createReadStream({
      start: keyPrefix + '~000000000',
      end: keyPrefix + '~999999999',
      limit: 999999999,
      reverse: false,
      keys: true,
      values: false
    });

    var _keys = [];

    _keyStream.on('data', function(data) {
      _keys.push(data);
    });

    _keyStream.on('error', function(err) {
      log.log('Error reading leveldb stream: ' + err);
    });

    _keyStream.on('close', function() {
      h.log.debug('_readKeys: ' + JSON.stringify(_keys));
      cb(_keys);
    });
  };

  // Read all chunks for file and process chunk by chunk
  // maximum 999.999.999 revisions and 999.999.999 chunks
  h.readValue = function(leveldb, keyPrefix, revision, cbData, cbEnd) {

    var _revision = pad(revision, 9);

    var _keyStream = leveldb.createReadStream({
      start: keyPrefix + '~' + _revision + '~000000000',
      end: keyPrefix + '~' + _revision + '~999999999',
      limit: 999999999,
      reverse: false,
      keys: false,
      values: true
    });

    _keyStream.on('data', function(data) {
      cbData(data);
    });

    _keyStream.on('error', function(err) {
      h.log.log('Error reading leveldb stream: ' + err);
    });

    _keyStream.on('close', function() {
      cbEnd();
    });
  };

  // Get the last revison of a key and run callback
  // -1 is used if the file does not exist
  h.getCurrentRev = function(leveldb, keyPrefix, revObj, cb) {

    var currentRevision = -1;

    h.readKeys(leveldb, keyPrefix, function(keys) {

      if (keys.length > 0) {
        var _revs = u.map(
          keys,
          function(k) {
            return k.slice(keyPrefix.length + 1, keyPrefix.length + 1 + 9);
          }
        );

        currentRevision = parseInt(u.max(_revs, function(r) {
          return parseInt(r);
        }));
      }

      h.log.debug('LevelDB.getCurrentRev: keyPrefix=' + keyPrefix + ', rev= ' +
        currentRevision);

      // Save revision and run callback
      revObj._currentRevision = currentRevision;
      cb(currentRevision);
    });
  };

  // format a key, revision and chunk: key~000000001~000000000
  h.formatKey = function(k, revNum, chunkNum) {
    return k + '~' + h.pad(revNum, 9) + '~' + h.pad(chunkNum, 9);
  };


  //
  // Stream that aggregates objects that are written into array
  // ---------------------------------------------------------

  h.arrayBucketStream = function(options) {
    // if new wasn't used, do it for them
    if (!(this instanceof arrayBucketStream))
      return new arrayBucketStream(options);

    // call stream.Writeable constructor
    Writable.call(this, options);

    this.data = [];
  };

  // inherit stream.Writeable
  h.arrayBucketStream.prototype = Object.create(Writable.prototype);

  // override the write function
  h.arrayBucketStream.prototype._write = function(chunk, encoding, done) {
    this.data.push(chunk);
    done();
  };

  h.arrayBucketStream.prototype.get = function() {
    return this.data;
  };

  h.arrayBucketStream.prototype.empty = function() {
    this.data = [];
  };

  // calculate account id from email
  h.email2accountId = function(email) {
    return h.hashString(CONFIG.ACCOUNT_ID.HASH_ALG,
                           CONFIG.ACCOUNT_ID.HASH_ENCODING,
                           CONFIG.ACCOUNT_ID.SECRET_SALT + email).slice(0,12);

  };

  // generate random string
  h.randomString = function(len) {
    try {
      var buf = crypto.randomBytes(256);
      var str = new Buffer(buf).toString('base64');
      return str.slice(0,len);
    } catch (ex) {
      // handle error, most likely are entropy sources drained
      console.log('Error! '+ex);
      return null;
    }
  };

  //
  // Stream that aggregates objects that are written into array
  // ---------------------------------------------------------

  h.arrayBucketStream = function(options) {
    // if new wasn't used, do it for them
    if (!(this instanceof h.arrayBucketStream))
      return new h.arrayBucketStream(options);

    // call stream.Writeable constructor
    Writable.call(this, options);

    this.data = [];
  };

  // inherit stream.Writeable
  h.arrayBucketStream.prototype = Object.create(Writable.prototype);

  // override the write function
  h.arrayBucketStream.prototype._write = function(chunk, encoding, done) {
    this.data.push(chunk);
    done();
  };

  h.arrayBucketStream.prototype.get = function() {
    return this.data;
  };

  h.arrayBucketStream.prototype.empty = function() {
    this.data = [];
  };


  // Exports
  // =======

  module.exports = h;

})(this);