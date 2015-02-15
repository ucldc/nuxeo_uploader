'use strict';
var nuxeo = require('nuxeo');
var pfa = require("bluebird").promisifyAll;
pfa(nuxeo);

module.exports = function upload(filename, folder, callback) {

  var client = new nuxeo.Client();

  client.connectAsync().then(function(){
    console.log("looks like nuxeo is configured and up");
  });

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

  var new_folder = pfa(client.operation('Document.Create')
    .params({
      type: 'Folder',
      name: 'My Folder',
    })
    .input('doc:/')
  ).executeAsync().then(function(data){
      console.log(data[0]);
    }
  );

  console.log(new_folder);
  console.log(new_folder.data);

  return callback(null, client);
};

if(require.main === module) {
  module.exports(process.argv[2], process.argv[3], function(){});
} 
