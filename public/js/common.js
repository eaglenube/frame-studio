window.FS = window.FS || {};

FS.toast = function (message, variant) {
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var v = variant || 'primary';
  var wrap = document.createElement('div');
  wrap.className = 'toast align-items-center text-bg-' + v + ' border-0';
  wrap.setAttribute('role', 'alert');
  wrap.innerHTML =
    '<div class="d-flex">' +
    '  <div class="toast-body text-white">' + message + '</div>' +
    '  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
    '</div>';
  container.appendChild(wrap);
  var t = new bootstrap.Toast(wrap, { delay: 4000 });
  t.show();
  wrap.addEventListener('hidden.bs.toast', function () {
    wrap.remove();
  });
};

FS.formatBytes = function (bytes) {
  if (!bytes) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = 0;
  var n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return n.toFixed(n >= 10 || i === 0 ? 0 : 1) + ' ' + units[i];
};
