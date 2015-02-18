'use strict';
var Promise = require("bluebird");
var nuxeo = Promise.promisifyAll(require('nuxeo'));
var nuxeoupload = require('./nuxeoupload');

var NuxeoUploadApp = new Backbone.Marionette.Application();

NuxeoUploadApp.module("Upload", {
  define: function(NuxeoUploadApp, Upload, Backbone, Marionette, $, _, nuxeo){
    var client = new nuxeo.Client();

    /*
     *  set up Models and Views
     */

    // model for a file
    var File = Backbone.Model.extend({}); 

    // Files selected by the user for upload
    //  items will get pull off list as uploaded
    var LocalList = Backbone.Collection.extend({
      model: File
    });
    var UploadingList = Backbone.Collection.extend({
      model: File
    });
    var FinishedList = Backbone.Collection.extend({
      model: File
    });

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
        console.log(file, fileView);
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
                        function(s){console.log(s);});
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
    var input = $('input');
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
     *  Nuxeo config
     */
  
    $('#select_nuxeo').click(function () {
    });
    // nuxeo status
    var client = new nuxeo.Client();
    nuxeoupload.nx_status(client, function(x) {
      if (x) {
        $('#nx_status').addClass('glyphicon glyphicon-ok').html('ok');
      }
    });


    /*
     *  Uploading files
     */
    $('#upload').click(function () {
      localListView.collection.each(function(file) {
        console.log(file);
        localListView.collection.remove(file);
        uploadingListView.collection.add(file.attributes);
      });
      $(this).button('loading');
      // new Notification("Upload Failed!  Not implimented yet");
    });


    /*
     *  Files uploaded
     */

  }
}, nuxeo);
NuxeoUploadApp.start();
