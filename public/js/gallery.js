(function () {
  var toolbar = document.querySelector('.gallery-toolbar');
  if (!toolbar) return;
  var jobId = toolbar.getAttribute('data-job-id');
  var total = parseInt(toolbar.getAttribute('data-total'), 10) || 0;

  var grid = document.getElementById('gallery');
  var loadMoreBtn = document.getElementById('loadMoreBtn');
  var statusEl = document.getElementById('galleryStatus');
  var selectedCountEl = document.getElementById('selectedCount');
  var totalCountEl = document.getElementById('totalCount');
  var toggleAllBtn = document.getElementById('toggleAllBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var saveDriveBtn = document.getElementById('saveDriveBtn');
  var lightboxDriveBtn = document.getElementById('lightboxDriveBtn');

  // Lightbox refs
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxLoading = document.getElementById('lightboxLoading');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxPrev = document.getElementById('lightboxPrev');
  var lightboxNext = document.getElementById('lightboxNext');
  var lightboxDownload = document.getElementById('lightboxDownload');
  var lightboxToggleSelect = document.getElementById('lightboxToggleSelect');
  var lbFrame = document.getElementById('lbFrame');
  var lbTimestamp = document.getElementById('lbTimestamp');
  var lbPosition = document.getElementById('lbPosition');
  var lbSelectLabel = document.getElementById('lbSelectLabel');

  var page = 0;
  var limit = 24;
  var hasMore = true;
  var loading = false;
  var pageImageIds = []; // ids on the most recently loaded page
  var selected = new Set();

  // Master list of all loaded images, ordered by frameNumber, for lightbox nav
  var allImages = [];
  var lbIndex = -1;

  function fmtTime(t) {
    if (!isFinite(t)) return '';
    var s = Math.floor(t);
    var ms = Math.round((t - s) * 1000);
    var mm = Math.floor(s / 60);
    var ss = s % 60;
    return (
      String(mm).padStart(2, '0') + ':' +
      String(ss).padStart(2, '0') + '.' +
      String(ms).padStart(3, '0')
    );
  }

  function updateSelection() {
    selectedCountEl.textContent = String(selected.size);
    totalCountEl.textContent = String(total);
    downloadBtn.disabled = selected.size === 0;
    if (saveDriveBtn) saveDriveBtn.disabled = selected.size === 0;
  }

  function setCardSelected(id, isSelected) {
    var card = grid.querySelector('.thumb-card[data-id="' + id + '"]');
    if (!card) return;
    if (isSelected) card.classList.add('is-selected');
    else card.classList.remove('is-selected');
  }

  function renderImages(images) {
    pageImageIds = images.map(function (i) { return i.id; });
    allImages = allImages.concat(images);
    var frag = document.createDocumentFragment();
    images.forEach(function (img) {
      var card = document.createElement('div');
      card.className = 'thumb-card';
      card.dataset.id = img.id;
      if (selected.has(img.id)) card.classList.add('is-selected');
      card.innerHTML =
        '<img loading="lazy" src="' + img.filepath + '" alt="Frame ' + img.frameNumber + '" />' +
        '<div class="thumb-badge"><i class="bi bi-check-lg"></i></div>' +
        '<button type="button" class="thumb-view" aria-label="Preview frame ' + img.frameNumber + '">' +
        '  <i class="bi bi-arrows-fullscreen"></i>' +
        '</button>' +
        '<div class="thumb-meta">' +
        '  <span>#' + img.frameNumber + '</span>' +
        '  <span>' + fmtTime(img.timestamp) + '</span>' +
        '</div>';

      var viewBtn = card.querySelector('.thumb-view');
      viewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = allImages.findIndex(function (it) { return it.id === img.id; });
        if (idx >= 0) openLightbox(idx);
      });

      card.addEventListener('click', function () {
        if (selected.has(img.id)) {
          selected.delete(img.id);
          card.classList.remove('is-selected');
        } else {
          selected.add(img.id);
          card.classList.add('is-selected');
        }
        updateSelection();
        updateToggleAllLabel();
      });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  function fetchPage() {
    if (loading || !hasMore) return;
    loading = true;
    page += 1;
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = '<span class="spinner-inline"></span> Loading…';
    fetch('/api/jobs/' + jobId + '/images?page=' + page + '&limit=' + limit, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.images && d.images.length) renderImages(d.images);
        hasMore = !!d.hasMore;
        total = d.total || total;
        updateSelection();
        updateToggleAllLabel();
        if (!hasMore) {
          loadMoreBtn.hidden = true;
          statusEl.textContent = 'All ' + total + ' frames loaded.';
        }
      })
      .catch(function () {
        FS.toast('Could not load more images.', 'danger');
      })
      .finally(function () {
        loading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = '<span class="btn-label">Load more</span><i class="bi bi-arrow-down-circle ms-1"></i>';
      });
  }

  function updateToggleAllLabel() {
    var allSelected = pageImageIds.length > 0 && pageImageIds.every(function (id) { return selected.has(id); });
    if (allSelected) {
      toggleAllBtn.innerHTML = '<i class="bi bi-x-square me-1"></i> Deselect all on page';
    } else {
      toggleAllBtn.innerHTML = '<i class="bi bi-check2-square me-1"></i> Select all on page';
    }
  }

  // ---------- Lightbox ----------

  function openLightbox(index) {
    if (index < 0 || index >= allImages.length) return;
    lbIndex = index;
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    showCurrent();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImg.removeAttribute('src');
    lbIndex = -1;
  }

  function showCurrent() {
    var img = allImages[lbIndex];
    if (!img) return;
    lightboxLoading.hidden = false;
    lightboxImg.classList.remove('is-ready');
    lightboxImg.alt = 'Frame ' + img.frameNumber;
    lightboxImg.src = img.filepath;
    lightboxImg.onload = function () {
      lightboxLoading.hidden = true;
      lightboxImg.classList.add('is-ready');
    };
    lightboxImg.onerror = function () {
      lightboxLoading.hidden = true;
      FS.toast('Could not load image.', 'danger');
    };
    lbFrame.textContent = String(img.frameNumber);
    lbTimestamp.textContent = fmtTime(img.timestamp);
    lbPosition.textContent = (lbIndex + 1) + ' of ' + (hasMore ? total : allImages.length);
    lightboxDownload.href = img.filepath;
    lightboxDownload.setAttribute('download', img.filename);
    updateLbSelectButton();

    lightboxPrev.disabled = lbIndex <= 0;
    lightboxNext.disabled = lbIndex >= allImages.length - 1;
  }

  function updateLbSelectButton() {
    var img = allImages[lbIndex];
    if (!img) return;
    if (selected.has(img.id)) {
      lbSelectLabel.textContent = 'Deselect';
      lightboxToggleSelect.classList.add('is-selected');
    } else {
      lbSelectLabel.textContent = 'Select';
      lightboxToggleSelect.classList.remove('is-selected');
    }
  }

  function navLightbox(delta) {
    var next = lbIndex + delta;
    if (next < 0 || next >= allImages.length) return;
    lbIndex = next;
    showCurrent();
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', function () { navLightbox(-1); });
  lightboxNext.addEventListener('click', function () { navLightbox(1); });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  lightboxToggleSelect.addEventListener('click', function () {
    var img = allImages[lbIndex];
    if (!img) return;
    if (selected.has(img.id)) selected.delete(img.id);
    else selected.add(img.id);
    setCardSelected(img.id, selected.has(img.id));
    updateSelection();
    updateToggleAllLabel();
    updateLbSelectButton();
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') navLightbox(-1);
    else if (e.key === 'ArrowRight') navLightbox(1);
    else if (e.key === ' ') {
      e.preventDefault();
      lightboxToggleSelect.click();
    }
  });

  // ---------- Toolbar actions ----------

  toggleAllBtn.addEventListener('click', function () {
    if (pageImageIds.length === 0) return;
    var allSelected = pageImageIds.every(function (id) { return selected.has(id); });
    pageImageIds.forEach(function (id) {
      if (allSelected) selected.delete(id);
      else selected.add(id);
    });
    Array.prototype.forEach.call(grid.querySelectorAll('.thumb-card'), function (card) {
      if (pageImageIds.indexOf(card.dataset.id) === -1) return;
      if (allSelected) card.classList.remove('is-selected');
      else card.classList.add('is-selected');
    });
    updateSelection();
    updateToggleAllLabel();
  });

  loadMoreBtn.addEventListener('click', fetchPage);

  downloadBtn.addEventListener('click', function () {
    if (selected.size === 0) return;
    var ids = Array.from(selected);
    downloadBtn.disabled = true;
    var original = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<span class="spinner-inline"></span> Preparing ZIP…';

    fetch('/api/jobs/' + jobId + '/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: ids }),
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (d) { throw new Error(d.error || 'Download failed'); });
        }
        return r.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'extracted-images-' + jobId.slice(0, 8) + '.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        FS.toast('Download started.', 'success');
      })
      .catch(function (err) {
        FS.toast(err.message || 'Could not download.', 'danger');
      })
      .finally(function () {
        downloadBtn.disabled = selected.size === 0;
        downloadBtn.innerHTML = original;
      });
  });

  // ---------- Save to Google Drive ----------

  function saveImagesToDrive(imageIds, label, triggerBtn) {
    if (!imageIds || imageIds.length === 0) return;

    // Defer to sign-in if the user isn't logged in yet — bring them back here.
    if (!window.__IS_LOGGED_IN__) {
      var next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location = '/login?next=' + next;
      return;
    }

    if (!window.FS || !FS.drive) {
      FS.toast('Drive integration is not available.', 'danger');
      return;
    }

    var originalHtml = triggerBtn ? triggerBtn.innerHTML : null;
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = '<span class="spinner-inline"></span> Opening Drive…';
    }

    FS.drive
      .pickFolderAndSave(jobId, imageIds)
      .then(function (outcome) {
        if (!outcome) return; // cancelled
        var r = outcome.result;
        FS.toast(
          'Saved ' + r.uploaded + ' ' + label + ' to "' + outcome.folder.name + '".',
          'success'
        );
      })
      .catch(function (err) {
        FS.toast(err.message || 'Drive save failed.', 'danger');
      })
      .finally(function () {
        if (triggerBtn && originalHtml !== null) {
          triggerBtn.disabled = imageIds.length === 0;
          triggerBtn.innerHTML = originalHtml;
        }
      });
  }

  if (saveDriveBtn) {
    saveDriveBtn.addEventListener('click', function () {
      if (selected.size === 0) return;
      saveImagesToDrive(
        Array.from(selected),
        selected.size === 1 ? 'image' : 'images',
        saveDriveBtn
      );
    });
  }

  if (lightboxDriveBtn) {
    lightboxDriveBtn.addEventListener('click', function () {
      var img = allImages[lbIndex];
      if (!img) return;
      // Close the lightbox first so Google's Picker isn't covered by our overlay.
      closeLightbox();
      saveImagesToDrive([img.id], 'image', null);
    });
  }

  updateSelection();
  fetchPage();
})();
