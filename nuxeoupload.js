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

module.exports.writable_folderish = function writable_folderish(client){
  // find folders the user can write to
  // "Since Nuxeo 6.0-HF06 or Nuxeo 7.2 you can use ecm:acl"
  // http://doc.nuxeo.com/display/NXDOC/NXQL
  var nxql = 'select * from Organization';

  return new Promise(function(resolve, reject){
    client.request('/').schema(['dublincore', 'file'])
      .path('@search')
      .query({
        'query': nxql
      }).execute(function(error, data, responce) {
        var out = [];
        if (error) { reject(error); }
        out = _.map(data.entries, function(x) {
          return x.path;
        });
        resolve(out);
      });
  });
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
      /* logger.info(data.entries[0].uid, data.entries[0].path);
      if (!data.entries.length) {
        console.log(file, data);
        throw new Error('Upload/execute returned w/o errors, but `entries` is empty '
                         + file.path );
      } */
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

