var gui = require('nw.gui');
var mb = new gui.Menu({type:"menubar"});
mb.createMacBuiltin("nuxeo-uploader");
gui.Window.get().menu = mb;
var nuxeo = require('nuxeo');

var nuxeoConfig = function nuxeoConfig() {
  function getOrSet(key, text) {
    var val;
    if (!localStorage[key]) {
      localStorage[key] = prompt(text || key);
    }
    return localStorage[key];
  }
  return { auth: {
    method: 'proxy',
    username: getOrSet('username'),
    token: getOrSet('token')
  }}
}

// document ready
$(function() {
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
      this.collection.bind('add', function(e) {
        console.log(e);
      });

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

  // http://stackoverflow.com/a/12102992
  input = $('input');
  input.click(function () {
    this.value = null;
  });
  input.on('change', function () {
    listView.addFiles(this.files);
  });
  
  // set up the page
  $('#select_nuxeo').click(function () {
    $('#nuxeo').css('opacity', '1');

    var client = new nuxeo.Client(nuxeoConfig());

    $('#nuxeo .panel-body').html(
      JSON.stringify(client)
    );
  });

  $('#upload').click(function () {
    $('#progress').css('opacity', '1');
    $('#pause').show();
    $( this ).hide();
    new Notification("Upload Failed!  Not implimented yet");
  });

});
