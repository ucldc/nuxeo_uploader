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

    initialize: function() {
      this.collection = new NuxeoFolderCollection();
      this.collection.reset(_(nuxeoupload.writable_folderish()).map(function(x) {
        return { label: x };
      }));
    }
  });

  var folderView = new NuxeoFolderView();

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

  // model for configuration object
  var ConfigModel = Backbone.Model.extend({
    localStorage: new Backbone.LocalStorage("nuxeo_uploader_config"),
    defaults: {
      nuxeoServer: 'http://localhost:8080/nuxeo',
      nuxeoToken: '',
      id: 'config'
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

  // set up nuxeo client connection
  var client = new nuxeo.Client({
    baseURL: configModel.attributes.nuxeoServer,
    auth: { method: 'token' },
    headers: { 'X-Authentication-Token': configModel.attributes.nuxeoToken }
  });
  /*
   *  set up Models and Views for file processing
   */

  // model for a file
  var File = Backbone.Model.extend({});

  // Files selected by the user for upload
  //  items will get pull off list as uploaded
  var LocalList = Backbone.Collection.extend({ model: File });
  var UploadingList = Backbone.Collection.extend({ model: File });
  var FinishedList = Backbone.Collection.extend({ model: File });

  // View a file (independent of the list/state that it is in)
  var FileView = Backbone.View.extend({
    tagName: 'div',
    initialize: function(){
      // _.bindAll(this, 'render');
    },
    render: function(){
      var t = _.template('<span title="<%= path %>" class="label label-info"><%= name %></span>');
      $(this.el).html(t(this.model.attributes));
      return this;
    }
  });

  // View for local files
  var LocalListView = Backbone.View.extend({
    el: $('#local .panel-body'),
    initialize: function(){
      _.bindAll(this, 'render', 'addFiles', 'appendItem', 'removeItem');

      this.collection = new LocalList();
      this.collection.bind('add', this.appendItem);
      this.collection.bind('remove', this.removeItem);

      this.counter = 0;
      // this.render();
    },
    // add an array of files
    addFiles: function(e){
      var self = this;
      _(e).each(function(item) {
        self.counter++;
        var file = new File;
        file.set(item);
        self.collection.add(file);
      });
    },
    appendItem: function(file){
      var fileView = new FileView({
        model: file
      });
      $(this.el).append(fileView.render().el);
    },
    removeItem: function(file){
      $(this.el).remove();
    }
  });

  // View for in progress files
  var UploadingListView = Backbone.View.extend({
    el: $('#progress .panel-body'),
    initialize: function(){
      _.bindAll(this, 'render', 'addFiles', 'appendItem', 'removeItem');

      this.collection = new UploadingList();
      this.collection.bind('add', this.appendItem);
      this.collection.bind('remove', this.removeItem);

      this.counter = 0;
      // this.render();
    },
    // add an array of files
    addFiles: function(e){
      var self = this;
      _(e).each(function(item) {
        self.counter++;
        var file = new File;
        file.set(item);
        self.collection.add(file);
      });
    },
    appendItem: function(file){
      var fileView = new FileView({
        model: file
      });
      nuxeoupload.upload(client,
                      { file: file.attributes.path,
                        folder: '/default-domain/workspaces/test' },
                      function(s){logger.info(s);});
      $(this.el).append(fileView.render().el);
    },
    removeItem: function(file){
      $(this.el).remove();
    }
  });

  // View for finished files
  var FinishedListView = Backbone.View.extend({
    el: $('#nuxeo .panel-body'),
  });

  var localListView = new LocalListView();
  var uploadingListView = new UploadingListView();
  var finishedListView = new FinishedListView();

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
    localListView.addFiles(this.files);
    this.disabled = true;
    $(this).addClass('btn-default').removeClass('btn-primary');
    $('#upload').addClass('btn-primary');
  });


  /*
   *  nuxeo status
   */
  nuxeoupload.nx_status(client, function(it_is_up) {
    if (it_is_up) {
      $('#nx_status')
        .addClass('glyphicon glyphicon-ok text-success')
        .html('ok');
      // enable folder selection when connection is set up
      $('#select_nuxeo')
        .removeClass('disabled');
    } else {
      $('#nx_status')
         .addClass('glyphicon glyphicon-remove text-danger')
        .html('not connected');
    }
  });

  /*
   *  Uploading files
   */
  $('#upload').click(function () {
    localListView.collection.each(function(file) {
      if (file === undefined) { return; }
      logger.info('log to file' + file);
      localListView.collection.remove(file);
      uploadingListView.collection.add(file.attributes);
    });
    $(this).button('loading');
    // new Notification("Upload Failed!  Not implimented yet");
  });


  /*
   *  Files uploaded
   */

});

NuxeoUploadApp.start();
