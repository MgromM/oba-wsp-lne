#!/usr/bin/env python3
"""Pobiera restauracje i kawiarnie z Warszawy z OpenStreetMap (Overpass API),
wybiera ~900 restauracji i ~200 kawiarni pod randkę studencką / kreatywną
i zapisuje je do places.json (obok app.html).

Uruchom:  python3 scripts/fetch_places.py
Wymaga tylko Pythona 3 i internetu. OpenStreetMap nie ma ocen z Google —
wybór opiera się na rodzaju kuchni i kompletności danych.
"""
import json, sys, time, urllib.parse, urllib.request

ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]
QUERY = '''[out:json][timeout:180];
area["name"="Warszawa"]["boundary"="administrative"]->.a;
(nwr["amenity"~"^(restaurant|cafe)$"]["name"](area.a););
out tags center;'''

LIMITS = {'restaurant': 900, 'cafe': 200}

# sieciówki i fast foody — pomijamy
CHAINS = ['mcdonald', 'kfc', 'burger king', 'subway', 'starbucks', 'costa coffee', 'pizza hut',
          "domino", 'telepizza', 'sbarro', 'popeyes', 'tesco', 'carrefour', 'biedronka', 'żabka',
          'zabka', 'orlen', 'bp ', 'shell', 'stacja', 'bar mleczny', 'dworzec']

# kuchnie "studenckie" (tanio, wspólnie, luz) i "kreatywne" (nietypowo, na zdjęcie)
STUDENT = {'pizza', 'vietnamese', 'ramen', 'noodle', 'korean', 'georgian', 'mexican', 'indian',
           'burger', 'thai', 'street_food', 'asian', 'chinese', 'falafel', 'sandwich', 'crepe'}
CREATIVE = {'fusion', 'tapas', 'sushi', 'japanese', 'mediterranean', 'vegan', 'vegetarian',
            'wine', 'french', 'spanish', 'peruvian', 'greek', 'lebanese', 'turkish', 'italian',
            'regional', 'international', 'brunch', 'seafood', 'steak_house', 'breakfast', 'coffee_shop'}


def fetch():
    body = urllib.parse.urlencode({'data': QUERY}).encode()
    last = None
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=body, headers={'User-Agent': 'oba-wsp-lne/1.0'})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except Exception as e:  # próbujemy kolejny serwer
            last = e
            print(f'{url}: {e}', file=sys.stderr)
            time.sleep(2)
    sys.exit(f'Nie udało się pobrać danych: {last}')


def loc_of(t):
    street, num = t.get('addr:street'), t.get('addr:housenumber')
    sub = t.get('addr:suburb') or t.get('addr:city_district') or ''
    parts = []
    if street:
        parts.append(f'{street} {num}'.strip())
    if sub:
        parts.append(sub)
    return ', '.join(parts), bool(street)


def score(t, has_street):
    cuisines = set((t.get('cuisine') or '').replace(' ', '').split(';')) - {''}
    s = 0
    if cuisines & STUDENT:
        s += 3
    if cuisines & CREATIVE:
        s += 3
    if cuisines:
        s += 1
    if t.get('outdoor_seating') == 'yes':
        s += 1
    if t.get('website') or t.get('contact:website'):
        s += 1
    if t.get('opening_hours'):
        s += 1
    if t.get('diet:vegan') in ('yes', 'only') or t.get('diet:vegetarian') in ('yes', 'only'):
        s += 1
    if has_street:
        s += 2
    return s


def build(data):
    seen, pool = set(), {'restaurant': [], 'cafe': []}
    for el in data.get('elements', []):
        t = el.get('tags', {})
        cat, name = t.get('amenity'), (t.get('name') or '').strip()
        if cat not in pool or not name:
            continue
        low = name.lower()
        if any(c in low for c in CHAINS):
            continue
        loc, has_street = loc_of(t)
        key = (low, loc.lower())
        if key in seen:
            continue
        seen.add(key)
        pool[cat].append((score(t, has_street), name, loc or 'Warszawa', cat))
    out = []
    for cat, items in pool.items():
        items.sort(key=lambda x: (-x[0], x[1].lower()))
        out += [[c, n, l] for _, n, l, c in items[:LIMITS[cat]]]
    return out, {c: len(v) for c, v in pool.items()}


if __name__ == '__main__':
    places, found = build(fetch())
    with open('places.json', 'w', encoding='utf-8') as f:
        json.dump(places, f, ensure_ascii=False, separators=(',', ':'))
    print('Znaleziono w OSM:', found)
    print('Zapisano do places.json:', len(places), 'miejsc')
