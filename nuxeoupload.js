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
nuxeo = pfa(nuxeo);

/*
 * get nuxeo status
 */
module.exports.nx_status = function nx_status(client, cb){
  client.connectAsync().then(function(){
    return cb(true);
  }, function(){
    return cb(false);
  });
}

/*
 * get writable locations
 */

module.exports.writable_folderish = function writable_folderish(client){
  // find folders the user can write to
  // "Since Nuxeo 6.0-HF06 or Nuxeo 7.2 you can use ecm:acl"
  // http://doc.nuxeo.com/display/NXDOC/NXQL
  var nxql = 'select * from Document' +
             ' WHERE ecm:acl/*1/permission' +
             ' IN ("ReadWrite", "ReadRemove", "Everything")';

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
 * upload a file to Nuxeo
 */
module.exports.upload = function upload(client, params, callback) {
  var stats = fs.statSync(params.file);
  var file = rest.file(params.file, null, stats.size, null, null);

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
      if (!data.entries.length) {
        console.log(file, data);
        throw new Error('Upload/execute returned w/o errors, but `entries` is empty '
                         + file.path );
      }
      console.log(data.entries[0].uid, data.entries[0].path);
    });
  });
}

// function to create documents from files
module.exports.createDocumentFromFile = function(client, file, remotePath, callback) {
  var operation = client.operation('FileManager.Import')
    .context({
      currentDocument: remotePath
    })
    .input(rest.file(file, null, fs.statSync(file).size, null, null));

  operation.execute(function(err, data, response) {
    if (err) {
      callback(err, file, null);
    } else {
      callback(null, file, data);
    }
  })
};

// function to create folders
module.exports.createFolder = function(dir, remotePath, folderishType, callback) {
  client.document(remotePath).create({
    type: folderishType,
    name: path.basename(dir),
    properties: {
      "dc:title": path.basename(dir)
    }
  }, function(err, folder) {
    if (err) {
      callback(err, dir, null);
    } else {
      callback(null, dir, folder);
    }
  });
};


/*
 * get auth token from Nuxeo server.
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

