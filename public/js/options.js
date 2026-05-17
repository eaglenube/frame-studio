(function () {
  var form = document.getElementById('optionsForm');
  if (!form) return;
  var jobId = form.getAttribute('data-job-id');
  var quality = document.getElementById('quality');
  var qualityValue = document.getElementById('qualityValue');
  var startBtn = document.getElementById('startBtn');

  quality.addEventListener('input', function () {
    qualityValue.textContent = quality.value;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      fps: document.getElementById('fps').value,
      quality: quality.value,
      format: (document.querySelector('input[name="format"]:checked') || { value: 'jpg' }).value,
      resizeWidth: document.getElementById('resizeWidth').value || null,
    };
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner-inline"></span> Starting…';

    fetch('/api/jobs/' + jobId + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, body: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body.error || 'Failed to start');
        window.location = res.body.redirect || ('/progress/' + jobId);
      })
      .catch(function (err) {
        FS.toast(err.message || 'Could not start extraction.', 'danger');
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="btn-label">Start extraction</span><i class="bi bi-play-fill ms-1"></i>';
      });
  });
})();
