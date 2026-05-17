(function () {
  var form = document.getElementById('uploadForm');
  if (!form) return;

  // ---- Source tabs ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.source-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.source-panel'));
  var currentSource = 'local';

  function switchSource(src) {
    currentSource = src;
    tabs.forEach(function (t) {
      var active = t.getAttribute('data-source') === src;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      p.hidden = p.getAttribute('data-source') !== src;
    });
    updateContinueState();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      switchSource(t.getAttribute('data-source'));
    });
  });

  // ---- Local file ----
  var dz = document.getElementById('dropzone');
  var input = document.getElementById('videoInput');
  var pickBtn = document.getElementById('pickFileBtn');
  var continueBtn = document.getElementById('continueBtn');
  var idleEl = document.getElementById('dropzoneIdle');
  var fileEl = document.getElementById('dropzoneFile');
  var fileName = document.getElementById('fileName');
  var fileSize = document.getElementById('fileSize');
  var clearBtn = document.getElementById('clearFile');
  var progressWrap = document.getElementById('uploadProgressWrap');
  var progressBar = document.getElementById('uploadProgressBar');
  var progressPct = document.getElementById('uploadProgressPct');
  var progressLabel = document.getElementById('uploadProgressLabel');

  var ALLOWED = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  var MAX_MB = window.__MAX_UPLOAD_MB__ || 500;

  var selectedFile = null;

  // ---- Drive source ----
  var driveIdleEl = document.getElementById('driveSourceIdle');
  var drivePickedEl = document.getElementById('driveSourcePicked');
  var drivePickedName = document.getElementById('drivePickedName');
  var drivePickedMeta = document.getElementById('drivePickedMeta');
  var browseDriveBtn = document.getElementById('browseDriveBtn');
  var clearDrivePickBtn = document.getElementById('clearDrivePick');

  var driveSelection = null; // { id, name, size, durationMillis }

  function updateContinueState() {
    if (currentSource === 'local') {
      continueBtn.disabled = !selectedFile;
    } else if (currentSource === 'drive') {
      continueBtn.disabled = !driveSelection;
    }
  }

  // ---- Local file handlers ----

  function setFile(file) {
    if (!file) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED.indexOf(ext) === -1) {
      FS.toast('Unsupported file type. Use MP4, MOV, AVI, MKV, or WEBM.', 'danger');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      FS.toast('File is too large. Max is ' + MAX_MB + ' MB.', 'danger');
      return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = FS.formatBytes(file.size);
    idleEl.hidden = true;
    fileEl.hidden = false;
    updateContinueState();
  }

  function clearFile() {
    selectedFile = null;
    input.value = '';
    idleEl.hidden = false;
    fileEl.hidden = true;
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';
    updateContinueState();
  }

  function openPicker() {
    input.click();
  }

  dz.addEventListener('click', function (e) {
    if (e.target.closest('#clearFile') || e.target.closest('.dropzone-file')) return;
    openPicker();
  });
  dz.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });
  pickBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    openPicker();
  });
  clearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearFile();
  });
  input.addEventListener('change', function () {
    if (input.files && input.files[0]) setFile(input.files[0]);
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('is-dragging');
    });
  });
  dz.addEventListener('drop', function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files[0]) setFile(files[0]);
  });

  // ---- Drive handlers ----

  function setDriveSelection(item) {
    driveSelection = item;
    if (!item) {
      driveIdleEl.hidden = false;
      drivePickedEl.hidden = true;
    } else {
      driveIdleEl.hidden = true;
      drivePickedEl.hidden = false;
      drivePickedName.textContent = item.name;
      var bits = [];
      if (item.size) bits.push(FS.formatBytes(item.size));
      if (item.mimeType) bits.push(item.mimeType);
      drivePickedMeta.textContent = bits.join(' · ');
    }
    updateContinueState();
  }

  if (browseDriveBtn) {
    browseDriveBtn.addEventListener('click', function () {
      if (!window.__IS_LOGGED_IN__) {
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location = '/login?next=' + next;
        return;
      }
      if (!window.FS || !FS.drive || !FS.drive.pickVideoFromDrive) {
        FS.toast('Drive picker is not available.', 'danger');
        return;
      }
      FS.drive.pickVideoFromDrive().then(function (picked) {
        if (picked) setDriveSelection(picked);
      });
    });
  }

  if (clearDrivePickBtn) {
    clearDrivePickBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setDriveSelection(null);
    });
  }

  // ---- Submit ----

  function setContinueBusy(busy, label) {
    if (busy) {
      continueBtn.disabled = true;
      continueBtn.innerHTML = '<span class="spinner-inline"></span> ' + label;
    } else {
      continueBtn.innerHTML = '<span class="btn-label">Continue</span><i class="bi bi-arrow-right ms-2"></i>';
      updateContinueState();
    }
  }

  function submitLocal() {
    if (!selectedFile) return;
    var fd = new FormData();
    fd.append('video', selectedFile);

    setContinueBusy(true, 'Uploading…');
    progressWrap.hidden = false;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = function (evt) {
      if (evt.lengthComputable) {
        var pct = Math.round((evt.loaded / evt.total) * 100);
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        if (pct === 100) progressLabel.textContent = 'Finishing upload…';
      }
    };
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          window.location = data.redirect || ('/options/' + data.jobId);
        } else {
          FS.toast(data.error || ('Upload failed (' + xhr.status + ')'), 'danger');
          setContinueBusy(false);
        }
      } catch (err) {
        FS.toast('Unexpected upload response.', 'danger');
        setContinueBusy(false);
      }
    };
    xhr.onerror = function () {
      FS.toast('Network error during upload.', 'danger');
      setContinueBusy(false);
    };
    xhr.send(fd);
  }

  function submitDrive() {
    if (!driveSelection) return;
    setContinueBusy(true, 'Importing from Drive…');
    progressWrap.hidden = false;
    progressLabel.textContent = 'Downloading from Google Drive…';
    progressBar.style.width = '100%';
    progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
    progressPct.textContent = '';

    FS.drive.importVideo(driveSelection.id)
      .then(function (data) {
        window.location = data.redirect || ('/options/' + data.jobId);
      })
      .catch(function (err) {
        FS.toast(err.message || 'Drive import failed.', 'danger');
        progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
        progressBar.style.width = '0%';
        setContinueBusy(false);
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (currentSource === 'drive') {
      submitDrive();
    } else {
      submitLocal();
    }
  });

  updateContinueState();
})();
