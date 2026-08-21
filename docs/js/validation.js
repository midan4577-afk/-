/**
 * validation.js
 * Frontend-only input checks. This is a practice app (not high-stakes),
 * so validation exists to catch typos and keep Results readable — not
 * as a security boundary.
 */

var Validation = (function () {
  /** Standard Israeli ID (ת"ז) check-digit algorithm. */
  function isValidIsraeliId(idRaw) {
    var id = String(idRaw || '').trim();
    if (!/^\d{1,9}$/.test(id)) return false;
    id = id.padStart(9, '0');

    var sum = 0;
    for (var i = 0; i < 9; i++) {
      var digit = Number(id[i]) * ((i % 2) + 1);
      if (digit > 9) digit -= 9;
      sum += digit;
    }
    return sum % 10 === 0;
  }

  function isNonEmptyName(name) {
    return String(name || '').trim().length >= 2;
  }

  return { isValidIsraeliId: isValidIsraeliId, isNonEmptyName: isNonEmptyName };
})();
