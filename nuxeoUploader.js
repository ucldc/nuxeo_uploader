'use strict';
var nuxeo = require('nuxeo');
var temp = require('temp');
var rest = require('nuxeo/node_modules/restler');
var fs = require('fs');
var pfa = require("bluebird").promisifyAll;
var path = require('path');
nuxeo = pfa(nuxeo);

module.exports.type = function type(file, patterns){
  var ext = path.extname(file);
  switch(true) {
    case /jpe?g|tif?|gif|png|svg/i.test(file):
      return 'Picture';
    case /mov|mp4/i.test(file):
      return 'Video';
    case /wav|mp3/i.test(file):
      return 'Audio';
    default:
      return 'File';
  }
}

module.exports.nx_status = function nx_status(client, callback){
  client.connectAsync().then(function(){
    console.log("looks like nuxeo is configured and up");
  });
}

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

module.exports.upload = function upload(client, params, callback) {
  var stats = fs.statSync(params.file);
  var file = rest.file(params.file, null, stats.size, null, null);

  var uploader = client.operation('FileManager.Import')
    .context({ currentDocument: params.folder })
    .uploader.uploadFile();

  console.log('x1 about to exec');
  uploader.execute(function(error, data) {
    console.log('x2 executed');
    if (error) {
      throw error;
    }
    console.log(data);
    console.log('x2--');
  });
}



if(require.main === module) {
  var client = new nuxeo.Client();
  console.log(module.exports.type(process.argv[2]));
  module.exports.upload(client,
                        { file: process.argv[2],
                          folder: '/default-domain/workspaces/test' },
                        function(){}); 
} 
