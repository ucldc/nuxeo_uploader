'use strict';
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var nuxeo = nuxeo || require('nuxeo');
var url = require('url');
var gui = require('nw.gui');
var nuxeoupload = require('./nuxeoupload');
var logger = require('./logs');
nuxeo = Promise.promisifyAll(nuxeo);


/**
 * backbone / marionette / epoxy application
 */
var NuxeoUploadApp = new Backbone.Marionette.Application();
NuxeoUploadApp.on("start", function(options){
  logger.info('application starting');

  var SummaryModel = Backbone.Model.extend({
    defaults: {
      selected: 0,
      waiting: 0,
      uploading: 0,
      success: 0,
      error: 0
    }
  });
  var summaryModel = new SummaryModel();
  var SummaryView = Backbone.Epoxy.View.extend({
    el: '#summary',
    bindings: {
      'div#selected': 'text:selected',
      'div#waiting': 'text:waiting',
      'div#uploading': 'text:uploading',
      'div#success': 'text:success',
      'div#error': 'text:error'
    }
  });
  var summaryView = new SummaryView({model: summaryModel});

  /*
   * model and view for configuration object
   */
  var ConfigModel = Backbone.Model.extend({
    localStorage: new Backbone.LocalStorage("nuxeo_uploader_config"),
    defaults: {
      nuxeoServer: 'http://localhost:8080/nuxeo',
      nuxeoToken: '',
      pathFilter: '/asset-library/',
      skipReupload: true,
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
      "input#nuxeo_token": "value:nuxeoToken,events:['keyup']",
      "input#path_filter": "value:pathFilter,events:['keyup']",
      "input#skip_reupload": "checked:skipReupload"
      // broke --> #auth_token_link bound in HTML data-bind="attr:{href:authTokenLink}
    },
    initialize: function() {
      this.model.fetch();
    },
    events: {
      "keyup #nuxeo_server": "onAdd",
      "keyup #nuxeo_token": "onAdd",
      "keyup #path_filter": "onAdd",
      "change #skip_reupload": "onAdd"
    },
    onAdd: function(e){
      this.model.save({id: 'config'});
    }
  });
  var configView = new ConfigView({model: configModel});


 /*
  *  set up Models and Views remote folder
  */
  // set up nuxeo client connection (now that we have config)
  var client = new nuxeo.Client({
    baseURL: configModel.nuxeoBase(),
    auth: { method: 'token' },
    headers: { 'X-Authentication-Token': configModel.attributes.nuxeoToken },
    timeout: 2995000
  });
  var NuxeoFolderCollection = Backbone.Collection.extend({
    model: Backbone.Model
  });
  var NuxeoFolderCollectionView = Backbone.Epoxy.View.extend({
    el: "#select_nuxeo", // binding in HTML
    initialize: function(client) {
      this.collection = new NuxeoFolderCollection();
      var that = this;
      var re = new RegExp('^' + $('#path_filter').val());
      nuxeoupload.writable_folderish(client, re)
        .then(function(folders) {
          that.collection.reset(_.map(folders, function(x) {
            return { label: x.replace(re, ''),
                     value: x };
          }));
        });
    }
  });
  var folderView = new NuxeoFolderCollectionView(client);


  /*
   *  set up Models and Views for file processing
   */
  var FileModel = Backbone.Model.extend({
    defaults: {
      state: 'selected'
    }
  });
  // set up a cell class for each column
  var cols = ['state', 'filename', 'lastmodified', 'size'];
  var tmpl = _.template("<td class='<%= css %>'></td>");
  cols = cols.map(function(x) {
    return tmpl({css: x});
  });
  var FileView = Backbone.Epoxy.View.extend({
    tagName: 'tr',
    el: '<tr data-bind="attr:{class:state}">' + cols.join() + '</tr>',
    bindings: {
      '.state': 'text:state',
      '.lastmodified': 'text:lastModifiedDate',
      '.filename': 'text:path',
      '.size': 'text:size'
    },
  });
  var FileCollection = Backbone.Collection.extend({
    model: FileModel
  });
  var FileListView = Backbone.Epoxy.View.extend({
    el: '#local',
    itemView: FileView,
    initialize: function(){
      this.collection = new FileCollection();
      return this;
    },
    addFiles: function(e) {
      this.counter = 0;
      var that = this;
      _(e).each(function(item){
        that.counter++;
        var file = new FileModel();
        file.set(item);
        that.collection.add(file);
      });
      summaryModel.set('selected', this.counter);
    },
  });
  var fileListView = new FileListView();


  /**
   *  Interactions / jQuery / emitters / callbacks that change HTML
   */
  var emitter = new EventEmitter();

  /* 'canStartYet' events fire on certain user interactions to
     trigger this check of the interface state so the `btn-primary` class
     can be moved around the input elements
  */
  emitter.on('canStartYet', function(e) {
    // if we are ready to upload
    if ($('input[type=file]')[0].files.length > 0
        &&
        $('#select_nuxeo select').val() !== ''
    ) {
    // make upload the primary action
      $('#upload').addClass('btn-primary');
      $('#upload').removeClass('disabled');
    } else {
      $('#upload').removeClass('btn-primary');
      $('#upload').addClass('disabled');
    }
    // if selecting files is the only thing left to do
    if ($('input[type=file]')[0].files.length > 0
        &&
        $('#select_nuxeo select').val() === ''
    ) {
    // make selecting files the primary action
      $('#select_nuxeo').addClass('btn-primary');
    } else {
      $('#select_nuxeo').removeClass('btn-primary');
    }
  });

  emitter.on('batchStarted', function(batchId) { });
  emitter.on('batchFinished', function(batchId) {
    console.log('batch finished');
    // $('#upload').button('reset');
    // $('#upload').prop('disabled', true);
    new Notification("Batch finished");
  });
  emitter.on('uploadStarted', function(fileIndex, file) {
    fileListView.collection.findWhere({path: file.path}).set('state', 'uploading');
    var waiting = summaryModel.get('waiting');
    var uploading = summaryModel.get('uploading');
    summaryModel.set('waiting', waiting - 1)
    summaryModel.set('uploading', uploading + 1)
  });
  emitter.on('uploadFinished', function(fileIndex, file, time) {
    var uploading = summaryModel.get('uploading');
    var success = summaryModel.get('success');
    summaryModel.set('uploading', uploading - 1)
    summaryModel.set('success', success + 1)
    fileListView.collection.findWhere({path: file.path}).set('state', 'success')
  });

  emitter.on('uploadError', function(error, fileModel, data) {
    var success = summaryModel.get('success');
    var errors = summaryModel.get('error');
    summaryModel.set('success', success - 1);
    summaryModel.set('error', errors + 1);
    console.log(error, fileModel, data);
  });

  emitter.on('uploadProgressUpdated', function(fileIndex, file, newProgress){
    console.log('uploadProgressUpdated', fileIndex, file, newProgress);
  });

  emitter.on('uploadSpeedUpdated', function(fileIndex, file, speed){
    console.log('uploadSpeedUpdated', fileIndex, file, speed);
  });


  /*
   *  configuration / get token after shibboleth
   */
  // poor man's data binding, look up value on click
  $('#auth_token_link').on('click', function(event, baseURL) {
    // open a window that is big enough for shibboleth
    var new_win = gui.Window.open(
      url.resolve(
        $('#nuxeo_server').val().replace(/\/$/, ""),
        ['nuxeo', nuxeoupload.get_auth_token_link()].join('/')
      )
    );
  });


  /*
   *  Select files for upload
   */
  // detect when user has selected files http://stackoverflow.com/a/12102992
  var input = $('input[type=file]');
  input.click(function () { this.value = null; });
  input.on('change', function () {
    emitter.emit('canStartYet');
    fileListView.addFiles(this.files);
    this.disabled = true;
    $(this).addClass('btn-default').removeClass('btn-primary');
    $('#local').DataTable();
  });

  /* select directory to upload to
   */
  $('#select_nuxeo select').on('change', function () {
    emitter.emit('canStartYet');
  });

  /*
   *  nx_status fires callback(true|false) with connection status
   */
  nuxeoupload.nx_status(client, function(it_is_up) {
    if (it_is_up) {
      $('#nx_status')
        .addClass('glyphicon glyphicon-ok text-success')
        .html('ok');
      // enable folder selection when connection is set up
      $('#select_nuxeo').removeClass('disabled');
      // won't need the auth token link again
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
    emitter.emit('upload triggered', fileListView);
    var nuxeo_directory = $('#select_nuxeo select').val();
    var $btn = $(this).button('loading');
    $('#select_nuxeo').addClass('disabled');

    fileListView.collection.each(function(fileModel) {
      fileModel.set('state', 'waiting');
    });

    summaryModel.set('waiting', fileListView.collection.length);

    var x = nuxeoupload.runBatch(client, emitter, fileListView.collection, nuxeo_directory, function(out){
      console.log(out);
    });
    console.log(x);

  });
});

NuxeoUploadApp.start();

/*
 * applicaiton menu for node-webkit (nw.js)
 */

// https://github.com/nwjs/nw.js/issues/1955
var win = gui.Window.get();
var nativeMenuBar = new gui.Menu({ type: "menubar" });
try {
  nativeMenuBar.createMacBuiltin("Nuxeo Uploader");
  win.menu = nativeMenuBar;
} catch (ex) {
  logger.warn(ex.message);
}
