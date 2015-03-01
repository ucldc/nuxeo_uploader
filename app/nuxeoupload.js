#!/usr/bin/env node
'use strict';
var nuxeo = nuxeo || require('nuxeo');
var rest = require('nuxeo/node_modules/restler');
var fs = require('fs');
var Promise = require("bluebird");
var pfa = require("bluebird").promisifyAll;
var path = require('path');
var os = require('os');
var _ = require('underscore');
var logger = require('./logs');
nuxeo = pfa(nuxeo);


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
 * second version of upload named `up1` for now
 */
module.exports.up1 = function up1(client, emitter, fileModel, nuxeo_directory){
  console.log(client, emitter, fileModel, nuxeo_directory);
  var filePath = fileModel.get('path');
  var stats = fs.statSync(filePath);
  var rfile = rest.file(filePath, null, stats.size, null, null);

  var uploader = client.operation('FileManager.Import')
    .context({ currentDocument: nuxeo_directory })
    .uploader();

  uploader.uploadFile(rfile, function(fileIndex, file, timeDiff) {
    uploader.execute({
      path: path.basename(filePath)
    }, function (error, data) {
      if (error) {
        fileModel.set('state', 'error');
        logger.error('uploadError', error);
        console.log('uploadError', error);
        emitter.emit('uploadError', error)
      } else {
        fileModel.set('state', 'success');
        logger.info('uploadOk', data);
        console.log('uploadOk', data);
        emitter.emit('uploadOk', data)
      }
    });
  });
  console.log(uploader);
}


/*
 * upload a file to Nuxeo and run callback(file, data)
 */
module.exports.upload = function upload(client, params, callback) {
  var bb_file = params.file;
  var stats = fs.statSync(params.file.attributes.path);
  var file = rest.file(params.file.attributes.path, null, stats.size, null, null);

  var uploader = client.operation('FileManager.Import')
    .context({ currentDocument: params.folder })
    .uploader();

  uploader.uploadFile(file, function(fileIndex, file, timeDiff) {
    uploader.execute({
      path: path.basename(params.file)
    }, function (error, data) {
      if (error) {
        throw error;
      }
      callback(bb_file, file, data);
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

