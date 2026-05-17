/* Google Drive integration: folder picker + upload */
window.FS = window.FS || {};

FS.drive = (function () {
  var pickerLoaded = false;
  var configCache = null;

  function loadPicker() {
    return new Promise(function (resolve, reject) {
      if (pickerLoaded) return resolve();
      if (!window.gapi) {
        return reject(new Error('Google API script not loaded.'));
      }
      window.gapi.load('picker', {
        callback: function () {
          pickerLoaded = true;
          resolve();
        },
        onerror: function () { reject(new Error('Failed to load Picker.')); },
        timeout: 8000,
        ontimeout: function () { reject(new Error('Picker load timed out.')); },
      });
    });
  }

  function getConfig() {
    if (configCache) return Promise.resolve(configCache);
    return fetch('/api/drive/picker-config', { cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Picker config unavailable');
          configCache = d;
          return d;
        });
      });
  }

  // Show a Drive folder picker. Resolves with { id, name } of the chosen folder,
  // or null if the user cancelled.
  function pickFolder() {
    return Promise.all([loadPicker(), getConfig()]).then(function (arr) {
      var cfg = arr[1];

      return new Promise(function (resolve, reject) {
        try {
          var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setMimeTypes('application/vnd.google-apps.folder')
            .setSelectFolderEnabled(true)
            .setIncludeFolders(true);

          var sharedView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setEnableDrives(true)
            .setMimeTypes('application/vnd.google-apps.folder')
            .setSelectFolderEnabled(true)
            .setIncludeFolders(true);

          var builder = new google.picker.PickerBuilder()
            .setOAuthToken(cfg.accessToken)
            .setDeveloperKey(cfg.apiKey)
            .setTitle('Select a folder in your Google Drive')
            .addView(view)
            .addView(sharedView)
            .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
            .setCallback(function (data) {
              var action = data[google.picker.Response.ACTION];
              if (action === google.picker.Action.PICKED) {
                var doc = data[google.picker.Response.DOCUMENTS][0];
                resolve({ id: doc.id, name: doc.name });
              } else if (action === google.picker.Action.CANCEL) {
                resolve(null);
              }
            });

          if (cfg.appId) builder.setAppId(cfg.appId);

          builder.build().setVisible(true);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function save(jobId, imageIds, folderId) {
    return fetch('/api/jobs/' + jobId + '/drive/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: imageIds, folderId: folderId }),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Drive upload failed');
        return d;
      });
    });
  }

  // Reset the cached token (e.g. after a 401 from Drive).
  function invalidateConfig() {
    configCache = null;
  }

  return {
    pickFolder: pickFolder,
    save: save,
    invalidateConfig: invalidateConfig,
  };
})();
