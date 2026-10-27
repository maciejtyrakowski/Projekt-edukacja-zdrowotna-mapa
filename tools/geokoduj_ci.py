#!/usr/bin/env python3
"""Geokodowanie wszystkich miejsc (uruchamiane przez GitHub Actions).

Dla każdego miejsca odpytuje Nominatim (OpenStreetMap) o kolejne zapytania z pola
"geokod" i zapisuje do data/geokod-raport.json do 3 wyników na zapytanie.
NIE zmienia places.json — wyniki trzeba przejrzeć i wpisać świadomie.

Zasady Nominatim: maks. 1 zapytanie/s, własny User-Agent, brak masowego użycia.
https://operations.osmfoundation.org/policies/nominatim/
"""
import json
import pathlib
import time
import urllib.parse
import urllib.request

KATALOG = pathlib.Path(__file__).resolve().parent.parent
USER_AGENT = ("WroclawDlaZdrowia/1.0 (szkolny projekt; "
              "https://github.com/maciejtyrakowski/Projekt-edukacja-zdrowotna-mapa)")
VIEWBOX = "16.80,51.21,17.18,51.04"   # Wrocław z zapasem


def szukaj(q):
    params = urllib.parse.urlencode({
        "q": q, "format": "jsonv2", "limit": 3, "viewbox": VIEWBOX, "bounded": 1,
        "accept-language": "pl",
    })
    req = urllib.request.Request("https://nominatim.openstreetmap.org/search?" + params,
                                 headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as odp:
            wynik = json.load(odp)
    except Exception as e:  # zapisujemy błąd zamiast przerywać
        wynik = {"blad": str(e)}
    time.sleep(1.2)
    return wynik


def main():
    dane = json.loads((KATALOG / "data" / "places.json").read_text(encoding="utf-8"))
    raport = []
    for m in dane["miejsca"]:
        wpis = {"id": m["id"], "nazwa": m["nazwa"], "zapytania": []}
        for q in m.get("geokod", []):
            wyniki = szukaj(q)
            if isinstance(wyniki, list):
                wyniki = [{k: w.get(k) for k in ("display_name", "lat", "lon", "category", "type",
                                                 "osm_type", "osm_id", "boundingbox")} for w in wyniki]
            wpis["zapytania"].append({"q": q, "wyniki": wyniki})
            print(m["id"], q, "->", len(wyniki) if isinstance(wyniki, list) else wyniki)
        raport.append(wpis)
    (KATALOG / "data" / "geokod-raport.json").write_text(
        json.dumps(raport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
