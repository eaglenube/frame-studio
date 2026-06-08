(function () {
  var card = document.querySelector('[data-transcript-id]');
  if (!card) return;
  var id = card.getAttribute('data-transcript-id');

  var bar = document.getElementById('bigProgressBar');
  var pct = document.getElementById('progressPct');
  var stageLabel = document.getElementById('stageLabel');
  var statusLabel = document.getElementById('statusLabel');
  var errorBox = document.getElementById('errorBox');
  var errorMsg = document.getElementById('errorMessage');

  var STAGE_TEXT = {
    pending: 'Queued…',
    extracting_audio: 'Extracting audio with ffmpeg…',
    transcribing: 'Transcribing (this can take a while)…',
    summarizing: 'Writing the AI summary…',
    completed: 'Done!',
    failed: 'Transcription failed.',
  };

  function poll() {
    fetch('/api/transcripts/' + id + '/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var p = Math.max(0, Math.min(100, data.progress || 0));
        bar.style.width = p + '%';
        bar.setAttribute('aria-valuenow', String(p));
        pct.textContent = p;
        statusLabel.textContent = (data.status || 'pending').replace(/_/g, ' ');
        stageLabel.textContent = STAGE_TEXT[data.status] || data.status;

        if (data.status === 'completed') {
          window.location = '/transcript/' + id;
          return;
        }
        if (data.status === 'failed') {
          bar.classList.remove('progress-bar-animated', 'progress-bar-striped');
          bar.classList.add('bg-danger');
          errorBox.classList.remove('d-none');
          errorMsg.textContent = data.errorMessage || 'Unknown error.';
          return;
        }
        setTimeout(poll, 1500);
      })
      .catch(function () {
        setTimeout(poll, 3000);
      });
  }
  poll();
})();
