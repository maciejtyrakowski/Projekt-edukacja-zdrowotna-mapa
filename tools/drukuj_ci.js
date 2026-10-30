// Generuje pliki PDF do druku (uruchamiane przez GitHub Actions).
// Podkład: mapa podstawowa Wrocławia (WMS SIP, warunki wykorzystania: bez ograniczeń).
const { chromium } = require('playwright');
const fs = require('fs');
const STRONA = 'https://maciejtyrakowski.github.io/Projekt-edukacja-zdrowotna-mapa/';
(async () => {
  fs.mkdirSync('wydruk', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const log = [];
  p.on('console', m => log.push(m.type() + ': ' + m.text()));
  p.on('pageerror', e => log.push('pageerror: ' + e.message));
  for (const uklad of ['a4x2', 'a3']) {
    await p.goto('http://localhost:8000/print/druk.html?podklad=sip&uklad=' + uklad + '&autor=&url=' + encodeURIComponent(STRONA));
    try {
      await p.waitForFunction(() => /Mapa gotowa/.test(document.getElementById('status-mapy').textContent), null, { timeout: 120000 });
      log.push(uklad + ': mapa gotowa');
    } catch (e) {
      log.push(uklad + ': BRAK GOTOWOSCI: ' + await p.textContent('#status-mapy'));
    }
    await p.waitForTimeout(1500);
    const plik = uklad === 'a3' ? 'plakat-A3.pdf' : 'plakat-2xA4.pdf';
    await p.pdf({ path: 'wydruk/' + plik, preferCSSPageSize: true, printBackground: true });
  }
  fs.writeFileSync('wydruk/log.txt', log.join('\n'));
  await b.close();
})();
