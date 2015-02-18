var Promise = require("bluebird");
var nuxeo = Promise.promisifyAll(require('nuxeo'));
var nuxeoupload = require('./nuxeoupload');

var NuxeoUploadApp = new Backbone.Marionette.Application();

NuxeoUploadApp.module("Config", {
  define: function(NuxeoUploadApp, Config, Backbone, Marionette, $, _, nuxeo){

    /*
     *  set up Models and Views
     */

    // model for a file
    var File = Backbone.Model.extend({}); 

    // Files selected by the user for upload
    //  (items will get pull off list as uploaded
    var LocalList = Backbone.Collection.extend({
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
        _.bindAll(this, 'render', 'addFiles', 'appendItem');

        this.collection = new LocalList();
        this.collection.bind('add', this.appendItem);

        this.counter = 0;
        // this.render();
      },
      render: function(){
      },
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
      }
    });
    var listView = new LocalListView();

    /*
     *  Select files for upload
     */

    // detect when user has selected files
    // http://stackoverflow.com/a/12102992
    input = $('input');
    input.click(function () {
      this.value = null;
    });
    input.on('change', function () {
      listView.addFiles(this.files);
      this.disabled = true;
    });

    /*
     *  Nuxeo config
     */
  
    // set up the page
    $('#select_nuxeo').click(function () {
    });

    $('#upload').click(function () {
      new Notification("Upload Failed!  Not implimented yet");
    });

    client = new nuxeo.Client();
    nuxeoupload.nx_status(client, function(x) {
      $('#nx_status').html(x.toString());
    });

    /*
     *  Uploading files
     */


    /*
     *  Files uploaded
     */

  }
}, nuxeo);
NuxeoUploadApp.start();
