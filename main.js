var gui = require('nw.gui');
var mb = new gui.Menu({type:"menubar"});
mb.createMacBuiltin("your-app-name");
gui.Window.get().menu = mb;
