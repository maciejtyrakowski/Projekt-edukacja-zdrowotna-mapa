#!/usr/bin/env python3
"""Sprawdza współrzędne miejsc w OpenStreetMap (usługa Nominatim).

Uruchom NA SWOIM KOMPUTERZE (potrzebny internet, wystarczy sam Python 3, bez instalacji):

    python tools/sprawdz_wspolrzedne.py            # tylko raport, niczego nie zmienia
    python tools/sprawdz_wspolrzedne.py --zapisz   # zapisuje potwierdzone współrzędne

Domyślnie sprawdza tylko miejsca ze statusem "przyblizone".
--wszystkie sprawdza też miejsca, których współrzędne pochodzą z Wikipedii.

Zasady Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
maks. 1 zapytanie na sekundę, własny identyfikator aplikacji (User-Agent).
Skrypt tego przestrzega — nie uruchamiaj go w pętli.

Co robi skrypt:
1. Dla każdego miejsca próbuje kolejnych zapytań z pola "geokod".
2. Pokazuje znalezioną nazwę z OSM i odległość od obecnego punktu.
3. Z --zapisz: zapisuje współrzędne z OSM, ustawia status "zweryfikowane"
   i dopisuje link do obiektu w OSM jako źródło. Potem przebudowuje data/places.js.

ZAWSZE przeczytaj raport: jeśli nazwa z OSM nie pasuje do miejsca, popraw pole
"geokod" w data/places.json i uruchom skrypt ponownie.
"""
import datetime
import json
import math
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

KATALOG = pathlib.Path(__file__).resolve().parent.parent
JSON = KATALOG / "data" / "places.json"
USER_AGENT = "WroclawDlaZdrowia/1.0 (szkolny projekt edukacyjny; skrypt weryfikacji wspolrzednych)"
# Prostokąt obejmujący Wrocław: wyniki spoza niego są odrzucane.
VIEWBOX = "16.80,51.21,17.18,51.04"
PROG_OSTRZEZENIA_M = 300


def odleglosc_m(lat1, lon1, lat2, lon2):
    r = 6371000
    f1, f2 = math.radians(lat1), math.radians(lat2)
    df = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(df / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def szukaj(zapytanie):
    params = urllib.parse.urlencode({
        "q": zapytanie, "format": "jsonv2", "limit": 1,
        "viewbox": VIEWBOX, "bounded": 1, "accept-language": "pl",
    })
    req = urllib.request.Request(
        "https://nominatim.openstreetmap.org/search?" + params,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=20) as odp:
        wyniki = json.load(odp)
    time.sleep(1.1)  # limit Nominatim: 1 zapytanie na sekundę
    return wyniki[0] if wyniki else None


def main():
    zapisz = "--zapisz" in sys.argv
    wszystkie = "--wszystkie" in sys.argv
    dane = json.loads(JSON.read_text(encoding="utf-8"))
    dzis = datetime.date.today().isoformat()
    zmienione = 0

    for m in dane["miejsca"]:
        w = m["wspolrzedne"]
        if w["status"] != "przyblizone" and not wszystkie:
            continue
        print(f"\n[{m['id']}] {m['nazwa']}  (obecnie: {w['lat']}, {w['lon']}, status: {w['status']})")
        wynik, uzyte = None, None
        for zapytanie in m.get("geokod", []):
            try:
                wynik = szukaj(zapytanie)
            except Exception as e:  # brak internetu, blokada itp.
                print(f"    BŁĄD zapytania '{zapytanie}': {e}")
                wynik = None
            if wynik:
                uzyte = zapytanie
                break
            print(f"    brak wyniku dla: {zapytanie}")
        if not wynik:
            print("    -> NIE ZNALEZIONO. Popraw pole 'geokod' albo ustaw współrzędne ręcznie.")
            continue
        lat, lon = round(float(wynik["lat"]), 6), round(float(wynik["lon"]), 6)
        d = odleglosc_m(w["lat"], w["lon"], lat, lon)
        osm_url = f"https://www.openstreetmap.org/{wynik['osm_type']}/{wynik['osm_id']}"
        print(f"    zapytanie: {uzyte}")
        print(f"    OSM:       {wynik.get('display_name')}")
        print(f"    punkt OSM: {lat}, {lon}  ({osm_url})")
        print(f"    różnica:   {d:.0f} m" + ("   <-- DUŻA RÓŻNICA, sprawdź, czy to na pewno to miejsce!" if d > PROG_OSTRZEZENIA_M else ""))
        if zapisz:
            m["wspolrzedne"] = {
                "lat": lat, "lon": lon, "status": "zweryfikowane",
                "zrodlo": f"OpenStreetMap (Nominatim), {wynik['osm_type']} {wynik['osm_id']}, sprawdzono {dzis}",
            }
            if not any(z["url"] == osm_url for z in m["zrodla"]):
                m["zrodla"].append({"nazwa": "OpenStreetMap: położenie obiektu", "url": osm_url})
            zmienione += 1

    if zapisz and zmienione:
        dane["meta"]["data_weryfikacji"] = dzis
        JSON.write_text(json.dumps(dane, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nZapisano {zmienione} zmian w data/places.json.")
        subprocess.run([sys.executable, str(KATALOG / "tools" / "zbuduj_dane.py")], check=True)
        print("Teraz otwórz stronę i kliknij każde miejsce — sprawdź, czy znacznik stoi we właściwym punkcie.")
    elif not zapisz:
        print("\nTo był tylko raport. Aby zapisać współrzędne, uruchom z opcją --zapisz.")


if __name__ == "__main__":
    main()
