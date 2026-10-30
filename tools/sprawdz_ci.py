#!/usr/bin/env python3
"""Sprawdzenia uruchamiane przez GitHub Actions (wyniki trafiają na gałąź geokod-raport).

1. Nominatim: położenie nowych miejsc (data/geokod-zapytania.json).
2. Overpass: czy obiekty sportowe naprawdę są w OpenStreetMap obok znaczników.
3. WMS mapy podstawowej Wrocławia (SIP): możliwości usługi i próbny obraz.
"""
import json
import pathlib
import time
import urllib.parse
import urllib.request

K = pathlib.Path(__file__).resolve().parent.parent
OUT = K / "raport"
OUT.mkdir(exist_ok=True)
UA = ("WroclawDlaZdrowia/1.0 (szkolny projekt; "
      "https://github.com/maciejtyrakowski/Projekt-edukacja-zdrowotna-mapa)")


def get(url, data=None, timeout=90):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type")


def nominatim():
    zap = json.loads((K / "data" / "geokod-zapytania.json").read_text(encoding="utf-8"))
    wynik = []
    for z in zap:
        wpis = {"nazwa": z["nazwa"], "zapytania": []}
        for q in z["geokod"]:
            p = urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 3,
                                        "viewbox": "16.80,51.21,17.18,51.04", "bounded": 1,
                                        "accept-language": "pl"})
            try:
                w = json.loads(get("https://nominatim.openstreetmap.org/search?" + p)[0])
                w = [{k: x.get(k) for k in ("display_name", "lat", "lon", "category", "type",
                                            "osm_type", "osm_id")} for x in w]
            except Exception as e:
                w = {"blad": str(e)}
            wpis["zapytania"].append({"q": q, "wyniki": w})
            time.sleep(1.2)
        wynik.append(wpis)
    (OUT / "nominatim.json").write_text(json.dumps(wynik, ensure_ascii=False, indent=2), encoding="utf-8")


OVERPASS = """
[out:json][timeout:90];
(
  nwr["sport"="skateboard"](51.04,16.80,51.21,17.18);
  nwr(around:600,51.1412,16.9438)["leisure"~"fitness_station|fitness_centre"];
  nwr(around:900,51.1170,16.9420)["leisure"~"track|ice_rink|sports_centre|sports_hall"];
  nwr(around:900,51.1170,16.9420)["sport"~"roller_skating|inline_skates|skating|ice_skating"];
  nwr(around:450,51.1150,17.0400)["leisure"~"fitness_station|playground"];
)->.a;
nwr["name"~"Polana Karłowicka|Wyspa Słodowa|Wyspa Bielarska"](51.04,16.80,51.21,17.18)->.n;
nwr(around.n:350)["leisure"~"pitch|fitness_station"]->.b;
(.a; .n; .b;);
out center tags;
"""


def overpass():
    try:
        raw, _ = get("https://overpass-api.de/api/interpreter",
                     data=urllib.parse.urlencode({"data": OVERPASS}).encode())
        d = json.loads(raw)
        el = [{"type": e["type"], "id": e["id"],
               "lat": e.get("lat") or e.get("center", {}).get("lat"),
               "lon": e.get("lon") or e.get("center", {}).get("lon"),
               "tags": e.get("tags", {})} for e in d.get("elements", [])]
    except Exception as e:
        el = {"blad": str(e)}
    (OUT / "overpass.json").write_text(json.dumps(el, ensure_ascii=False, indent=2), encoding="utf-8")


WMS = "https://gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpodst/MapServer/WmsServer"


def wms():
    try:
        raw, ct = get(WMS + "?service=WMS&request=GetCapabilities&version=1.3.0")
        (OUT / "wms-capabilities.xml").write_bytes(raw)
    except Exception as e:
        (OUT / "wms-capabilities.xml").write_text("BLAD: " + str(e), encoding="utf-8")
        return
    # Próbny obraz centrum miasta w EPSG:3857 (wszystkie warstwy główne: "0").
    import re
    nazwy = re.findall(rb"<Layer[^>]*>\s*<Name>([^<]+)</Name>", raw)
    (OUT / "wms-warstwy.txt").write_bytes(b"\n".join(nazwy))
    warstwy = ",".join(n.decode() for n in nazwy[:1]) or "0"
    bbox = "1883000,6640000,1903000,6655000"
    for crs in ("EPSG:3857", "EPSG:102100"):
        q = urllib.parse.urlencode({"service": "WMS", "request": "GetMap", "version": "1.3.0",
                                    "layers": warstwy, "styles": "", "crs": crs, "bbox": bbox,
                                    "width": 1000, "height": 750, "format": "image/png",
                                    "transparent": "false"})
        try:
            raw, ct = get(WMS + "?" + q)
            ext = "png" if "png" in (ct or "") else "txt"
            (OUT / f"wms-test-{crs.replace(':', '')}.{ext}").write_bytes(raw)
        except Exception as e:
            (OUT / f"wms-test-{crs.replace(':', '')}.txt").write_text(str(e), encoding="utf-8")


if __name__ == "__main__":
    nominatim()
    overpass()
    wms()
