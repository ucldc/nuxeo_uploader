#!/usr/bin/env node
'use strict';
var nuxeo = require('nuxeo');
var temp = require('temp');
var rest = require('nuxeo/node_modules/restler');
var fs = require('fs');
var pfa = require("bluebird").promisifyAll;
var path = require('path');
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
module.exports.writable = function writable(client, callback){
  // find folders the user can write to
  // "Since Nuxeo 6.0-HF06 or Nuxeo 7.2 you can use ecm:acl"
  // http://doc.nuxeo.com/display/NXDOC/NXQL
  var nxql = 'select * from Document' +
             ' WHERE ecm:acl/*1/permission' +
             ' IN ("ReadWrite")';

  var request = pfa(client.request('/').schema(['dublincore', 'file'])
    .path('@search')
    .query({
      'query': nxql
    })
  );

  request.executeAsync().then(function(data){
    console.log(data[0].errorMessage, data[0].entries);
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
    .input(file)
    .uploader();
    
  uploader.uploadFile(file.path);
  uploader.execute(function(error, data) {
    if (error) {
      return error;
    }
    if (!data.entries.length) {
      console.log(file, data);
      throw new Error('Upload/execute returned w/o errors, but `entries` is empty '
                       + file.path );
    }
    console.log(data.entries[0].uid, data.entries[0].path);
  });
}

/*
 * if this is running as a script
 */
if(require.main === module) {
  var client = new nuxeo.Client();
  module.exports.nx_status(client, function(x) { console.log(x) });
  var status = module.exports.upload(client,
                        { file: process.argv[2],
                          folder: '/default-domain/workspaces/test' },
                        function(s){console.log(s);});
} 
