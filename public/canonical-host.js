// Authentication always runs on the administrator origin, never github.io.
// Do not carry query strings or fragments to the canonical origin.
if (window.location.hostname === 'underconnor.github.io') {
  window.location.replace('https://admin-overworld.flyjung.kr/');
}
