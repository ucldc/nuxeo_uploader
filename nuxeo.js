'use strict';
var nuxeo = require('nuxeo');
var pfa = require("bluebird").promisifyAll;
nuxeo = pfa(nuxeo);

module.exports.nx_status = function nx_status(client, callback){
  client.connectAsync().then(function(){
    console.log("looks like nuxeo is configured and up");
  });
}

module.exports.upload = function upload(client, params, callback) {
  /* upload(filename, folder, callback)
     @filename = local path to a file to upload
     @folder   = nuxeo document id for Folderish place in nuxeo
     returns: @callback

   Needs to:
     - match up file extension to nuxeo object type (?)
     - checksum file?
     - upload file, note batch id
     - create a nuxeo document, attach batch to it
   */

  // find folders the user can write to
  // "Since Nuxeo 6.0-HF06 or Nuxeo 7.2 you can use ecm:acl"
  // http://doc.nuxeo.com/display/NXDOC/NXQL
  var nxql = 'select * from Document' +
             //' WHERE ecm:acl/*1/permission' +
             //' IN ("ReadWrite")';
             ' limit 1';

  var request = pfa(client.request('/').schema(['dublincore', 'file'])
    .path('@search')
    .query({
      'query': nxql
    })
  );

  request.executeAsync().then(function(data){
    console.log(data[0].errorMessage, data[0].entries);
  });

  pfa(client.operation('Document.Create')
    .params({
      type: 'Folder',
      name: 'My Folder',
    })
    .input('doc:/')
  ).executeAsync().then(function(data){
      console.log(data[0]);
  });

  return callback(null);
};

if(require.main === module) {
  var client = new nuxeo.Client();
  module.exports.nx_status(client);
  /* module.exports.upload(client,
                        { file: process.argv[2],
                        folder: process.argv[3] },
                        function(){}); */
} 
