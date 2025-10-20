// Mood2Movie Debug Logger: helps diagnose session loss across refresh
(function() {
  const KEY = 'm2m_debug_logs';
  const MAX = 400;
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function write(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {} }
  function redact(obj) {
    try {
      const copy = JSON.parse(JSON.stringify(obj || null));
      function hide(o) {
        if (!o || typeof o !== 'object') return;
        if ('access_token' in o) o.access_token = '[redacted]';
        if ('refresh_token' in o) o.refresh_token = '[redacted]';
        if ('provider_token' in o) o.provider_token = '[redacted]';
      }
      hide(copy);
      if (copy?.session) hide(copy.session);
      if (copy?.user) {
        copy.user = { id: copy.user.id, email: copy.user.email };
      }
      return copy;
    } catch { return null; }
  }
  function log(event, data) {
    const entry = {
      event,
      when: new Date().toISOString(),
      href: location.href,
      origin: location.origin,
      host: location.host,
      port: location.port,
      data: redact(data),
    };
    const arr = read();
    arr.push(entry);
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    write(arr);
    try { console.log('[M2M_DEBUG]', entry); } catch {}
  }
  function info() {
    return {
      href: location.href,
      origin: location.origin,
      host: location.host,
      port: location.port,
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      storageKeys: Object.keys(localStorage || {}),
    };
  }
  function clear() { try { localStorage.removeItem(KEY); } catch {} }
  function get() { return read(); }
  function download() {
    const blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'm2m_debug_logs.json';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); try { a.remove(); } catch {} }, 3000);
  }
  window.M2M_DEBUG = { log, info, clear, get, download };
  try { log('PAGE_LOAD', { info: info() }); } catch {}
})();