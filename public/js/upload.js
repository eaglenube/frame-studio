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

  // ---- YouTube source ----
  var ytUrlInput = document.getElementById('youtubeUrl');
  var ytCheckBtn = document.getElementById('youtubeCheckBtn');
  var ytStatus = document.getElementById('youtubeStatus');
  var ytPreview = document.getElementById('youtubePreview');
  var ytThumb = document.getElementById('youtubeThumb');
  var ytTitle = document.getElementById('youtubeTitle');
  var ytAuthor = document.getElementById('youtubeAuthor');
  var ytLength = document.getElementById('youtubeLength');
  var clearYtPickBtn = document.getElementById('clearYoutubePick');

  // Cheap pre-flight regex so users get instant feedback before we round-trip
  // to the server. The server still does the real validation.
  var YT_URL_RE = /^(https?:\/\/)?((www\.|m\.|music\.)?youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/i;

  var youtubeSelection = null; // { url, videoId, title, author, lengthSeconds, thumbnail }

  function updateContinueState() {
    if (currentSource === 'local') {
      continueBtn.disabled = !selectedFile;
    } else if (currentSource === 'drive') {
      continueBtn.disabled = !driveSelection;
    } else if (currentSource === 'youtube') {
      continueBtn.disabled = !youtubeSelection;
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

  // ---- YouTube handlers ----

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '';
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function setYtStatus(kind, msg) {
    if (!ytStatus) return;
    if (!kind) {
      ytStatus.hidden = true;
      ytStatus.textContent = '';
      ytStatus.className = 'youtube-status';
      return;
    }
    ytStatus.hidden = false;
    ytStatus.className = 'youtube-status is-' + kind;
    if (kind === 'loading') {
      ytStatus.innerHTML = '<span class="spinner-inline"></span> ' + msg;
    } else {
      ytStatus.textContent = msg;
    }
  }

  function setYoutubeSelection(info) {
    youtubeSelection = info;
    if (!info) {
      if (ytPreview) ytPreview.hidden = true;
    } else {
      if (ytThumb) {
        if (info.thumbnail) {
          ytThumb.src = info.thumbnail;
          ytThumb.style.display = '';
        } else {
          ytThumb.removeAttribute('src');
          ytThumb.style.display = 'none';
        }
      }
      if (ytTitle) ytTitle.textContent = info.title || '';
      if (ytAuthor) ytAuthor.textContent = info.author || '';
      if (ytLength) {
        var d = formatDuration(info.lengthSeconds);
        ytLength.textContent = d ? 'Duration: ' + d : '';
      }
      if (ytPreview) ytPreview.hidden = false;
    }
    updateContinueState();
  }

  function checkYoutubeUrl() {
    if (!ytUrlInput) return;
    var url = ytUrlInput.value.trim();
    if (!url) {
      setYtStatus(null);
      setYoutubeSelection(null);
      return;
    }
    if (!YT_URL_RE.test(url)) {
      setYtStatus('error', 'That doesn\'t look like a YouTube URL.');
      setYoutubeSelection(null);
      return;
    }

    setYtStatus('loading', 'Looking up video…');
    setYoutubeSelection(null);

    fetch('/api/youtube/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      })
      .then(function (out) {
        if (out.status >= 200 && out.status < 300) {
          setYtStatus(null);
          var info = out.data;
          info.url = url;
          setYoutubeSelection(info);
        } else {
          setYtStatus('error', (out.data && out.data.error) || 'Could not read that video.');
        }
      })
      .catch(function () {
        setYtStatus('error', 'Network error while checking the URL.');
      });
  }

  if (ytCheckBtn) {
    ytCheckBtn.addEventListener('click', function (e) {
      e.preventDefault();
      checkYoutubeUrl();
    });
  }
  if (ytUrlInput) {
    ytUrlInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkYoutubeUrl();
      }
    });
    ytUrlInput.addEventListener('input', function () {
      // Any edit invalidates the previous selection.
      if (youtubeSelection) {
        setYoutubeSelection(null);
        setYtStatus(null);
      }
    });
  }
  if (clearYtPickBtn) {
    clearYtPickBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (ytUrlInput) ytUrlInput.value = '';
      setYoutubeSelection(null);
      setYtStatus(null);
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

  function submitYoutube() {
    if (!youtubeSelection) return;
    setContinueBusy(true, 'Downloading from YouTube…');
    progressWrap.hidden = false;
    progressLabel.textContent = 'Fetching from YouTube…';
    progressBar.style.width = '100%';
    progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
    progressPct.textContent = '';

    fetch('/api/youtube/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: youtubeSelection.url }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      })
      .then(function (out) {
        if (out.status >= 200 && out.status < 300) {
          window.location = out.data.redirect || ('/options/' + out.data.jobId);
        } else {
          FS.toast((out.data && out.data.error) || 'YouTube import failed.', 'danger');
          progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
          progressBar.style.width = '0%';
          setContinueBusy(false);
        }
      })
      .catch(function () {
        FS.toast('Network error during YouTube import.', 'danger');
        progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
        progressBar.style.width = '0%';
        setContinueBusy(false);
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (currentSource === 'drive') {
      submitDrive();
    } else if (currentSource === 'youtube') {
      submitYoutube();
    } else {
      submitLocal();
    }
  });

  updateContinueState();
})();
