var gui = require('nw.gui');
var mb = new gui.Menu({type:"menubar"});
mb.createMacBuiltin("nuxeo-uploader");
gui.Window.get().menu = mb;
var Promise = require("bluebird");
var nuxeo = Promise.promisifyAll(require('nuxeo'));
var nuxeoupload = require('./nuxeoupload');

var NuxeoUploadApp = new Backbone.Marionette.Application();

NuxeoUploadApp.module("Config", {
  define: function(NuxeoUploadApp, Config, Backbone, Marionette, $, _, nuxeo){
    console.log(NuxeoUploadApp);
    console.log(nuxeo);

    var File = Backbone.Model.extend({}); 

    var LocalList = Backbone.Collection.extend({
      model: File
    });

    var LocalView = Backbone.View.extend({
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

    var ListView = Backbone.View.extend({
      el: $('#local .panel-body'),
      events: {
        'click button#add': 'addItem'
      },
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
      appendItem: function(item){
        var itemView = new LocalView({
          model: item
        });
        $(this.el).append(itemView.render().el);
      }
    });
    var listView = new ListView();

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
  }
}, nuxeo);
NuxeoUploadApp.start();
