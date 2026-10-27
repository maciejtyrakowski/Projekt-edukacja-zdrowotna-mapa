# Wrocław dla zdrowia — mapa miejsc prozdrowotnych

**Strona:** https://maciejtyrakowski.github.io/Projekt-edukacja-zdrowotna-mapa/
**Plakat do druku (2 × A4 / A3):** https://maciejtyrakowski.github.io/Projekt-edukacja-zdrowotna-mapa/print/druk.html

Szkolny projekt z edukacji zdrowotnej. Składa się z dwóch części:

1. **Strona internetowa** (`index.html`) z interaktywną mapą na telefon i komputer: filtry kategorii, przycisk „Pokaż wszystkie miejsca”, okienka z opisem i korzyścią zdrowotną, źródła i data weryfikacji.
2. **Wersja do druku** (`print/druk.html`): mapa na **2 kartkach A4 poziomo** do sklejenia (albo na 1 kartce A3), z legendą, numerowanymi znacznikami, listą miejsc, kodem QR i źródłami.

Wszystko działa za darmo: bez kluczy API, bez backendu i bez płatnych usług.

---

## Struktura plików

```
index.html                 strona z interaktywną mapą
style.css                  wygląd strony
script.js                  znaczniki, filtry, lista, okienka
data/places.json           DANE MIEJSC: tu wprowadzasz zmiany
data/places.js             generowany automatycznie z places.json (nie edytuj ręcznie)
lib/leaflet/               biblioteka Leaflet 1.9.4 (licencja BSD-2)
lib/qrcode/                generator kodów QR qrcode-generator 1.4.4 (licencja MIT)
lib/wspolne.js             wspólne ikony i ustawienia mapy
print/druk.html            arkusze do druku (2 × A4 lub A3) + generator QR
tools/zbuduj_dane.py       sprawdza places.json i tworzy places.js
tools/sprawdz_wspolrzedne.py  weryfikuje współrzędne w OpenStreetMap
docs/instrukcja-wydruku.pdf   instrukcja wydruku i sklejania
```

Biblioteki są zapisane w projekcie, a nie pobierane z CDN. Uwaga: po otwarciu pliku dwuklikiem (z dysku) znaczniki, filtry i lista działają, ale **podkład mapy się nie wczyta**. Serwer OpenStreetMap wymaga nagłówka Referer, a przeglądarka nie wysyła go ze stron otwartych z dysku.

---

## KROK 0 — co musisz zrobić przed oddaniem (ważne)

| # | Zadanie | Dlaczego |
|---|---------|----------|
| 1 | Uzupełnij pole `"autor"` w `data/places.json` i uruchom `python tools/zbuduj_dane.py`. | Teraz jest tam `UZUPEŁNIJ: imię i nazwisko, klasa`. |
| 2 | Kliknij na mapie każde miejsce i sprawdź, czy znacznik stoi we właściwym punkcie. | Współrzędne wszystkich 19 miejsc pochodzą z OpenStreetMap (link przy każdym miejscu), ale warto obejrzeć je samemu. |
| 3 | Opublikuj stronę na GitHub Pages. | Kod QR musi prowadzić do publicznego adresu. |
| 4 | Wygeneruj QR, wydrukuj, zeskanuj telefonem. | Dopiero wtedy wiadomo, że QR działa. |

Jeśli dodasz nowe miejsce bez sprawdzonych współrzędnych (status `przyblizone`), strona i wydruk same to oznaczą.

---

## KROK 1 — obejrzyj stronę na swoim komputerze

Pliku otwartego dwuklikiem nie da się w pełni sprawdzić, bo podkład mapy się nie wczyta (patrz wyżej). Uruchom lokalny serwer w folderze projektu:

```bash
python -m http.server 8000
```

i wejdź na <http://localhost:8000>. Nie sprawdziłem, czy serwer OSM akceptuje zapytania z `localhost`. Jeśli mapa dalej jest szara, opublikuj stronę (KROK 3) i sprawdzaj ją pod publicznym adresem. Tam podkład działa na pewno.

