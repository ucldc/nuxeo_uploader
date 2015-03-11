#!/usr/bin/env node
'use strict';
var fs = require('fs');
var Promise = require("bluebird");
var pfa = require("bluebird").promisifyAll;
var path = require('path');
var os = require('os');
var _ = require('underscore');
var logger = require('./logs');


/*
 * get nuxeo status and run callback(true|false)
 */
module.exports.nx_status = function nx_status(client, cb){
  client.connectAsync().then(function(value){
    return cb(true);
  }, function(reason){
    if (reason['entity-type'] === 'login' && reason['username']) {
      return cb(true);
    } else {
      return cb(false);
    }
  });
}


/*
 * get writable locations (returns Promise)
 */
module.exports.writable_folderish = function writable_folderish(client, regex){
  return new Promise(function(resolve, reject){
    client.request('/').schema(['dublincore', 'file'])
      .path('@search')
      .query({
        // select all Organization documents a.k.a. "Project Folder" in the UI
        'query': 'select * from Organization'
      }).execute(function(error, data, responce) {
        if (error) { reject(error); }
        // filter out directories that don't match supplied regex
        // ?? does this handel paging results?
        var out = [];
        out = _.map(data.entries, function(x) {
          if (regex.test(x.path)) { return x.path; }
        }).filter( function(val) { return val !== undefined; } );
        resolve(out);
      });
  });
}


/*
 * run whole batch of files
 */
module.exports.runBatch = function runBatch(client, emitter, collection, nuxeo_directory) {
  // http://spion.github.io/promise-nuggets/16-map-limit.html cc0
  var queue = [];
  var concurrent = 3;

  var uploadPromises = collection.map(function(fileModel, index) {
    // How many items must download before fetching the next?
    // The queued, minus those running in parallel, plus one of
    // the parallel slots.
    var mustComplete = Math.max(0, queue.length - concurrent + 1);
    // when enough items are complete, queue another request for an item
    var upload = Promise.some(queue, mustComplete)
      .then(function() {
        return module.exports.runOne(client, emitter, fileModel, index, nuxeo_directory);
      });
    queue.push(upload);
    return upload.then(function(item) {
      return item;
    });
  });
  Promise.settle(uploadPromises).then(function(uploads) {
    emitter.emit('batchFinished');
    console.log(uploads);
  });
};



/*
 * run one file
 */
module.exports.runOne = function runOne(client, emitter, fileModel, index, nuxeo_directory) {
  var uploader = client.operation('FileManager.Import')
    .context({ currentDocument: nuxeo_directory })
    .uploader({
      // convert callbacks to events
      uploadStartedCallback: function(fileIndex, file) {
        emitter.emit('uploadStarted', index, file)
      },
      uploadFinishedCallback: function(fileIndex, file, time) {
        emitter.emit('uploadFinished', index, file, time)
      },
      uploadProgressUpdatedCallback: function(fileIndex, file, newProgress) {
        emitter.emit('uploadProgressUpdated', index, file, newProgress)
      },
      uploadSpeedUpdatedCallback: function(fileIndex, file, speed) {
        emitter.emit('uploadSpeedUpdated', index, file, speed)
      }
  });

  var filePath = fileModel.get('path');
  var stats = fs.statSync(filePath);
  var rfile = fileModel.get('file');

  return new Promise(function(resolve, reject){
    uploader.uploadFile(rfile, function(fileIndex, file, timeDiff) {
      uploader.execute({
        path: path.basename(filePath)
      }, function (error, data) {
        if (error) {
          fileModel.set('state', 'error');
          logger.error('uploadError', error);
          emitter.emit('uploadError', error, fileModel, data)
          reject(error, fileModel, data);
        } else {
          fileModel.set('state', 'success');
          logger.info('uploadOk', data);
          emitter.emit('uploadOk', data)
          resolve(data);
        }
      });
    });
  });
}



/*
 * return URL to get auth token from Nuxeo server.
 */
module.exports.get_auth_token_link = function get_auth_token_link() {
  return 'authentication/token' +
         '?applicationName='    + encodeURIComponent("CDL Nuxeo Client") +
         '&deviceId='           + encodeURIComponent(os.hostname()) +
         '&deviceDescription='  + encodeURIComponent("") +
         '&permission=rw';
}


/*
 * if this is running as a script
 */
if (require.main === module) {
  var nuxeo = require('nuxeo');
  nuxeo = pfa(nuxeo);
  var client = new nuxeo.Client({
    auth: { method: 'token' },
    headers: { 'X-Authentication-Token': process.env.NUXEO_TOKEN }
  });
  // module.exports.nx_status(client, function(x) { console.log(x) })
  module.exports.writable_folderish(client).then(function(x){console.log(x);});

  return;
  var status = module.exports.upload(client,
                        { file: process.argv[2],
                          folder: '/default-domain/workspaces/test' },
                        function(s){console.log(s);});
}

