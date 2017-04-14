'use strict';
var fs = require('fs');
var path = require('path');
var os = require('os');
var _ = require('underscore');
var Nuxeo = require('nuxeo');


/*
 * get nuxeo status and run callback(true|false)
 */
module.exports.nx_status = function nx_status(nuxeo, token, cb){
  if (! token) { return cb(false); }
  nuxeo.connect()
    .then(function(client){
      return cb(true);
    })
    .catch(function(error) {
      return cb(false);
    });
}


/*
 * list children files of a remote path
 */
module.exports.nxls = function nxls(nuxeo, path, formatter, postfix='/@children'){
  // check path specific path
  const check_url = 'path' + path;
  // check the path for childern by default, but allow postfix override
  const url = check_url.replace(/\/$/, '') + postfix;
  nuxeo.request(url)
    .get()
    .bind(path)
    .then(function(remote) {
        formatter(remote, path);
    })
    .catch(function(error){
      console.log(error.response || error);
      throw error;
    });
};


/*
 * run whole batch of files
 */
module.exports.runBatch = function runBatch(client, emitter, collection, nuxeo_directory, concurrent) {
  // execute promises sequentially http://stackoverflow.com/a/24586168
  let p = Promise.resolve();
  collection.forEach((fileModel, index) => {
    p = p.then(() => {
      return module.exports.runOne(client, emitter, fileModel, index, nuxeo_directory);
    });
  });
};


/*
 * run one file (return Promise)
 */
module.exports.runOne = function runOne(nuxeo, emitter, fileModel, index, upload_folder) {

  const filename = fileModel.attributes.file.path;
  const content = fs.createReadStream(filename);
  const size = fileModel.attributes.file.size;
  const name = path.basename(content.path);
  const mimeType = fileModel.attributes.type;

  const file = new Nuxeo.Blob({
    name: name,
    content: content,
    size: size,
    mimeType: mimeType
  });

  emitter.emit('uploadStarted', index, filename);
  emitter.emit('uploadProgressUpdated', index, file, 1)
  return nuxeo.batchUpload()
    .upload(file)
    .then(function(res) {
      emitter.emit('uploadProgressUpdated', index, file, 100)
      return nuxeo.operation('FileManager.Import')
        .context({ currentDocument: upload_folder })
        .input(res.blob)
        .execute({
          schemas: ['file'],
          path: file.name
        });
    })
    .then(function(doc) {
      const time = 0;
      emitter.emit('uploadFinished', index, filename, time)
      console.log(doc.properties['file:content']['digest']);
    })
    .catch(function(error) {
      console.log(error.response || error);
      throw error;
    });
};


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
Copyright © 2017, Regents of the University of California
All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
 * Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in
   the documentation and/or other materials provided with the
   distribution.
 * Neither the name of the University of California nor the names
   of its contributors may be used to endorse or promote products
   derived from this software without specific prior written
   permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
*/
