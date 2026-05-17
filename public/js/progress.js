(function () {
  var card = document.querySelector('.progress-card');
  if (!card) return;
  var jobId = card.getAttribute('data-job-id');

  var bar = document.getElementById('bigProgressBar');
  var pctEl = document.getElementById('progressPct');
  var frameCount = document.getElementById('frameCount');
  var statusLabel = document.getElementById('statusLabel');
  var stageLabel = document.getElementById('stageLabel');
  var errorBox = document.getElementById('errorBox');
  var errorMessage = document.getElementById('errorMessage');

  function stageFor(status, pct) {
    if (status === 'pending') return 'Queued… warming up FFmpeg';
    if (status === 'processing' && pct < 10) return 'Reading video metadata…';
    if (status === 'processing' && pct < 90) return 'Extracting frames…';
    if (status === 'processing') return 'Finalizing output…';
    if (status === 'completed') return 'All done!';
    if (status === 'failed') return 'Something went wrong';
    return '…';
  }

  function tick() {
    fetch('/api/jobs/' + jobId + '/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var pct = Math.max(0, Math.min(100, d.progress || 0));
        bar.style.width = pct + '%';
        bar.setAttribute('aria-valuenow', String(pct));
        pctEl.textContent = String(pct);
        frameCount.textContent = String(d.extractedCount || d.totalImages || 0);
        statusLabel.textContent = d.status;
        stageLabel.textContent = stageFor(d.status, pct);

        if (d.status === 'completed') {
          bar.classList.remove('progress-bar-animated', 'progress-bar-striped');
          setTimeout(function () {
            window.location = '/gallery/' + jobId;
          }, 700);
          return;
        }
        if (d.status === 'failed') {
          bar.classList.remove('progress-bar-animated', 'progress-bar-striped');
          errorBox.classList.remove('d-none');
          errorMessage.textContent = d.errorMessage || 'Unknown error.';
          return;
        }
        setTimeout(tick, 1000);
      })
      .catch(function () {
        setTimeout(tick, 2000);
      });
  }

  tick();
})();
