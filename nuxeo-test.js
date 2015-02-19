var nuxeo = require('nuxeo'),
  fs = require('fs'),
  path = require('path');

var rest = require('nuxeo/node_modules/restler');


var client = new nuxeo.Client({});

var stats = fs.statSync(process.argv[2]);
var file = rest.file(process.argv[2], null, stats.size, null, null);

var x = client.operation('FileManager.Import')
  .context({ currentDocument: '/TestBlobs' })
  .uploader();

x.uploadFile(file, function(fileIndex, file, timeDiff) {
  // When done, execute the operation
  x.execute(function(error, data) {
    if (error) {
      // something went wrong
      throw error;
    }
    console.log(data);
    if (!data.entries.length) {
      throw new Error('Upload/execute returned w/o errors, but `entries` is empty '
                       + file.path );
    }
    // successfully attached blob
  });
});