---

## KROK 2 — weryfikacja współrzędnych (ok. 5 minut)

### Sposób A: automatyczny (zalecany)

Potrzebujesz Pythona 3 (bez instalowania dodatkowych pakietów). W folderze projektu uruchom:

```bash
python tools/sprawdz_wspolrzedne.py            # raport, niczego nie zmienia
```

Dla każdego miejsca skrypt pokaże nazwę znalezioną w OpenStreetMap i różnicę w metrach. **Przeczytaj raport.** Jeśli nazwa nie pasuje (np. znalazł inny obiekt), popraw listę zapytań w polu `"geokod"` tego miejsca w `places.json`. Gdy wszystko się zgadza, uruchom:

```bash
python tools/sprawdz_wspolrzedne.py --zapisz   # zapisuje współrzędne i przebudowuje places.js
```

Skrypt korzysta z publicznej usługi Nominatim i przestrzega jej zasad (najwyżej 1 zapytanie na sekundę). Nie uruchamiaj go w kółko.

### Sposób B: ręczny

1. Otwórz `index.html?edycja=1` (dopisz `?edycja=1` na końcu adresu).
2. Znajdź na mapie właściwe miejsce (np. wejście do parku albo budynek pływalni) i kliknij je. Pojawią się współrzędne.
3. Wpisz je w `places.json` w polach `lat` i `lon` tego miejsca. Ustaw `"status": "zweryfikowane"`, a w `"zrodlo"` napisz, skąd je wziąłeś (np. `"OpenStreetMap, sprawdzone ręcznie 2026-10-28"`).
4. Uruchom `python tools/zbuduj_dane.py`.

Na koniec kliknij każde miejsce na mapie i sprawdź, czy znacznik stoi tam, gdzie trzeba. Adresy możesz porównać z oficjalną mapą miasta: <https://gis.um.wroc.pl/mapy/mapa_podst/> (wyszukiwarka „Ulice, miejsca, adresy”).

---

## KROK 3 — publikacja za darmo na GitHub Pages

Wymaga konta na GitHubie (darmowe). Tę czynność musisz wykonać sam, bo potrzebny jest dostęp do Twojego konta.

1. Zaloguj się na <https://github.com> i kliknij **New repository**.
2. Nazwa: `wroclaw-dla-zdrowia`. Ustaw **Public** (GitHub Pages za darmo działa dla publicznych repozytoriów) i kliknij **Create repository**.
3. Kliknij **uploading an existing file** i przeciągnij **zawartość** folderu projektu (pliki i podfoldery, a nie sam folder). Kliknij **Commit changes**.
   - Sprawdź, czy `index.html` leży w głównym katalogu repozytorium, a nie w podfolderze.
4. Wejdź w **Settings → Pages**. W sekcji *Build and deployment* wybierz **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)** i kliknij **Save**.
5. Po 1–3 minutach na górze tej strony pojawi się adres, np.
   `https://TWOJ-LOGIN.github.io/wroclaw-dla-zdrowia/`
6. Otwórz ten adres **na telefonie** (na komórkowym internecie, nie w szkolnej sieci Wi-Fi) i sprawdź, czy mapa, filtry i okienka działają.

Każda zmiana pliku w repozytorium aktualizuje stronę po minucie lub dwóch.

---

## KROK 4 — kod QR i wydruk

1. Otwórz `https://TWOJ-LOGIN.github.io/wroclaw-dla-zdrowia/print/druk.html`. Gdy strona do druku jest otwarta z publicznego adresu, adres do QR wpisze się sam. Możesz też otworzyć `print/druk.html` z dysku i wkleić adres ręcznie.
   - Generator przyjmie tylko adres `https://…` publicznej strony. Adresy `localhost`, `192.168…` i pliki z dysku są odrzucane, bo telefon by ich nie otworzył.
