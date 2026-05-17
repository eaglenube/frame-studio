/* Custom Google Drive folder explorer + upload helpers */
window.FS = window.FS || {};

FS.drive = (function () {
  var modalEl, modalInstance;
  var listEl, emptyEl, loadingEl, errorEl;
  var breadcrumbsEl, selectedNameEl, subEl;
  var nameInput, createBtn, saveBtn, cancelBtn, closeBtn;
  var bodyEl, footerEl, progressEl;

  var pathStack = [];
  var folders = [];
  var loading = false;
  var uploading = false;
  var activeResolve = null;
  var activeReject = null;
  var activeOptions = null;

  function $(id) { return document.getElementById(id); }

  function ensureRefs() {
    if (modalEl) return;
    modalEl = $('folderModal');
    if (!modalEl) return;
    listEl = $('folderList');
    emptyEl = $('folderEmpty');
    loadingEl = $('folderLoading');
    errorEl = $('folderError');
    breadcrumbsEl = $('folderBreadcrumbs');
    selectedNameEl = $('folderSelectedName');
    subEl = $('folderModalSub');
    nameInput = $('newFolderName');
    createBtn = $('createFolderBtn');
    saveBtn = $('saveHereBtn');
    bodyEl = modalEl.querySelector('.modal-body');
    footerEl = modalEl.querySelector('.modal-footer');
    cancelBtn = footerEl ? footerEl.querySelector('[data-bs-dismiss="modal"]') : null;
    closeBtn = modalEl.querySelector('.modal-header .btn-close');

    // Inject a progress panel (hidden by default).
    progressEl = document.createElement('div');
    progressEl.className = 'folder-upload-progress';
    progressEl.hidden = true;
    progressEl.innerHTML =
      '<div class="folder-upload-icon"><i class="bi bi-cloud-arrow-up"></i></div>' +
      '<div class="folder-upload-title" id="folderUploadTitle">Uploading…</div>' +
      '<div class="folder-upload-status" id="folderUploadStatus">Preparing…</div>' +
      '<div class="progress folder-upload-bar"><div id="folderUploadBar" class="progress-bar" style="width:0%"></div></div>';
    bodyEl.appendChild(progressEl);

    if (window.bootstrap && bootstrap.Modal) {
      modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl, {
        backdrop: 'static',
        keyboard: false,
      });
    }

    createBtn.addEventListener('click', onCreateFolder);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCreateFolder();
      }
    });
    saveBtn.addEventListener('click', onSaveHere);
    modalEl.addEventListener('hidden.bs.modal', function () {
      // Modal dismissed via X or Cancel — caller's promise resolves null.
      if (activeResolve && !uploading) {
        var r = activeResolve;
        activeResolve = null;
        activeReject = null;
        activeOptions = null;
        r(null);
      }
    });
  }

  function currentFolder() {
    return pathStack[pathStack.length - 1] || { id: 'root', name: 'My Drive' };
  }

  function renderBreadcrumbs() {
    breadcrumbsEl.innerHTML = '';
    pathStack.forEach(function (item, idx) {
      var isLast = idx === pathStack.length - 1;
      var node = document.createElement(isLast ? 'span' : 'button');
      node.className = 'crumb' + (isLast ? ' is-current' : '');
      if (!isLast) {
        node.type = 'button';
        node.addEventListener('click', function () {
          if (uploading) return;
          pathStack = pathStack.slice(0, idx + 1);
          loadCurrent();
        });
      }
      if (idx === 0) {
        node.innerHTML = '<i class="bi bi-hdd"></i> ' + escapeHtml(item.name);
      } else {
        node.textContent = item.name;
      }
      breadcrumbsEl.appendChild(node);
      if (!isLast) {
        var sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.innerHTML = '<i class="bi bi-chevron-right"></i>';
        breadcrumbsEl.appendChild(sep);
      }
    });
  }

  function renderFolderList() {
    listEl.innerHTML = '';
    if (folders.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    var frag = document.createDocumentFragment();
    folders.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'folder-item';
      btn.innerHTML =
        '<span class="folder-item-icon"><i class="bi bi-folder-fill"></i></span>' +
        '<span class="folder-item-name"></span>' +
        '<i class="bi bi-chevron-right folder-item-chevron"></i>';
      btn.querySelector('.folder-item-name').textContent = f.name;
      btn.addEventListener('click', function () {
        if (uploading) return;
        pathStack.push({ id: f.id, name: f.name });
        loadCurrent();
      });
      frag.appendChild(btn);
    });
    listEl.appendChild(frag);
  }

  function updateSelectedLabel() {
    selectedNameEl.textContent = currentFolder().name;
  }

  function setLoading(isLoading) {
    loading = isLoading;
    loadingEl.hidden = !isLoading;
    saveBtn.disabled = isLoading || uploading;
    createBtn.disabled = isLoading || uploading;
  }

  function showError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || '';
  }

  function loadCurrent() {
    showError('');
    renderBreadcrumbs();
    updateSelectedLabel();
    listEl.innerHTML = '';
    emptyEl.hidden = true;
    setLoading(true);
    var cur = currentFolder();
    return fetch('/api/drive/folders?parent=' + encodeURIComponent(cur.id), { cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Could not list folders');
          return d;
        });
      })
      .then(function (d) {
        folders = d.folders || [];
        renderFolderList();
      })
      .catch(function (err) {
        showError(err.message || 'Failed to load folders.');
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function onCreateFolder() {
    if (uploading) return;
    var name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    var parent = currentFolder().id;
    setLoading(true);
    showError('');
    fetch('/api/drive/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, parentId: parent }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Could not create folder');
          return d;
        });
      })
      .then(function (folder) {
        nameInput.value = '';
        pathStack.push({ id: folder.id, name: folder.name });
        return loadCurrent();
      })
      .catch(function (err) {
        showError(err.message || 'Could not create folder.');
        setLoading(false);
      });
  }

  function setUploadMode(on) {
    uploading = on;
    if (on) {
      modalEl.classList.add('is-uploading');
      progressEl.hidden = false;
      saveBtn.disabled = true;
      createBtn.disabled = true;
      nameInput.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-inline"></span> Uploading…';
    } else {
      modalEl.classList.remove('is-uploading');
      progressEl.hidden = true;
      nameInput.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (closeBtn) closeBtn.disabled = false;
      saveBtn.disabled = false;
      createBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Save here';
    }
  }

  function setUploadProgress(done, total, folderName) {
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var bar = $('folderUploadBar');
    var status = $('folderUploadStatus');
    var title = $('folderUploadTitle');
    if (bar) bar.style.width = pct + '%';
    if (title) {
      title.textContent =
        'Saving to "' + folderName + '"';
    }
    if (status) {
      if (done >= total) {
        status.textContent = 'Finalizing…';
      } else {
        status.textContent = 'Uploading ' + (done + 1) + ' of ' + total + ' (' + pct + '%)';
      }
    }
  }

  // Upload one image at a time so we can show real progress.
  function uploadAllSequentially(jobId, imageIds, folderId, folderName) {
    var done = 0;
    var total = imageIds.length;
    var failures = [];
    setUploadProgress(0, total, folderName);

    var chain = Promise.resolve();
    imageIds.forEach(function (id) {
      chain = chain.then(function () {
        return fetch('/api/jobs/' + jobId + '/drive/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: [id], folderId: folderId }),
        })
          .then(function (r) {
            return r.json().then(function (d) {
              if (!r.ok) throw new Error(d.error || 'Upload failed');
              return d;
            });
          })
          .then(function (d) {
            if (d.failed > 0 && d.results && d.results[0] && !d.results[0].ok) {
              failures.push({ id: id, error: d.results[0].error || 'failed' });
            }
          })
          .catch(function (err) {
            failures.push({ id: id, error: err.message || 'failed' });
          })
          .finally(function () {
            done += 1;
            setUploadProgress(done, total, folderName);
          });
      });
    });

    return chain.then(function () {
      return { uploaded: total - failures.length, failed: failures.length, total: total, failures: failures };
    });
  }

  function onSaveHere() {
    if (loading || uploading || !activeOptions) return;
    var folder = currentFolder();
    showError('');
    setUploadMode(true);

    uploadAllSequentially(activeOptions.jobId, activeOptions.imageIds, folder.id, folder.name)
      .then(function (result) {
        setUploadMode(false);
        if (result.failed > 0 && result.uploaded === 0) {
          // Total failure — keep modal open, show error.
          var first = result.failures[0];
          showError('Upload failed: ' + (first && first.error ? first.error : 'unknown error'));
          return;
        }
        if (result.failed > 0) {
          showError(
            'Saved ' + result.uploaded + ' of ' + result.total +
            ' — ' + result.failed + ' failed. You can try a different folder.'
          );
          return;
        }
        // Success — close modal and resolve.
        var r = activeResolve;
        activeResolve = null;
        activeReject = null;
        var opts = activeOptions;
        activeOptions = null;
        modalInstance && modalInstance.hide();
        r({ folder: folder, result: result, jobId: opts.jobId });
      })
      .catch(function (err) {
        setUploadMode(false);
        showError(err.message || 'Upload failed.');
      });
  }

  // Open the modal and resolve when the user has successfully saved
  // (or cancels — in which case the promise resolves with null).
  function pickFolderAndSave(jobId, imageIds, options) {
    ensureRefs();
    if (!modalEl) return Promise.reject(new Error('Folder modal not available.'));
    options = options || {};

    pathStack = [{ id: 'root', name: 'My Drive' }];
    nameInput.value = '';
    showError('');
    renderBreadcrumbs();
    updateSelectedLabel();
    listEl.innerHTML = '';
    emptyEl.hidden = true;
    setLoading(true);

    if (subEl) {
      subEl.textContent = options.subtitle ||
        (imageIds.length === 1
          ? 'Choose where this frame should go in your Drive.'
          : 'Choose where these ' + imageIds.length + ' frames should go in your Drive.');
    }

    return new Promise(function (resolve, reject) {
      activeResolve = resolve;
      activeReject = reject;
      activeOptions = { jobId: jobId, imageIds: imageIds };
      modalInstance && modalInstance.show();
      loadCurrent();
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return {
    pickFolderAndSave: pickFolderAndSave,
  };
})();
