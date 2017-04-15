export var editMenuTemplate = {
    label: 'Edit',
    submenu: [{
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: function () {
        app.quit();
      }
    }]
};
