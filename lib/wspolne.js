/* Wspólne ustawienia i ikony dla strony (index.html) i wydruku (print/druk.html). */
(function () {
  'use strict';

  // Podkład mapowy. Adres jest w jednym miejscu, żeby w razie potrzeby łatwo go zmienić
  // (zalecenie polityki kafelków OSM: https://operations.osmfoundation.org/policies/tiles/).
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Proste ikony (SVG 24×24, sam kontur).
  var IKONY = {
    drzewo: '<path d="M12 3a5 5 0 0 0-5 5 4.5 4.5 0 0 0 1.2 7.6h7.6A4.5 4.5 0 0 0 17 8a5 5 0 0 0-5-5z"/><path d="M12 15.6V21"/>',
    fala: '<path d="M2.5 9c1.6 0 1.6-1.6 3.2-1.6S7.3 9 8.9 9s1.6-1.6 3.1-1.6S13.6 9 15.2 9s1.6-1.6 3.1-1.6S19.9 9 21.5 9"/><path d="M2.5 15c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6 1.6-1.6 3.1-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.1-1.6 1.6 1.6 3.2 1.6"/>',
    bieg: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V22"/><path d="M6 12.5l3.5-4 4 1 2.5 3.5 3 .5"/><path d="M9.5 8.5L11 15"/>',
    serce: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'
  };

  function ikonaSvg(nazwa, opcje) {
    opcje = opcje || {};
    var rozmiar = opcje.rozmiar || 18;
    var kolor = opcje.kolor || '#fff';
    var grubosc = opcje.grubosc || 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + rozmiar + '" height="' + rozmiar +
      '" fill="none" stroke="' + kolor + '" stroke-width="' + grubosc +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IKONY[nazwa] || '') + '</svg>';
  }

  // Znacznik na stronie: kolorowe kółko z ikoną kategorii i numerem.
  function znacznikStrony(kat, nr) {
    return L.divIcon({
      className: 'wdz-znacznik',
      html: '<span class="wdz-znacznik__kolo" style="background:' + kat.kolor + '">' + ikonaSvg(kat.ikona, { rozmiar: 18 }) +
        '</span><span class="wdz-znacznik__nr">' + nr + '</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  // Znacznik do druku: kolorowe kółko z dużym numerem (czytelny na papierze).
  function znacznikDruku(kat, nr) {
    return L.divIcon({
      className: 'wdz-druk-znacznik',
      html: '<span style="background:' + kat.kolor + '">' + nr + '</span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatujDate(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso;
  }

  function pierwszeZdanie(tekst) {
    var m = String(tekst || '').match(/^.*?[.!?](\s|$)/);
    return (m ? m[0] : tekst).trim();
  }

  var KOMUNIKAT_FILE = 'Podkład mapy nie wczyta się z pliku otwartego z dysku: serwer OpenStreetMap ' +
    'odrzuca takie zapytania. Otwórz stronę z internetu (np. GitHub Pages) albo uruchom w folderze projektu ' +
    '„python -m http.server 8000” i wejdź na http://localhost:8000.';

  window.WDZ = {
    KOMUNIKAT_FILE: KOMUNIKAT_FILE,
    TILE_URL: TILE_URL,
    ATTRIBUTION: ATTRIBUTION,
    ikonaSvg: ikonaSvg,
    znacznikStrony: znacznikStrony,
    znacznikDruku: znacznikDruku,
    escapeHtml: escapeHtml,
    formatujDate: formatujDate,
    pierwszeZdanie: pierwszeZdanie
  };
})();
