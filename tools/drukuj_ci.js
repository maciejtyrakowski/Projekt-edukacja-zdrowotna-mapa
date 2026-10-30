// Generuje pliki PDF do druku (uruchamiane przez GitHub Actions).
// Podkład: mapa podstawowa Wrocławia (WMS SIP, warunki wykorzystania: bez ograniczeń).
const { chromium } = require('playwright');
const fs = require('fs');
const STRONA = 'https://maciejtyrakowski.github.io/Projekt-edukacja-zdrowotna-mapa/';
(async () => {
  fs.mkdirSync('wydruk', { recursive: true });
  const b = await chromium.launch();
  const log = [];
  let ok = true;
  for (const uklad of ['a4x2', 'a3']) {
    let gotowe = false;
    for (let proba = 1; proba <= 4 && !gotowe; proba++) {
      const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
      p.on('pageerror', e => log.push('pageerror: ' + e.message));
      try {
        await p.goto('http://localhost:8000/print/druk.html?podklad=sip&uklad=' + uklad + '&autor=&url=' + encodeURIComponent(STRONA),
          { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForFunction(() => /Mapa gotowa/.test(document.getElementById('status-mapy').textContent), null, { timeout: 120000 });
        await p.waitForTimeout(1500);
        const plik = uklad === 'a3' ? 'plakat-A3.pdf' : 'plakat-2xA4.pdf';
        await p.pdf({ path: 'wydruk/' + plik, preferCSSPageSize: true, printBackground: true });
        log.push(uklad + ': mapa gotowa (próba ' + proba + ')');
        gotowe = true;
      } catch (e) {
        let st = ''; try { st = await p.textContent('#status-mapy'); } catch (x) {}
        log.push(uklad + ': próba ' + proba + ' nieudana: ' + e.message.split('\n')[0] + ' | status: ' + st);
        await new Promise(r => setTimeout(r, 15000));
      }
      await p.close();
    }
    if (!gotowe) ok = false;
  }
  fs.writeFileSync('wydruk/log.txt', log.join('\n'));
  console.log(log.join('\n'));
  await b.close();
  process.exit(ok ? 0 : 1);
})();
