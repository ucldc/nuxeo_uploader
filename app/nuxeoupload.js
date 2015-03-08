#!/usr/bin/env node
'use strict';
var rest = require('restler');
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
module.exports.runBatch = function runBatch(client, emitter, collection, nuxeo_directory, callback) {

  var uploader = client.operation('FileManager.Import')
    .context({ currentDocument: nuxeo_directory })
    .uploader({
      // convert callbacks to events
      batchStartedCallback: function(batchId) { emitter.emit('batchStarted', batchId); },
      batchFinishedCallback: function(batchId) { emitter.emit('batchFinished', batchId); },
      uploadStartedCallback: function(fileIndex, file) {
        emitter.emit('uploadStarted', fileIndex, file)
      },
      uploadFinishedCallback: function(fileIndex, file, time) {
        emitter.emit('uploadFinished', fileIndex, file, time)
      },
      uploadProgressUpdatedCallback: function(fileIndex, file, newProgress) {
        emitter.emit('uploadProgressUpdated', fileIndex, file, newProgress)
      },
      uploadSpeedUpdatedCallback: function(fileIndex, file, speed) {
        emitter.emit('uploadSpeedUpdated', fileIndex, file, speed)
      }
    });

  collection.each(function(fileModel, index, list){
    var filePath = fileModel.get('path');
    var stats = fs.statSync(filePath);
    var rfile = fileModel.attributes.file;

    uploader.uploadFile(rfile, function(fileIndex, file, timeDiff) {
      uploader.execute({
        path: path.basename(filePath)
      }, function (error, data) {
        if (error) {
          fileModel.set('state', 'error');
          logger.error('uploadError', error);
          emitter.emit('uploadError', error, fileModel, data)
        } else {
          fileModel.set('state', 'success');
          logger.info('uploadOk', data);
          emitter.emit('uploadOk', data)
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

