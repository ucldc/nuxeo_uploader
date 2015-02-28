'use strict';
var path = require('path');
var Promise = require('bluebird');
var nuxeo = nuxeo || require('nuxeo');
var rest = require('nuxeo/node_modules/restler');
var url = require('url');
var gui = require('nw.gui');
var nuxeoupload = require('./nuxeoupload');
var logger = require('./logs');

// https://github.com/nwjs/nw.js/issues/1955
var win = gui.Window.get();
var nativeMenuBar = new gui.Menu({ type: "menubar" });
try {
  nativeMenuBar.createMacBuiltin("Nuxeo Uploader");
  win.menu = nativeMenuBar;
} catch (ex) {
  logger.warn(ex.message);
}

var NuxeoUploadApp = new Backbone.Marionette.Application();

NuxeoUploadApp.on("start", function(options){
  logger.info('application starting');

  // model for configuration object
  var ConfigModel = Backbone.Model.extend({
    localStorage: new Backbone.LocalStorage("nuxeo_uploader_config"),
    defaults: {
      nuxeoServer: 'http://localhost:8080/nuxeo',
      nuxeoToken: '',
      id: 'config'
    },
    nuxeoBase: function nuxeoBase(){
      return this.get("nuxeoServer")
                 .replace(new RegExp("^https://(.*)\.cdlib\.org/nuxeo"),
                          "https://$1.cdlib.org/Nuxeo");
    }
  });
  var configModel = new ConfigModel();
  var ConfigView = Backbone.Epoxy.View.extend({
    el: ".nuxeo-config",
    bindings: {
      "input#nuxeo_server": "value:nuxeoServer,events:['keyup']",
      "input#nuxeo_token": "value:nuxeoToken,events:['keyup']"
      // broke --> #auth_token_link bound in HTML data-bind="attr:{href:authTokenLink}
    },
    initialize: function() {
      this.model.fetch();
    },
    events: {
      "keyup #nuxeo_server": "onAdd",
      "keyup #nuxeo_token": "onAdd"
    },
    onAdd: function(e){
      this.model.save({id: 'config'});
    }
  });
  var configView = new ConfigView({model: configModel});

  // set up nuxeo client connection (now that we have config)
  var client = new nuxeo.Client({
    baseURL: configModel.nuxeoBase(),
    auth: { method: 'token' },
    headers: { 'X-Authentication-Token': configModel.attributes.nuxeoToken }
  });

 /*
  *  set up Models and Views remote folder
  */
  var NuxeoFolderView = Backbone.View.extend({
    tagName: "option",
    initialize: function() {
      this.$el.text( this.model.get("label") );
    }
  });
  var NuxeoFolderCollection = Backbone.Collection.extend({
    model: Backbone.Model
  });
  var NuxeoFolderView = Backbone.Epoxy.View.extend({
    el: "#select_nuxeo",
    itemView: NuxeoFolderView,
    initialize: function(client) {
      this.collection = new NuxeoFolderCollection();
      var that = this;
      nuxeoupload.writable_folderish(client).then(function(folders) {
        that.collection.reset(_.map(folders, function(x) {
          return {
            label: x.replace(new RegExp('^/asset-library/'),
                             '') };
        }));
      });
    }
  });
  var folderView = new NuxeoFolderView(client);

  /*
   *  set up Models and Views for file processing
   */

  var File = Backbone.Model.extend({
    defaults: {
      state: 'selected'
    }
  });
  var FileCollection = Backbone.Collection.extend({ model: File });
  var FileView = Backbone.Epoxy.View.extend({});
  var FileListView = Backbone.Epoxy.View.extend({
    el: '#local',
    itemView: FileView,
    initialize: function(){
      this.collection = new FileCollection();
    },
    addFiles: function(e) {
      var that = this;
      _(e).each(function(item){
        console.log(e);
        that.counter++;
        var file = new File;
        file.set(item);
        that.collection.add(file);
      });
    }
  });
  var fileListView = new FileListView();

  /*
   *  nuxeo config
           .nuxeo-config #nuxeo_server #nuxeo_token #auth_token_link
   */

  // poor man's data binding
  $('#auth_token_link').on('click', function(event, baseURL) {
    // open a window that is big enough for shibboleth
    var new_win = gui.Window.open(
      url.resolve(
        $('#nuxeo_server').val(),
        path.join('nuxeo', nuxeoupload.get_auth_token_link())
      )
    );
  });

  /*
   *  Select files for upload
   */

  // detect when user has selected files
  // http://stackoverflow.com/a/12102992
  var input = $('input[type=file]');
  input.click(function () {
    this.value = null;
  });
  input.on('change', function () {
    fileListView.addFiles(this.files);
    this.disabled = true;
    $(this).addClass('btn-default').removeClass('btn-primary');
    $('#upload').addClass('btn-primary');
  });


  /*
   *  nx_status fires callback if the connection is okay
   */
  nuxeoupload.nx_status(client, function(it_is_up) {
    if (it_is_up) {
      $('#nx_status')
        .addClass('glyphicon glyphicon-ok text-success')
        .html('ok');
      // enable folder selection when connection is set up
      $('#select_nuxeo').removeClass('disabled');
      $('#upload').removeClass('disabled');
      $('#auth_token_link').hide('');
    } else {
      $('#nx_status')
         .addClass('glyphicon glyphicon-remove text-danger')
        .html('not connected');
    }
  });

  /*
   *  Upload files
   */
  $('#upload').click(function () {
    var $btn = $(this).button('uploading files to Nuxeo');
    /* while(fileListView.collection.length) {
      var file = localListView.collection.pop();
      logger.debug(file.attributes);
    } */
    // $btn.button('reset')
    // new Notification("Upload Failed!  Not implimented yet");
  });
});

NuxeoUploadApp.start();
