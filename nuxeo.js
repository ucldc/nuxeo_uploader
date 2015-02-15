
var nuxeo = require('nuxeo');
var Promise = require("bluebird");

module.exports = {
  upload: function upload(filename) {
    client = new nuxeo.Client();
    client.connect(function(error, client) {
      if (error) {
        console.error('Cannot connect to Nuxeo server');
        throw new Error(error);
      }

      console.log("connect");
    });
    
  }
}


