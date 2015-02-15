'use strict';
var nuxeo = require('nuxeo');
var temp = require('temp');
var rest = require('nuxeo/node_modules/restler');
var fs = require('fs');
var pfa = require("bluebird").promisifyAll;
nuxeo = pfa(nuxeo);

module.exports.type = function type(file, patterns){
  patterns = patterns || {
    '': 'CustomFile',
    'jpg': 'SampleCustomPicture'
  };
  var ext = path.extname(file);
  return patterns[ext] || patterns[''];
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
    .input(file)
    .uploader();

  uploader.uploadFile(file, function(fileIndex, fileObj, timediff) {
    console.log(fileIndex, fileObj);
  });

  uploader.execute(function(error, data) {
      if (error) {
        throw error;
      }
      console.log(data);
  });

}



if(require.main === module) {
  var client = new nuxeo.Client();
  module.exports.upload(client,
                        { file: process.argv[2],
                          folder: '/default-domain/workspaces/test' },
                        function(){});
} 
