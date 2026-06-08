(function () {
  // Copy-to-clipboard button. Falls back to a hidden textarea + execCommand
  // for older browsers / non-https contexts where navigator.clipboard is
  // unavailable.
  var copyBtn = document.getElementById('copyTranscriptBtn');
  if (copyBtn) {
    var labelEl = copyBtn.querySelector('.copy-label');
    var iconEl = copyBtn.querySelector('i');
    var resetTimer = null;
    copyBtn.addEventListener('click', function () {
      // Pull the plain text from the always-rendered "text" tab so we don't
      // have to ship the full transcript twice (once in the DOM, once in
      // a data attribute).
      var plain = document.querySelector('[data-view="text"] .transcript-plain')
               || document.querySelector('.transcript-plain');
      var text = plain ? (plain.textContent || '').trim() : '';
      copyText(text).then(function () {
        copyBtn.classList.add('is-copied');
        if (iconEl) {
          iconEl.classList.remove('bi-clipboard');
          iconEl.classList.add('bi-check2');
        }
        if (labelEl) labelEl.textContent = 'Copied!';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          copyBtn.classList.remove('is-copied');
          if (iconEl) {
            iconEl.classList.add('bi-clipboard');
            iconEl.classList.remove('bi-check2');
          }
          if (labelEl) labelEl.textContent = 'Copy';
        }, 1800);
      }).catch(function () {
        if (window.FS && FS.toast) FS.toast('Could not copy to clipboard.', 'danger');
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) { reject(err); }
    });
  }

  var tabs = document.querySelectorAll('.transcript-tab');
  var bodies = document.querySelectorAll('.transcript-body');
  if (!tabs.length) return;

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var view = t.getAttribute('data-view');
      tabs.forEach(function (x) { x.classList.toggle('is-active', x === t); });
      bodies.forEach(function (b) {
        b.hidden = b.getAttribute('data-view') !== view;
      });
    });
  });

  // Render the markdown summary client-side. We use a tiny inline renderer
  // for headings, bullets, bold, italic, and code spans — enough for the
  // shape of the prompts in summaryService.
  var summary = document.getElementById('summaryBody');
  if (summary) {
    var md = summary.textContent || '';
    summary.innerHTML = renderMarkdown(md);
  }

  function escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderInline(s) {
    s = escape(s);
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }

  function renderMarkdown(md) {
    var lines = md.split(/\r?\n/);
    var out = [];
    var inList = false;
    function closeList() {
      if (inList) { out.push('</ul>'); inList = false; }
    }
    lines.forEach(function (line) {
      var l = line.trimEnd();
      if (/^#{1,6}\s+/.test(l)) {
        closeList();
        var m = l.match(/^(#{1,6})\s+(.*)$/);
        var level = m[1].length;
        out.push('<h' + level + '>' + renderInline(m[2]) + '</h' + level + '>');
      } else if (/^[-*]\s+/.test(l)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + renderInline(l.replace(/^[-*]\s+/, '')) + '</li>');
      } else if (!l.trim()) {
        closeList();
      } else {
        closeList();
        out.push('<p>' + renderInline(l) + '</p>');
      }
    });
    closeList();
    return out.join('\n');
  }
})();
