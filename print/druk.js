/* Zdrowe miejsca we Wrocławiu — generowanie arkuszy do druku (2 × A4 lub A3) i kodu QR. */
(function () {
  'use strict';

  var DANE = window.WDZ_DANE;
  var W = window.WDZ;
  var esc = W.escapeHtml;
  var KAT = DANE.meta.kategorie;
  var MIEJSCA = DANE.miejsca;
  var PX_NA_MM = 96 / 25.4;
  // Podkład: 'osm' (domyślnie, jak na stronie) albo 'sip' (mapa miasta; parametr ?podklad=sip).
  var PODKLAD = /[?&]podklad=sip\b/.test(location.search) ? 'sip' : 'osm';      // przeglądarka drukuje 96 px CSS na cal

  // Szerokości i wysokości map liczymy w całych, parzystych pikselach,
  // żeby obie połówki mapy zszyły się co do piksela.
  function px(mm) { var v = Math.round(mm * PX_NA_MM); return v % 2 ? v + 1 : v; }

  var UKLADY = {
    a4x2: {
      strona: 'A4 landscape',
      // mapa: lewa kartka 277 mm, prawa 100 mm (w tym 12 mm zakładki), wysokość 171 mm
      mapaL: { x: 10, y: 29, w: 277, h: 171 },
      mapaP: { x: 10, y: 29, w: 100, h: 171 },
      zakladka: 12,
      panel: { x: 116, y: 29, w: 171, h: 171 }
    },
    a3: {
      strona: 'A3 landscape',
      mapa: { x: 10, y: 29, w: 236, h: 258 },
      panel: { x: 252, y: 29, w: 158, h: 258 }
    }
  };

  var stan = {
    uklad: 'a4x2',
    url: '',
    autor: '',
    mapy: [],
    wczytane: 0,
    bledyKafelkow: 0
  };

  // ---------- Pomocnicze ----------
  function el(tag, klasa, html) {
    var e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pozycja(e, x, y, w, h) {
    e.style.left = x; e.style.top = y;
    if (w != null) e.style.width = w;
    if (h != null) e.style.height = h;
    return e;
  }
  function zapamietaj(k, v) { try { localStorage.setItem('wdz-druk-' + k, v); } catch (e) { /* brak dostępu */ } }
  function przypomnij(k) { try { return localStorage.getItem('wdz-druk-' + k); } catch (e) { return null; } }

  var przyblizone = MIEJSCA.filter(function (m) { return m.wspolrzedne.status === 'przyblizone'; }).length;

  // ---------- Walidacja adresu do QR ----------
  function sprawdzUrl(tekst) {
    var v = (tekst || '').trim();
    if (!v) return { ok: false, powod: 'Wpisz publiczny adres strony (np. z GitHub Pages), żeby wygenerować kod QR.' };
    var u;
    try { u = new URL(v); } catch (e) { return { ok: false, powod: 'To nie jest poprawny adres internetowy.' }; }
    if (u.protocol !== 'https:') return { ok: false, powod: 'Adres musi zaczynać się od https:// (strona publiczna, nie plik z dysku).' };
    var h = u.hostname.toLowerCase();
    if (h === 'localhost' || /\.local$/.test(h) || /^127\./.test(h) || /^10\./.test(h) ||
        /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '0.0.0.0' || h.indexOf('.') === -1) {
      return { ok: false, powod: 'To adres lokalny — telefon go nie otworzy. Najpierw opublikuj stronę (instrukcja w README).' };
    }
    return { ok: true, url: u.href };
  }

  function svgQr(tekst) {
    var qr = window.qrcode(0, 'M');
    qr.addData(tekst);
    qr.make();
    var n = qr.getModuleCount();
    var cisza = 4;
    var rozmiar = n + 2 * cisza;
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += 'M' + (c + cisza) + ' ' + (r + cisza) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + rozmiar + ' ' + rozmiar +
      '" shape-rendering="crispEdges" role="img" aria-label="Kod QR do strony z mapą">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  // ---------- Panel: legenda, lista, QR, źródła ----------
  function zbudujPanel(geo) {
    var p = pozycja(el('div', 'panel'), geo.x + 'mm', geo.y + 'mm', geo.w + 'mm', geo.h + 'mm');

    var leg = el('section');
    leg.appendChild(el('h2', null, 'Legenda'));
    var ul = el('ul', 'legenda-druk');
    Object.keys(KAT).forEach(function (k) {
      ul.appendChild(el('li', null, '<span class="znak-kat" style="background:' + KAT[k].kolor + '">' +
        W.ikonaSvg(KAT[k].ikona, { rozmiar: 13 }) + '</span>' + esc(KAT[k].nazwa)));
    });
    leg.appendChild(ul);
    p.appendChild(leg);

    var lis = el('section');
    lis.appendChild(el('h2', null, 'Miejsca na mapie'));
    var ol = el('ol', 'lista-druk');
    MIEJSCA.forEach(function (m) {
      var k = KAT[m.kategoria];
      var gw = m.wspolrzedne.status === 'przyblizone' ? ' <span class="przybl">*</span>' : '';
      ol.appendChild(el('li', null,
        '<span class="nr" style="background:' + k.kolor + '">' + m.id + '</span><span>' +
        '<strong>' + esc(m.nazwa) + gw + '</strong>' +
        // Na wydruku tylko krótkie adresy ulic; opisowe lokalizacje parków widać na mapie.
        (/^(ul|al)\.\s/.test(m.adres) ? '<span class="adres">' + esc(m.adres.replace(/\s*\(.*\)$/, '')) + '</span>' : '') +
        esc(m.krotko || W.pierwszeZdanie(m.opis)) + '</span>'));
    });
    lis.appendChild(ol);
    p.appendChild(lis);

    var dol = el('div', 'dol');
    var q = el('section', 'qr-blok');
    var spr = sprawdzUrl(stan.url);
    if (spr.ok) {
      q.appendChild(el('div', 'qr', svgQr(spr.url)));
      q.appendChild(el('div', 'qr-podpis', '<strong>Zeskanuj i zobacz dokładną mapę na telefonie</strong>' +
        '<span class="url">' + esc(spr.url) + '</span>'));
    } else {
      q.appendChild(el('div', 'qr qr--brak', 'BRAK KODU QR<br>— wpisz adres strony w panelu nad arkuszem'));
      q.appendChild(el('div', 'qr-podpis', '<strong>Zeskanuj i zobacz dokładną mapę na telefonie</strong>'));
    }
    dol.appendChild(q);

    var zr = el('section', 'zrodla-druk');
    var autor = stan.autor ? esc(stan.autor) : '______________________________';
    var podklad = PODKLAD === 'sip'
      ? 'podkład mapy: mapa podstawowa Wrocławia, System Informacji Przestrzennej Wrocławia (geoportal.wroclaw.pl). '
      : 'podkład mapy © OpenStreetMap contributors, licencja ODbL — openstreetmap.org/copyright. ';
    var html = '<p><strong>Źródła:</strong> ' + podklad +
      'Dane o miejscach: wroclaw.pl, Wikipedia; położenie miejsc: © OpenStreetMap contributors (ODbL). ' +
      'Zalecenia ruchu: WHO (who.int). Źródło każdego miejsca jest podane na stronie internetowej. ' +
      'Stan danych: ' + esc(W.formatujDate(DANE.meta.data_weryfikacji)) + '. Godziny i ceny sprawdzaj na stronach obiektów.</p>';
    if (przyblizone > 0) {
      html += '<p>* Położenie ' + przyblizone + (przyblizone === 1 ? ' miejsca' : ' miejsc') + ' jest przybliżone i wymaga weryfikacji.</p>';
      html += '<p>Projekt przygotowano z pomocą sztucznej inteligencji (AI).</p>';
    } else {
      html += '<p>Projekt przygotowano z pomocą sztucznej inteligencji (AI). Dane lokalizacyjne zweryfikowano w podanych źródłach.</p>';
    }
    html += '<p><strong>Autor projektu:</strong> ' + autor + '</p>';
    zr.innerHTML = html;
    dol.appendChild(zr);
    p.appendChild(dol);
    return p;
  }

  var WHO_TEKST = 'Ile ruchu? WHO zaleca: młodzież (5–17 lat) — <strong>co najmniej 60 minut dziennie</strong>, ' +
    'dorośli — <strong>co najmniej 150 minut tygodniowo</strong> umiarkowanego wysiłku.';

  function zbudujTytul(czesc, lewo) {
    var t = pozycja(el('header', 'tytul'), lewo + 'mm', '8mm');
    t.style.right = '10mm';
    t.style.height = '17mm';
    if (lewo <= 10) {
      t.innerHTML = '<h1>Zdrowe miejsca we Wrocławiu</h1><p>Mapa miejsc sprzyjających zdrowemu stylowi życia</p>';
      if (!czesc) t.innerHTML += '<p class="who who--a3">' + WHO_TEKST + '</p>';
    } else {
      t.innerHTML = '<p class="who">' + WHO_TEKST + '</p>';
    }
    if (czesc) t.innerHTML += '<p class="tytul__czesc">' + czesc + '</p>';
    return t;
  }

  function pasek(lewo) {
    var p = el('div', 'pasek');
    p.style.left = lewo + 'mm';
    return p;
  }

  // ---------- Mapy ----------
  function nowaMapa(kontener) {
    var m = L.map(kontener, {
      zoomControl: false, attributionControl: true, zoomSnap: 0.25,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
      keyboard: false, touchZoom: false, inertia: false, fadeAnimation: false, zoomAnimation: false
    });
    m.attributionControl.setPrefix(false);
    if (PODKLAD === 'osm') {
      var t = L.tileLayer(W.TILE_URL, { maxZoom: 19, attribution: W.ATTRIBUTION });
      t.on('load', function () { stan.wczytane++; pokazStatus(); });
      t.on('tileerror', function () { stan.bledyKafelkow++; pokazStatus(); });
      t.addTo(m);
    }
    stan.mapy.push(m);
    return m;
  }

  // Podkład z mapy podstawowej Wrocławia (usługa WMS SIP, warunki: „bez ograniczeń”).
  // Jeden obraz na całą mapę, w wyższej rozdzielczości niż ekran — ostry na wydruku.
  var WMS_SIP = 'https://gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpodst/MapServer/WmsServer';
  var WMS_WARSTWY = 'PokrycieTerenu_Zabudowa,PokrycieTerenu_Zielen,ZielenWysoka,Wody,PowierzchnieUlic,LinieKolejowe,GranicaMiasta';
  function dodajPodkladSip(mapa) {
    var crs = L.CRS.EPSG3857, b = mapa.getBounds(), r = mapa.getSize(), skala = 2;
    var sw = crs.project(b.getSouthWest()), ne = crs.project(b.getNorthEast());
    var url = WMS_SIP + '?' + new URLSearchParams({
      service: 'WMS', request: 'GetMap', version: '1.3.0', layers: WMS_WARSTWY, styles: '',
      crs: 'EPSG:3857', bbox: [sw.x, sw.y, ne.x, ne.y].join(','),
      width: r.x * skala, height: r.y * skala, format: 'image/png', transparent: 'false'
    }).toString();
    var img = L.imageOverlay(url, b, { attribution: 'Podkład: SIP Wrocławia' });
    img.on('load', function () { stan.wczytane++; pokazStatus(); });
    img.on('error', function () { stan.bledyKafelkow++; pokazStatus(); });
    img.addTo(mapa);
  }

  // Rozsuwa znaczniki, które na danym powiększeniu nachodziłyby na siebie.
  // Zwraca położenie każdego znacznika w pikselach (globalnych, dla powiększenia z).
  function rozsunZnaczniki(z) {
    var crs = L.CRS.EPSG3857, MIN = 30;
    var pkt = MIEJSCA.map(function (m) {
      var p = crs.latLngToPoint(L.latLng(m.wspolrzedne.lat, m.wspolrzedne.lon), z);
      return { id: m.id, x0: p.x, y0: p.y, x: p.x, y: p.y };
    });
    for (var it = 0; it < 300; it++) {
      var ruch = false;
      for (var i = 0; i < pkt.length; i++) {
        for (var j = i + 1; j < pkt.length; j++) {
          var a = pkt[i], b = pkt[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < MIN) {
            if (d < 0.01) { dx = 1; dy = 0; d = 1; }
            var k = (MIN - d) / 2 + 0.5;
            a.x -= dx / d * k; a.y -= dy / d * k; b.x += dx / d * k; b.y += dy / d * k;
            ruch = true;
          }
        }
      }
      if (!ruch) break;
    }
    return pkt;
  }

  function dodajZnaczniki(mapa, z, pkt) {
    var crs = L.CRS.EPSG3857;
    pkt.forEach(function (p) {
      var mi = MIEJSCA.filter(function (m) { return m.id === p.id; })[0];
      var prawdziwe = crs.pointToLatLng(L.point(p.x0, p.y0), z);
      var pokazane = crs.pointToLatLng(L.point(p.x, p.y), z);
      if (Math.abs(p.x - p.x0) + Math.abs(p.y - p.y0) > 3) {
        // znacznik przesunięty — cienka linia i kropka pokazują dokładne miejsce
        L.polyline([prawdziwe, pokazane], { color: '#1d2a20', weight: 1.2, interactive: false }).addTo(mapa);
        L.circleMarker(prawdziwe, { radius: 2.5, color: '#1d2a20', weight: 1, fillColor: '#1d2a20', fillOpacity: 1, interactive: false }).addTo(mapa);
      }
      L.marker(pokazane, { icon: W.znacznikDruku(KAT[mi.kategoria], mi.id), interactive: false, keyboard: false }).addTo(mapa);
    });
  }

  function wykonczMape(mapa, z, pkt) {
    if (PODKLAD === 'sip') dodajPodkladSip(mapa);
    dodajZnaczniki(mapa, z, pkt);
  }

  // Dobiera powiększenie i środek tak, żeby wszystkie miejsca zmieściły się
  // w obszarze o szerokości szer i wysokości wys (px), z marginesem.
  function dopasuj(szer, wys, margines) {
    var crs = L.CRS.EPSG3857;
    var lats = MIEJSCA.map(function (m) { return m.wspolrzedne.lat; });
    var lons = MIEJSCA.map(function (m) { return m.wspolrzedne.lon; });
    var sw = L.latLng(Math.min.apply(null, lats), Math.min.apply(null, lons));
    var ne = L.latLng(Math.max.apply(null, lats), Math.max.apply(null, lons));
    var a = crs.latLngToPoint(sw, 0), b = crs.latLngToPoint(ne, 0);
    var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    var z = Math.log(Math.min((szer - 2 * margines) / dx, (wys - 2 * margines) / dy)) / Math.LN2;
    z = Math.min(15, Math.floor(z * 4) / 4);
    var pa = crs.latLngToPoint(sw, z), pb = crs.latLngToPoint(ne, z);
    return { zoom: z, srodek: L.point((pa.x + pb.x) / 2, (pa.y + pb.y) / 2) };
  }

  // Ustawia mapę tak, by jej lewy górny róg wypadł dokładnie w punkcie (ox, oy) układu pikseli.
  function ustawOrigin(mapa, ox, oy, zoom, szer, wys) {
    var c = L.CRS.EPSG3857.pointToLatLng(L.point(ox + szer / 2, oy + wys / 2), zoom);
    mapa.setView(c, zoom, { animate: false });
  }

  function arkuszA4x2(kontener) {
    var u = UKLADY.a4x2;
    var wL = px(u.mapaL.w), wP = px(u.mapaP.w), h = px(u.mapaL.h), zak = Math.round(u.zakladka * PX_NA_MM);
    var calosc = wL + wP - zak;                    // szerokość całej mapy po sklejeniu (px)

    // --- arkusz 1 (lewy) ---
    var a1 = el('section', 'arkusz arkusz--a4');
    a1.appendChild(zbudujTytul('część 1/2 — lewa', 10));
    a1.appendChild(pasek(10));
    var m1 = pozycja(el('div', 'mapa'), u.mapaL.x + 'mm', u.mapaL.y + 'mm', wL + 'px', h + 'px');
    a1.appendChild(m1);
    var xCiecia = 'calc(' + u.mapaL.x + 'mm + ' + wL + 'px)';
    a1.appendChild(pozycja(el('div', 'ciecie'), xCiecia, '27mm', null, '177mm'));
    a1.appendChild(pozycja(el('div', 'znak znak--gora'), 'calc(' + xCiecia + ' - 2mm)', '201mm'));
    var opis1 = pozycja(el('div', 'ciecie-opis', '✂ Przytnij kartkę wzdłuż przerywanej linii, a potem połóż ją na zakładce drugiej kartki (strzałki do strzałek).'),
      'calc(' + xCiecia + ' - 150mm)', '202.5mm');
    opis1.style.width = '146mm'; opis1.style.textAlign = 'right';
    a1.appendChild(opis1);
    kontener.appendChild(a1);

    // --- arkusz 2 (prawy) ---
    var a2 = el('section', 'arkusz arkusz--a4');
    var lewoZak = u.mapaP.x + u.zakladka;           // tu wypada krawędź lewej kartki
    a2.appendChild(zbudujTytul('część 2/2 — prawa', lewoZak + 4));
    a2.appendChild(pasek(lewoZak));
    var m2 = pozycja(el('div', 'mapa'), u.mapaP.x + 'mm', u.mapaP.y + 'mm', wP + 'px', h + 'px');
    a2.appendChild(m2);
    var zakEl = pozycja(el('div', 'zakladka', '<span>ZAKŁADKA — posmaruj klejem i połóż na niej lewą kartkę</span>'),
      u.mapaP.x + 'mm', u.mapaP.y + 'mm', zak + 'px', h + 'px');
    a2.appendChild(zakEl);
    a2.appendChild(pozycja(el('div', 'znak znak--gora'), 'calc(' + u.mapaP.x + 'mm + ' + zak + 'px - 2mm)', '201mm'));
    a2.appendChild(zbudujPanel(u.panel));
    kontener.appendChild(a2);

    var mapa1 = nowaMapa(m1), mapa2 = nowaMapa(m2);

    var fit = dopasuj(calosc, h, px(9));
    var ox = Math.round(fit.srodek.x - calosc / 2);
    var oy = Math.round(fit.srodek.y - h / 2);

    // Przesuń całość w poziomie, jeśli jakiś znacznik wypadłby na linii sklejenia.
    var szew = wL;                                 // pozycja szwu w pikselach całej mapy
    var pkt = rozsunZnaczniki(fit.zoom);
    var xs = pkt.map(function (p) { return p.x; });
    var odstep = 22;                               // ok. 6 mm wolnego miejsca od szwu
    function kolizja(o) { return xs.some(function (x) { return Math.abs(x - o - szew) < odstep; }); }
    function mieszczaSie(o) { return xs.every(function (x) { return x - o > 20 && x - o < calosc - 20; }); }
    var najlepszy = ox;
    if (kolizja(ox)) {
      for (var d = 4; d <= 400; d += 4) {
        if (!kolizja(ox + d) && mieszczaSie(ox + d)) { najlepszy = ox + d; break; }
        if (!kolizja(ox - d) && mieszczaSie(ox - d)) { najlepszy = ox - d; break; }
      }
    }
    ustawOrigin(mapa1, najlepszy, oy, fit.zoom, wL, h);
    ustawOrigin(mapa2, najlepszy + wL - zak, oy, fit.zoom, wP, h);
    wykonczMape(mapa1, fit.zoom, pkt);
    wykonczMape(mapa2, fit.zoom, pkt);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapa1);
    return 2;
  }

  function arkuszA3(kontener) {
    var u = UKLADY.a3;
    var w = px(u.mapa.w), h = px(u.mapa.h);
    var a = el('section', 'arkusz arkusz--a3');
    a.appendChild(zbudujTytul('', 10));
    a.appendChild(pasek(10));
    var m = pozycja(el('div', 'mapa'), u.mapa.x + 'mm', u.mapa.y + 'mm', w + 'px', h + 'px');
    a.appendChild(m);
    a.appendChild(zbudujPanel(u.panel));
    kontener.appendChild(a);
    var mapa = nowaMapa(m);
    var fit = dopasuj(w, h, px(10));
    ustawOrigin(mapa, Math.round(fit.srodek.x - w / 2), Math.round(fit.srodek.y - h / 2), fit.zoom, w, h);
    wykonczMape(mapa, fit.zoom, rozsunZnaczniki(fit.zoom));
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapa);
    return 1;
  }

  // ---------- Status ----------
  var statusEl = document.getElementById('status-mapy');
  function pokazStatus() {
    var n = stan.mapy.length;
    if (location.protocol === 'file:' && PODKLAD === 'osm') {
      statusEl.className = 'komunikat blad';
      statusEl.textContent = W.KOMUNIKAT_FILE;
    } else if (stan.bledyKafelkow > 0) {
      statusEl.className = 'komunikat blad';
      statusEl.textContent = 'Część fragmentów mapy się nie wczytała (' + stan.bledyKafelkow + '). Sprawdź internet i odśwież stronę.';
    } else if (stan.wczytane >= n && n > 0) {
      statusEl.className = 'komunikat ok';
      statusEl.textContent = 'Mapa gotowa — możesz drukować.';
    } else {
      statusEl.className = 'komunikat';
      statusEl.textContent = 'Wczytywanie mapy…';
    }
  }

  // ---------- Budowanie ----------
  function zbuduj() {
    stan.mapy.forEach(function (m) { m.remove(); });
    stan.mapy = []; stan.wczytane = 0; stan.bledyKafelkow = 0;
    var kontener = document.getElementById('arkusze');
    kontener.innerHTML = '';
    document.getElementById('styl-strony').textContent =
      '@page { size: ' + (stan.uklad === 'a3' ? UKLADY.a3.strona : UKLADY.a4x2.strona) + '; margin: 0; }';
    var ile = stan.uklad === 'a3' ? arkuszA3(kontener) : arkuszA4x2(kontener);
    document.title = 'Zdrowe miejsca we Wrocławiu — wydruk (' + (stan.uklad === 'a3' ? 'A3' : '2 × A4') + ')';
    pokazStatus();
    return ile;
  }

  function odswiezKomunikatUrl() {
    var k = document.getElementById('komunikat-url');
    var s = sprawdzUrl(stan.url);
    k.className = 'komunikat ' + (s.ok ? 'ok' : 'blad');
    k.textContent = s.ok ? 'Kod QR wygenerowany. Po wydruku zeskanuj go telefonem i sprawdź, czy otwiera stronę.' : s.powod;
  }

  // ---------- Start ----------
  var params = new URLSearchParams(location.search);
  stan.url = params.get('url') || przypomnij('url') || '';
  stan.autor = params.get('autor') || przypomnij('autor') || '';
  if (!stan.autor && DANE.meta.autor && !/^UZUPEŁNIJ/i.test(DANE.meta.autor)) stan.autor = DANE.meta.autor;
  stan.uklad = (params.get('uklad') || przypomnij('uklad')) === 'a3' ? 'a3' : 'a4x2';
  if (PODKLAD === 'sip') document.body.classList.add('podklad-sip');

  // Jeśli strona do druku jest otwarta z publicznego adresu (np. GitHub Pages), podpowiedz adres strony głównej.
  if (!stan.url && location.protocol === 'https:') {
    var kandydat = location.href.split('?')[0].replace(/print\/druk\.html$/, '');
    if (sprawdzUrl(kandydat).ok) stan.url = kandydat;
  }

  var poleUrl = document.getElementById('pole-url');
  var poleAutor = document.getElementById('pole-autor');
  poleUrl.value = stan.url;
  poleAutor.value = stan.autor;
  document.querySelector('input[name="uklad"][value="' + stan.uklad + '"]').checked = true;

  var czasomierz;
  function poZmianie() {
    clearTimeout(czasomierz);
    czasomierz = setTimeout(function () {
      stan.url = poleUrl.value.trim();
      stan.autor = poleAutor.value.trim();
      zapamietaj('url', stan.url); zapamietaj('autor', stan.autor);
      odswiezKomunikatUrl();
      zbuduj();
    }, 400);
  }
  poleUrl.addEventListener('input', poZmianie);
  poleAutor.addEventListener('input', poZmianie);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="uklad"]'), function (r) {
    r.addEventListener('change', function () { stan.uklad = r.value; zapamietaj('uklad', r.value); zbuduj(); });
  });
  document.getElementById('przycisk-drukuj').addEventListener('click', function () { window.print(); });

  odswiezKomunikatUrl();
  zbuduj();

  // Do testów automatycznych.
  window.WDZ_DRUK = { zbuduj: zbuduj, stan: stan, sprawdzUrl: sprawdzUrl };
})();
