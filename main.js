var gui = require('nw.gui');
var mb = new gui.Menu({type:"menubar"});
mb.createMacBuiltin("nuxeo-uploader");
gui.Window.get().menu = mb;

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

  // set up the page
  $('#pause').hide();
  $('#progress, #local, #nuxeo').css('opacity', '0.3');

  $('#select_nuxeo').click(function () {
    $('#nuxeo').css('opacity', '1');
    $('#nuxeo .panel-body').html(
      JSON.stringify(nuxeoConfig())
    );
  });

  $('#upload').click(function () {
    $('#progress').css('opacity', '1');
    $('#pause').show();
    $( this ).hide();
  });

  // http://stackoverflow.com/a/12102992
  input = $('input');
  input.click(function () {
    this.value = null;
  });
  input.on('change', function () {
    $('#local').css('opacity', '1');
    $('#local .panel-body').html(
      JSON.stringify(this.files)
    );
  });
  
});
