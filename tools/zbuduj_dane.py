#!/usr/bin/env python3
"""Generuje data/places.js z data/places.json.

Strona i wydruk wczytują dane z places.js (zwykły <script>), dzięki czemu działają
również po otwarciu pliku index.html dwuklikiem, bez serwera.
Źródłem prawdy jest places.json — po każdej ręcznej zmianie uruchom:

    python tools/zbuduj_dane.py
"""
import json
import pathlib
import sys

KATALOG = pathlib.Path(__file__).resolve().parent.parent
JSON = KATALOG / "data" / "places.json"
JS = KATALOG / "data" / "places.js"

WYMAGANE = ["id", "nazwa", "kategoria", "adres", "opis", "krotko", "korzysc", "wspolrzedne", "zrodla"]


def sprawdz(dane):
    bledy = []
    kategorie = dane["meta"]["kategorie"]
    ids = set()
    for m in dane["miejsca"]:
        for pole in WYMAGANE:
            if m.get(pole) in (None, "", []):
                bledy.append(f"Miejsce {m.get('id')}: brak pola '{pole}'")
        if m.get("kategoria") not in kategorie:
            bledy.append(f"Miejsce {m.get('id')}: nieznana kategoria '{m.get('kategoria')}'")
        if m.get("id") in ids:
            bledy.append(f"Powtórzone id {m.get('id')}")
        ids.add(m.get("id"))
        w = m.get("wspolrzedne") or {}
        lat, lon = w.get("lat"), w.get("lon")
        # Granice Wrocławia z zapasem — chroni przed zamianą lat/lon lub literówką.
        if not (isinstance(lat, (int, float)) and 50.95 < lat < 51.25):
            bledy.append(f"Miejsce {m.get('id')}: podejrzana szerokość geograficzna {lat}")
        if not (isinstance(lon, (int, float)) and 16.75 < lon < 17.25):
            bledy.append(f"Miejsce {m.get('id')}: podejrzana długość geograficzna {lon}")
        if w.get("status") not in ("przyblizone", "zrodlo", "zweryfikowane"):
            bledy.append(f"Miejsce {m.get('id')}: nieznany status współrzędnych '{w.get('status')}'")
    return bledy


def main():
    dane = json.loads(JSON.read_text(encoding="utf-8"))
    bledy = sprawdz(dane)
    if bledy:
        print("Błędy w data/places.json:")
        for b in bledy:
            print("  -", b)
        sys.exit(1)
    tresc = (
        "// PLIK GENEROWANY AUTOMATYCZNIE z data/places.json — nie edytuj ręcznie.\n"
        "// Po zmianie places.json uruchom: python tools/zbuduj_dane.py\n"
        "window.WDZ_DANE = " + json.dumps(dane, ensure_ascii=False, indent=2) + ";\n"
    )
    JS.write_text(tresc, encoding="utf-8")
    przybl = sum(1 for m in dane["miejsca"] if m["wspolrzedne"]["status"] == "przyblizone")
    print(f"OK: zapisano {JS.relative_to(KATALOG)} ({len(dane['miejsca'])} miejsc, przybliżonych współrzędnych: {przybl}).")


if __name__ == "__main__":
    main()
