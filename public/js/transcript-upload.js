(function () {
  var form = document.getElementById('transcriptForm');
  if (!form) return;

  var dz = document.getElementById('dropzone');
  var input = document.getElementById('videoInput');
  var pickBtn = document.getElementById('pickFileBtn');
  var continueBtn = document.getElementById('continueBtn');
  var idleEl = document.getElementById('dropzoneIdle');
  var fileEl = document.getElementById('dropzoneFile');
  var fileName = document.getElementById('fileName');
  var fileSize = document.getElementById('fileSize');
  var clearBtn = document.getElementById('clearFile');
  var langSelect = document.getElementById('language');
  var summarySelect = document.getElementById('summaryType');
  var progressWrap = document.getElementById('uploadProgressWrap');
  var progressBar = document.getElementById('uploadProgressBar');
  var progressPct = document.getElementById('uploadProgressPct');
  var progressLabel = document.getElementById('uploadProgressLabel');

  var ALLOWED = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
  var MAX_MB = window.__MAX_UPLOAD_MB__ || 500;

  var selectedFile = null;

  function setFile(file) {
    if (!file) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED.indexOf(ext) === -1) {
      FS.toast('Unsupported file type for transcription.', 'danger');
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
    continueBtn.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    input.value = '';
    idleEl.hidden = false;
    fileEl.hidden = true;
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';
    continueBtn.disabled = true;
  }

  function openPicker() { input.click(); }

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
  pickBtn.addEventListener('click', function (e) { e.stopPropagation(); openPicker(); });
  clearBtn.addEventListener('click', function (e) { e.stopPropagation(); clearFile(); });
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

  function setBusy(busy, label) {
    if (busy) {
      continueBtn.disabled = true;
      continueBtn.innerHTML = '<span class="spinner-inline"></span> ' + label;
    } else {
      continueBtn.innerHTML = '<span class="btn-label">Transcribe</span><i class="bi bi-arrow-right ms-2"></i>';
      continueBtn.disabled = !selectedFile;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!selectedFile) return;

    var fd = new FormData();
    fd.append('video', selectedFile);
    fd.append('language', langSelect.value);
    fd.append('summaryType', summarySelect.value);

    setBusy(true, 'Uploading…');
    progressWrap.hidden = false;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/transcripts');
    xhr.upload.onprogress = function (evt) {
      if (evt.lengthComputable) {
        var pct = Math.round((evt.loaded / evt.total) * 100);
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        if (pct === 100) progressLabel.textContent = 'Starting transcription…';
      }
    };
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          window.location = data.redirect || ('/transcript/' + data.transcriptId + '/progress');
        } else {
          FS.toast(data.error || ('Upload failed (' + xhr.status + ')'), 'danger');
          setBusy(false);
        }
      } catch (_) {
        FS.toast('Unexpected upload response.', 'danger');
        setBusy(false);
      }
    };
    xhr.onerror = function () {
      FS.toast('Network error during upload.', 'danger');
      setBusy(false);
    };
    xhr.send(fd);
  });
})();