2. Wpisz autora i wybierz format: **2 × A4** albo **A3**.
3. Poczekaj na komunikat **„Mapa gotowa — możesz drukować”** i kliknij **Drukuj**.
4. Ustawienia drukowania:
   - **Skala 100%** („Rzeczywisty rozmiar”), nie „Dopasuj do strony”,
   - **Marginesy: brak**,
   - zaznaczone **Grafika tła** (inaczej znikną kolory),
   - najlepiej Chrome lub Edge.
5. **Przed wydrukiem na czysto zeskanuj kod QR z ekranu telefonem, a po wydruku jeszcze raz z papieru.** Kod musi otworzyć Twoją stronę.

Możesz też wybrać „Zapisz jako PDF” i wydrukować plik PDF w punkcie ksero.

### Sklejanie 2 × A4

1. Kartkę **1 (lewą)** przytnij wzdłuż przerywanej linii przy prawej krawędzi mapy.
2. Na kartce **2 (prawej)** posmaruj klejem pasek „ZAKŁADKA” (ok. 12 mm).
3. Połóż lewą kartkę na zakładce tak, aby trójkąty pod mapą znalazły się dokładnie jeden nad drugim, a ulice się połączyły.

Szczegóły z rysunkiem: `docs/instrukcja-wydruku.pdf`.

---

## Źródła i licencje (sprawdzone 27.10.2026)

- **Podkład mapy:** © OpenStreetMap contributors, licencja ODbL — <https://www.openstreetmap.org/copyright>. Kafelki pochodzą z serwera `tile.openstreetmap.org`. Jego [zasady korzystania](https://operations.osmfoundation.org/policies/tiles/) pozwalają na zwykłe przeglądanie mapy na stronie, jeśli atrybucja jest widoczna (jest w rogu mapy) i nie pobiera się kafelków hurtowo (projekt tego nie robi). Wydruk powstaje z kafelków wczytanych podczas zwykłego oglądania strony, a atrybucja wraz z adresem `openstreetmap.org/copyright` jest wydrukowana na mapie.
- **Mapa miasta (SIP Wrocławia):** według strony „Dane, usługi i narzędzia” (<https://gis.um.wroc.pl/zasoby/>) mapa podkładowa udostępniona jako usługa WMS ma warunki „bez ograniczeń”. Projekt jej nie osadza, bo do mapy na telefonie lepiej nadają się kafelki OSM. Serwis SIP służy tu do sprawdzania adresów.
- **Dane o miejscach:** <https://www.wroclaw.pl> (listy basenów i kąpielisk, strony parków i lasów, artykuły o kąpieliskach, siłowni plenerowej, torze wrotkarskim i bulwarach) oraz Wikipedia. Współrzędne: OpenStreetMap (Nominatim) — skrypt `tools/geokoduj_ci.py` uruchamiany przez GitHub Actions; wyniki sprawdzone ręcznie 27.10.2026. Źródła każdego miejsca są w `places.json` i w okienku na mapie.
- **Biblioteki:** Leaflet 1.9.4 (aktualna stabilna wersja według leafletjs.com; wersja 2.0 jest jeszcze testowa), qrcode-generator 1.4.4.
- Projekt przygotowano z pomocą AI (Claude). Zobacz też „KROK 0”.

## Czego projekt celowo NIE twierdzi

- Nie podaje godzin otwarcia i nie oznacza miejsc jako bezpłatnych, dostępnych dla osób z niepełnosprawnościami ani czynnych cały rok, jeśli nie potwierdza tego źródło. Wyjątek: siłownia przy Tarczyński Arena, którą wroclaw.pl opisuje jako „ogólnodostępną i bezpłatną”.
- Ceny kąpielisk dotyczą sezonu 2026 i są tak opisane.
- Na mapie są tylko miejsca, których istnienie, adres i położenie potwierdzają podane źródła. Stadiony bez potwierdzonego dostępu dla mieszkańców i pumptrack bez potwierdzonego położenia zostały usunięte.
