/**
 * Sparky Screen Recorder – client configuration shim.
 *
 * When serving the static UI from a different origin than the Next.js API
 * functions, set `window.SPARKY_CONFIG.apiBaseUrl` (or add additional bases)
 * before the rest of the app loads. All configured values are tried in order
 * until a working recordings endpoint is found.
 *
 * Example:
 *   window.SPARKY_CONFIG = {
 *     apiBaseUrl: 'https://sparky-recorder-api.vercel.app',
 *     additionalApiBases: ['https://backup-api.example.com']
 *   };
 *
 * You can also call `window.setSparkyApiBaseUrl('https://your-api.example')`
 * at runtime; the value is persisted to `localStorage` for subsequent visits.
 */
(function(global){
  const root = global || (typeof window !== 'undefined' ? window : {});
  root.SPARKY_CONFIG = root.SPARKY_CONFIG && typeof root.SPARKY_CONFIG === 'object'
    ? root.SPARKY_CONFIG
    : {};

  if(typeof root.SPARKY_CONFIG.apiBaseUrl === 'undefined') {
    root.SPARKY_CONFIG.apiBaseUrl = '';
  }

  if(!Array.isArray(root.SPARKY_CONFIG.additionalApiBases)) {
    const value = root.SPARKY_CONFIG.additionalApiBases;
    root.SPARKY_CONFIG.additionalApiBases = value ? [value] : [];
  }

  if(Array.isArray(root.SPARKY_CONFIG.apiBaseUrls)) {
    // leave as-is
  } else if(typeof root.SPARKY_CONFIG.apiBaseUrls === 'string' && root.SPARKY_CONFIG.apiBaseUrls.trim()) {
    root.SPARKY_CONFIG.apiBaseUrls = root.SPARKY_CONFIG.apiBaseUrls
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  } else {
    root.SPARKY_CONFIG.apiBaseUrls = [];
  }

  root.setSparkyApiBaseUrl = function(url){
    const safeValue = typeof url === 'string' ? url.trim() : '';
    try {
      if(root.localStorage) {
        if(safeValue) {
          root.localStorage.setItem('sparkyApiBaseUrl', safeValue);
        } else {
          root.localStorage.removeItem('sparkyApiBaseUrl');
        }
      }
    } catch(storageError) {
      console.warn('Unable to persist Sparky API base URL override', storageError);
    }
    root.SPARKY_CONFIG.apiBaseUrl = safeValue;
  };
})(typeof window !== 'undefined' ? window : this);
