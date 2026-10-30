/* Zdrowe miejsca we Wrocławiu — interaktywna mapa (Leaflet 1.9.4). */
(function () {
  'use strict';

  var DANE = window.WDZ_DANE;
  var W = window.WDZ;
  var esc = W.escapeHtml;

  if (!DANE || !window.L) {
    document.getElementById('mapa').innerHTML =
      '<p class="blad">Nie udało się wczytać danych mapy. Sprawdź, czy pliki <code>data/places.js</code> i <code>lib/leaflet/leaflet.js</code> są na miejscu.</p>';
    return;
  }

  var KAT = DANE.meta.kategorie;
  var miejsca = DANE.miejsca;
  var aktywne = {};                 // kategoria -> true/false
  Object.keys(KAT).forEach(function (k) { aktywne[k] = true; });

  var trybEdycji = /[?&]edycja=1\b/.test(location.search);

  // ---------- Mapa ----------
  var mapa = L.map('mapa', {
    zoomControl: true,
    scrollWheelZoom: true,
    tap: true
  });
  var kafelki = L.tileLayer(W.TILE_URL, {
    maxZoom: 19,
    attribution: W.ATTRIBUTION
  }).addTo(mapa);

  // Serwer kafelków OSM wymaga nagłówka Referer, którego przeglądarka nie wysyła
  // ze strony otwartej z dysku (file://). Wtedy podkład się nie wczyta.
  var uwagaMapy = document.getElementById('uwaga-mapy');
  function pokazUwage(tekst) { uwagaMapy.textContent = tekst; uwagaMapy.hidden = false; }
  if (location.protocol === 'file:') {
    pokazUwage(W.KOMUNIKAT_FILE);
  } else {
    var bledy = 0;
    kafelki.on('tileerror', function () {
      if (++bledy === 3) pokazUwage('Podkład mapy się nie wczytuje. Sprawdź połączenie z internetem i odśwież stronę.');
    });
  }
  L.control.scale({ imperial: false }).addTo(mapa);

  var warstwa = L.featureGroup().addTo(mapa);
  var znaczniki = {};               // id -> marker

  function linkOsm(m) {
    var w = m.wspolrzedne;
    return 'https://www.openstreetmap.org/?mlat=' + w.lat + '&mlon=' + w.lon + '#map=17/' + w.lat + '/' + w.lon;
  }

  function trescOkienka(m) {
    var k = KAT[m.kategoria];
    var w = m.wspolrzedne;
    var html = '<div class="okienko">' +
      '<p class="okienko__kat" style="--kolor:' + k.kolor + '">' + W.ikonaSvg(k.ikona, { rozmiar: 14, kolor: k.kolor }) + esc(k.nazwa) + '</p>' +
      '<h3>' + m.id + '. ' + esc(m.nazwa) + '</h3>' +
      '<p class="okienko__adres">' + esc(m.adres) + '</p>' +
      '<p>' + esc(m.opis) + '</p>' +
      '<p class="okienko__zdrowie"><strong>Dla zdrowia:</strong> ' + esc(m.korzysc) + '</p>';
    if (m.uwagi) html += '<p class="okienko__uwaga">' + esc(m.uwagi) + '</p>';
    if (w.status === 'przyblizone') {
      html += '<p class="okienko__ostrzezenie">Położenie znacznika jest przybliżone i czeka na weryfikację.</p>';
    }
    html += '<p class="okienko__zrodla">Źródła: ' + m.zrodla.map(function (z) {
      return '<a href="' + esc(z.url) + '" target="_blank" rel="noopener">' + esc(z.nazwa) + '</a>';
    }).join(' · ') + '</p>';
    html += '<p class="okienko__link"><a href="' + linkOsm(m) + '" target="_blank" rel="noopener">Otwórz w OpenStreetMap</a></p>';
    return html + '</div>';
  }

  miejsca.forEach(function (m) {
    var k = KAT[m.kategoria];
    var mk = L.marker([m.wspolrzedne.lat, m.wspolrzedne.lon], {
      icon: W.znacznikStrony(k, m.id),
      title: m.nazwa,
      alt: m.nazwa,
      keyboard: true
    });
    mk.bindPopup(trescOkienka(m), { maxWidth: 300, autoPanPaddingTopLeft: [10, 60] });
    mk.on('popupopen', function () { zaznaczNaLiscie(m.id); });
    znaczniki[m.id] = mk;
  });

  // ---------- Filtry ----------
  var filtryEl = document.getElementById('filtry');
  Object.keys(KAT).forEach(function (klucz) {
    var k = KAT[klucz];
    var ile = miejsca.filter(function (m) { return m.kategoria === klucz; }).length;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'filtr';
    b.dataset.kategoria = klucz;
    b.style.setProperty('--kolor', k.kolor);
    b.setAttribute('aria-pressed', 'true');
    b.innerHTML = '<span class="filtr__ikona">' + W.ikonaSvg(k.ikona, { rozmiar: 16 }) + '</span>' +
      '<span class="filtr__nazwa">' + esc(k.nazwa) + '</span><span class="filtr__ile">' + ile + '</span>';
    b.addEventListener('click', function () {
      aktywne[klucz] = !aktywne[klucz];
      odswiez(true);
    });
    filtryEl.appendChild(b);
  });

  document.getElementById('pokaz-wszystkie').addEventListener('click', function () {
    Object.keys(aktywne).forEach(function (k) { aktywne[k] = true; });
    mapa.closePopup();
    odswiez(true);
  });

  // ---------- Lista ----------
  var listaEl = document.getElementById('lista');
  miejsca.forEach(function (m) {
    var k = KAT[m.kategoria];
    var li = document.createElement('li');
    li.className = 'pozycja';
    li.dataset.id = m.id;
    li.dataset.kategoria = m.kategoria;
    li.innerHTML = '<button type="button" class="pozycja__przycisk">' +
      '<span class="pozycja__nr" style="background:' + k.kolor + '">' + m.id + '</span>' +
      '<span class="pozycja__tekst"><span class="pozycja__nazwa">' + esc(m.nazwa) + '</span>' +
      '<span class="pozycja__adres">' + esc(m.adres) + '</span>' +
      (m.wspolrzedne.status === 'przyblizone' ? '<span class="pozycja__znaczek">położenie przybliżone</span>' : '') +
      '</span></button>';
    li.querySelector('button').addEventListener('click', function () {
      var mk = znaczniki[m.id];
      if (window.matchMedia('(max-width: 899px)').matches) {
        document.getElementById('mapa').scrollIntoView({ block: 'start' });
      }
      // Bez animacji: inaczej przesuwanie mapy koliduje z autoPan okienka
      // i okienko wychodzi poza górną krawędź mapy na telefonie.
      mapa.setView(mk.getLatLng(), Math.max(mapa.getZoom(), 15), { animate: false });
      mk.openPopup();
    });
    listaEl.appendChild(li);
  });

  function zaznaczNaLiscie(id) {
    Array.prototype.forEach.call(listaEl.children, function (li) {
      li.classList.toggle('pozycja--aktywna', String(li.dataset.id) === String(id));
    });
  }

  function odswiez(dopasuj) {
    warstwa.clearLayers();
    var widoczne = 0;
    miejsca.forEach(function (m) {
      if (aktywne[m.kategoria]) { warstwa.addLayer(znaczniki[m.id]); widoczne++; }
    });
    Array.prototype.forEach.call(filtryEl.children, function (b) {
      b.setAttribute('aria-pressed', aktywne[b.dataset.kategoria] ? 'true' : 'false');
    });
    Array.prototype.forEach.call(listaEl.children, function (li) {
      li.hidden = !aktywne[li.dataset.kategoria];
    });
    document.getElementById('licznik').textContent = '(' + widoczne + ' z ' + miejsca.length + ')';
    if (dopasuj && widoczne > 0) {
      mapa.fitBounds(warstwa.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }
  }

  odswiez(false);
  mapa.fitBounds(warstwa.getBounds(), { padding: [30, 30], maxZoom: 15 });

  // ---------- Legenda, źródła, stan danych ----------
  var legenda = document.getElementById('legenda');
  Object.keys(KAT).forEach(function (klucz) {
    var k = KAT[klucz];
    var li = document.createElement('li');
    li.innerHTML = '<span class="legenda__znak" style="background:' + k.kolor + '">' + W.ikonaSvg(k.ikona, { rozmiar: 16 }) + '</span>' + esc(k.nazwa);
    legenda.appendChild(li);
  });

  var zr = document.getElementById('zrodla-ogolne');
  (DANE.meta.zrodla_ogolne || []).forEach(function (z) {
    var li = document.createElement('li');
    li.innerHTML = '<a href="' + esc(z.url) + '" target="_blank" rel="noopener">' + esc(z.nazwa) + '</a>';
    zr.appendChild(li);
  });

  var przyblizone = miejsca.filter(function (m) { return m.wspolrzedne.status === 'przyblizone'; }).length;
  var data = W.formatujDate(DANE.meta.data_weryfikacji);
  var stan = document.getElementById('stan-danych');
  var ai = document.getElementById('ai-info');
  if (przyblizone === 0) {
    stan.textContent = 'Nazwy, adresy i położenie wszystkich ' + miejsca.length + ' miejsc sprawdzono w źródłach podanych przy każdym miejscu. Stan na ' + data + '.';
    ai.textContent = 'Przy przygotowaniu projektu pomagała sztuczna inteligencja (AI). Dane lokalizacyjne zostały zweryfikowane w podanych źródłach.';
  } else {
    stan.textContent = 'Nazwy i adresy sprawdzono w źródłach podanych przy każdym miejscu (stan na ' + data + '). ' +
      'Położenie ' + przyblizone + ' z ' + miejsca.length + ' znaczników jest przybliżone i czeka na weryfikację. Takie miejsca są oznaczone na liście.';
    ai.textContent = 'Przy przygotowaniu projektu pomagała sztuczna inteligencja (AI). Weryfikacja położenia części znaczników nie została jeszcze zakończona.';
  }
  if (DANE.meta.who) {
    document.getElementById('who').innerHTML = esc(DANE.meta.who.tekst) +
      ' <a href="' + esc(DANE.meta.who.url) + '" target="_blank" rel="noopener">Źródło: WHO</a>';
  }

  // ---------- Tryb sprawdzania współrzędnych (?edycja=1) ----------
  if (trybEdycji) {
    document.getElementById('podpowiedz-edycja').hidden = false;
    mapa.on('click', function (e) {
      var t = e.latlng.lat.toFixed(6) + ', ' + e.latlng.lng.toFixed(6);
      L.popup().setLatLng(e.latlng).setContent('<p>Współrzędne punktu:</p><p><code>' + t + '</code></p>').openOn(mapa);
    });
  }
})();
