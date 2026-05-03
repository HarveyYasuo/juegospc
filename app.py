"""
Roblox Fast Join v3.0 - Ping real medido desde tu maquina
pip install customtkinter requests browser-cookie3 Pillow
"""

import customtkinter as ctk
import threading
import webbrowser
import urllib.parse
import requests
import browser_cookie3
import os, json, sys, time, uuid, hashlib, platform, datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Rutas ─────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(sys.argv[0]))
COOKIE_FILE   = os.path.join(BASE_DIR, ".roblox_session.json")
HISTORY_FILE  = os.path.join(BASE_DIR, ".roblox_history.json")
LICENSE_FILE  = os.path.join(BASE_DIR, ".roblox_license.json")
MAX_HISTORY   = 30


# ══════════════════════════════════════════════════════════════════════════════
#  SISTEMA DE LICENCIAS
# ══════════════════════════════════════════════════════════════════════════════

LICENSE_SERVER = "http://localhost:5000"   # ← cambia a tu servidor

def get_hwid() -> str:
    """Identificador único del hardware, reproducible en el mismo equipo."""
    raw = f"{uuid.getnode()}-{platform.node()}-{platform.machine()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]

def cargar_licencia_local() -> dict | None:
    try:
        with open(LICENSE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def guardar_licencia_local(key: str, info: dict):
    with open(LICENSE_FILE, "w", encoding="utf-8") as f:
        json.dump({"key": key, **info}, f)

def borrar_licencia_local():
    if os.path.exists(LICENSE_FILE):
        os.remove(LICENSE_FILE)

def validar_licencia_servidor(key: str) -> dict:
    """
    Llama al servidor de licencias.
    Devuelve dict con 'ok', 'type', 'expires_at' o lanza Exception.
    """
    hwid = get_hwid()
    r = requests.post(
        f"{LICENSE_SERVER}/v1/validate",
        json={"key": key, "hwid": hwid, "version": "3.0"},
        timeout=10
    )
    return r.json()

def segundos_restantes(expires_at_iso: str) -> int:
    try:
        exp = datetime.datetime.fromisoformat(expires_at_iso)
        delta = exp - datetime.datetime.utcnow()
        return max(0, int(delta.total_seconds()))
    except Exception:
        return 0

def formatear_tiempo(segundos: int) -> str:
    h = segundos // 3600
    m = (segundos % 3600) // 60
    s = segundos % 60
    if h > 0:
        return f"{h}h {m:02d}m {s:02d}s"
    return f"{m:02d}m {s:02d}s"


# ══════════════════════════════════════════════════════════════════════════════
#  GEOLOCALIZACIÓN Y DETECCIÓN DE DATACENTER
# ══════════════════════════════════════════════════════════════════════════════

import math

def _haversine(lat1, lon1, lat2, lon2):
    """Distancia en km entre dos coordenadas."""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def obtener_ubicacion_ip():
    """
    Intenta obtener latitud/longitud via multiples servicios de IP geolocation.
    Prueba ipapi.co, ip-api.com e ipinfo.io en orden.
    Devuelve (lat, lon, ciudad_str) o None si todos fallan.
    """
    def parse_ipinfo(d):
        loc = d.get("loc", "")
        if "," not in loc:
            raise ValueError("sin loc")
        la, lo = loc.split(",")
        return float(la), float(lo), f"{d.get('city','')}, {d.get('country','')}"

    servicios = [
        ("https://ipapi.co/json/",
         lambda d: (float(d["latitude"]), float(d["longitude"]),
                    f"{d.get('city','')}, {d.get('country_code','')}")),
        ("https://ip-api.com/json/?fields=lat,lon,city,countryCode",
         lambda d: (float(d["lat"]), float(d["lon"]),
                    f"{d.get('city','')}, {d.get('countryCode','')}")),
        ("https://ipinfo.io/json", parse_ipinfo),
    ]
    for url, parsear in servicios:
        try:
            r = requests.get(url, timeout=5)
            d = r.json()
            lat, lon, loc = parsear(d)
            if lat and lon:
                return lat, lon, loc
        except Exception:
            continue
    return None
def datacenter_mas_cercano(lat, lon):
    """
    Dado (lat, lon) del usuario, devuelve el nombre del datacenter de Roblox
    geográficamente más cercano (en km).
    """
    mejor, dist_min = ROBLOX_DATACENTERS[0][0], float("inf")
    for nombre, dc_lat, dc_lon, _ in ROBLOX_DATACENTERS:
        d = _haversine(lat, lon, dc_lat, dc_lon)
        if d < dist_min:
            dist_min = d
            mejor    = nombre
    return mejor


def _ping_ms_a_host(host, timeout=3.0):
    """Mide latencia HTTP simple (TTFB) a un host."""
    try:
        t0 = time.perf_counter()
        requests.get(host, timeout=timeout, allow_redirects=False)
        return int((time.perf_counter() - t0) * 1000)
    except Exception:
        return 9999


def inferir_region_servidor(srv, place_id):
    """
    Etiqueta la región del servidor usando el ping real medido.
    Lógica: el datacenter de Roblox más cercano AL USUARIO (menor distancia km)
    que tenga un ping estimado compatible con el ping real medido.

    Se usa una tabla de rangos de ping esperados desde Colombia/Caribe:
      Miami:      80–180 ms
      São Paulo: 120–250 ms
      Dallas:    150–280 ms
      Ashburn:   160–300 ms
      Los Ángeles: 190–350 ms
      Europa:    200–400 ms
      Asia/Oceanía: 300–600 ms

    Si el ping cae en el rango de Miami o São Paulo, se etiqueta así.
    De lo contrario se asigna el DC cuyo rango mejor encaja.
    """
    # Hint directo de la API si existe
    region_hint = (srv.get("gameServerRegion") or
                   srv.get("region") or
                   srv.get("venueName") or "")
    if region_hint:
        return str(region_hint)

    real_ping = srv.get("real_ping", PING_MALO)
    if real_ping >= PING_MALO:
        return "Desconocido"

    # Rangos de ping esperados desde Colombia (Quibdó / Bogotá)
    # Formato: (nombre, ping_min, ping_max)
    RANGOS = [
        ("Miami, FL",        60,  190),
        ("São Paulo, BR",   110,  260),
        ("Dallas, TX",      140,  290),
        ("Ashburn, VA",     150,  310),
        ("Los Angeles, CA", 180,  360),
        ("Amsterdam, NL",   190,  420),
        ("London, UK",      200,  430),
        ("Singapore, SG",   280,  550),
        ("Tokyo, JP",       310,  580),
        ("Sydney, AU",      330,  600),
    ]

    # Buscar el primer rango que contenga el ping real
    for nombre, pmin, pmax in RANGOS:
        if pmin <= real_ping <= pmax:
            return nombre

    # Fallback: asignar el rango cuyo centro sea más cercano al ping real
    mejor, menor_diff = "Desconocido", float("inf")
    for nombre, pmin, pmax in RANGOS:
        centro = (pmin + pmax) / 2
        diff   = abs(real_ping - centro)
        if diff < menor_diff:
            menor_diff = diff
            mejor      = nombre
    return mejor

# ── Config ────────────────────────────────────────────────────────────────────
MAX_FETCH        = 200   # servidores max a pedir a la API
LIMITE_POR_TAB   = 50    # max por pestana
UMBRAL_LLENO     = 0.75  # >= 75% ocupado → "Casi lleno"
UMBRAL_VACIO_MAX = 6     # <= 6 jugadores  → "Casi vacio"
PING_WORKERS     = 40    # hilos paralelos para medir ping
PING_INTENTOS    = 3     # mediciones por servidor (promedio)
PING_TIMEOUT     = 4.0   # segundos max por intento
PING_MALO        = 9999  # valor si falla

# ── Datacenters de Roblox conocidos: (nombre_display, lat, lon, ping_endpoint)
# Se usaran para identificar la region de cada servidor por latencia comparativa.
ROBLOX_DATACENTERS = [
    ("Miami, FL",       25.7617,  -80.1918, "https://games.roblox.com"),   # CFO / UDP relay Miami
    ("São Paulo, BR",  -23.5505,  -46.6333, "https://games.roblox.com"),
    ("Dallas, TX",      32.7767,  -96.7970, "https://games.roblox.com"),
    ("Ashburn, VA",     39.0438,  -77.4874, "https://games.roblox.com"),
    ("Los Angeles, CA", 34.0522, -118.2437, "https://games.roblox.com"),
    ("Amsterdam, NL",   52.3676,    4.9041, "https://games.roblox.com"),
    ("London, UK",      51.5074,   -0.1278, "https://games.roblox.com"),
    ("Singapore, SG",    1.3521,  103.8198, "https://games.roblox.com"),
    ("Tokyo, JP",       35.6762,  139.6503, "https://games.roblox.com"),
    ("Sydney, AU",     -33.8688,  151.2093, "https://games.roblox.com"),
]

# ── Coordenadas del usuario (se actualizan al inicio via IP geolocation)
_USER_LAT  = 5.6919   # fallback: Quibdó, Colombia
_USER_LON  = -76.6583
_USER_LOC  = "Quibdó, CO (fallback)"

# ── Endpoint que Roblox usa para verificar si un servidor esta vivo
PING_URL_TPL = "https://www.roblox.com/games/{place_id}"

# ── Colores ───────────────────────────────────────────────────────────────────
BG         = "#0a0a0f"
BG_CARD    = "#12121a"
BG_INPUT   = "#1a1a26"
BG_ROW     = "#16161f"
BG_ROW_ALT = "#1c1c28"
BG_ROW_SEL = "#1e2a4a"
ACCENT     = "#00a2ff"
ACCENT_HVR = "#33b5ff"
ACCENT2    = "#0066cc"
GREEN      = "#00e676"
YELLOW     = "#ffd600"
ORANGE     = "#ff9100"
RED        = "#ff1744"
TEXT       = "#e8eaf6"
TEXT_DIM   = "#6b6f8a"
BORDER     = "#2a2a3d"

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


# ══════════════════════════════════════════════════════════════════════════════
#  LOGICA DE SESION
# ══════════════════════════════════════════════════════════════════════════════

def cargar_cookie_guardada():
    try:
        with open(COOKIE_FILE) as f:
            return json.load(f).get("roblosecurity")
    except Exception:
        return None

def guardar_cookie(c):
    with open(COOKIE_FILE, "w") as f:
        json.dump({"roblosecurity": c}, f)

def borrar_cookie():
    if os.path.exists(COOKIE_FILE):
        os.remove(COOKIE_FILE)


def cargar_historial():
    try:
        with open(HISTORY_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def guardar_historial(entradas):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(entradas[:MAX_HISTORY], f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def agregar_al_historial(place_id, nombre_juego):
    """Agrega o actualiza una entrada. Si ya existe ese place_id, lo mueve al tope."""
    entradas = cargar_historial()
    entradas = [e for e in entradas if str(e.get("place_id")) != str(place_id)]
    from datetime import datetime
    entradas.insert(0, {
        "place_id":   str(place_id),
        "nombre":     nombre_juego,
        "fecha":      datetime.now().strftime("%d/%m/%Y %H:%M"),
    })
    guardar_historial(entradas)

def obtener_nombre_juego(place_id, session):
    """Consulta la API de Roblox para obtener el nombre del juego."""
    try:
        r = session.get(
            f"https://games.roblox.com/v1/games/multiget-place-details?placeIds={place_id}",
            timeout=6)
        data = r.json()
        if isinstance(data, list) and data:
            return data[0].get("name", f"Place {place_id}")
        return f"Place {place_id}"
    except Exception:
        return f"Place {place_id}"

def leer_cookie_navegadores():
    for nombre, fn in [("Chrome", browser_cookie3.chrome),
                       ("Edge",   browser_cookie3.edge),
                       ("Firefox",browser_cookie3.firefox)]:
        try:
            for c in fn(domain_name=".roblox.com"):
                if c.name == ".ROBLOSECURITY":
                    return c.value, nombre
        except Exception:
            pass
    return None, None

def crear_session(cookie):
    s = requests.Session()
    s.cookies.set(".ROBLOSECURITY", cookie, domain=".roblox.com")
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer":    "https://www.roblox.com/",
        "Origin":     "https://www.roblox.com",
    })
    return s

def verificar_sesion(session):
    return session.get("https://users.roblox.com/v1/users/authenticated",
                       timeout=8).json()

def obtener_auth_ticket(session):
    hdrs = {
        "Content-Type":                 "application/json",
        "Rbx-Session-Provider":         "Web",
        "Rbxauthenticationnegotiation": "1",
    }
    r = session.post("https://auth.roblox.com/v1/authentication-ticket",
                     json={}, headers=hdrs)
    if r.status_code == 403:
        csrf = r.headers.get("x-csrf-token")
        if csrf:
            session.headers["x-csrf-token"] = csrf
            r = session.post("https://auth.roblox.com/v1/authentication-ticket",
                             json={}, headers=hdrs)
    if r.status_code != 200:
        raise RuntimeError(f"Auth-ticket fallo (HTTP {r.status_code})")
    ticket = r.headers.get("rbx-authentication-ticket")
    if not ticket:
        raise RuntimeError("No se recibio el auth-ticket")
    return ticket


# ══════════════════════════════════════════════════════════════════════════════
#  LOGICA DE SERVIDORES + PING REAL
# ══════════════════════════════════════════════════════════════════════════════

def obtener_todos_servidores(place_id, session):
    """
    Descarga hasta MAX_FETCH servidores en total.
    Hace DOS pasadas:
      1) Con excludeFullGames=false  → captura TODO, incluyendo casi llenos
      2) Si la primera falla, fallback con excludeFullGames=true
    Devuelve lista con TODOS los servidores (llenos y no llenos).
    """
    def _fetch_paginas(exclude_full):
        resultado, cursor, consultados = [], "", 0
        while consultados < MAX_FETCH:
            param_excl = "true" if exclude_full else "false"
            url = (
                f"https://games.roblox.com/v1/games/{place_id}/servers/Public"
                f"?sortOrder=Asc&limit=100&excludeFullGames={param_excl}"
                + (f"&cursor={cursor}" if cursor else "")
            )
            try:
                data = session.get(url, timeout=10).json()
            except Exception:
                break
            pagina = data.get("data", [])
            if not pagina:
                break
            resultado.extend(pagina)
            consultados += len(pagina)
            cursor = data.get("nextPageCursor") or ""
            if not cursor:
                break
        return resultado

    # Primero intentamos SIN excluir llenos (trae todo)
    todos = _fetch_paginas(exclude_full=False)
    if not todos:
        # Fallback por si la API no lo soporta
        todos = _fetch_paginas(exclude_full=True)
    return todos


def medir_ping_servidor(srv, place_id):
    """
    Mide el ping REAL al servidor de juego de Roblox.

    Estrategia:
    - Roblox no expone los IPs de los game servers directamente, pero cada
      servidor tiene una region implicita. Medimos latencia HTTP al endpoint
      de join del servidor especifico (PlaceLauncher) que redirige al datacenter
      real donde corre esa instancia.
    - Hacemos PING_INTENTOS mediciones y devolvemos la mediana para evitar
      picos espurios de red.
    """
    job_id = srv["id"]
    # URL que el launcher usa — redirige al datacenter del servidor especifico
    url = (
        f"https://assetgame.roblox.com/game/PlaceLauncher.ashx"
        f"?request=RequestGameJob&placeId={place_id}&gameId={job_id}"
        f"&isPartyLeader=false&gender=&isTeleport=false"
    )
    mediciones = []
    try:
        # Sesion sin cookie para que no haga redirect de auth — solo queremos
        # la latencia de red al datacenter
        s = requests.Session()
        s.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        s.max_redirects = 0  # no seguir redireccion, solo medir TTFB

        for _ in range(PING_INTENTOS):
            t0 = time.perf_counter()
            try:
                s.get(url, timeout=PING_TIMEOUT, allow_redirects=False)
            except requests.exceptions.TooManyRedirects:
                pass
            except requests.exceptions.ConnectionError:
                pass
            except requests.exceptions.Timeout:
                mediciones.append(PING_MALO)
                continue
            t1 = time.perf_counter()
            ms = int((t1 - t0) * 1000)
            mediciones.append(ms)

    except Exception:
        pass

    if not mediciones:
        return PING_MALO

    mediciones.sort()
    # Mediana para ignorar picos
    mid = len(mediciones) // 2
    return mediciones[mid]


def medir_ping_paralelo(servidores, place_id, progress_cb=None):
    """
    Mide el ping real de todos los servidores en paralelo.
    progress_cb(actual, total) se llama conforme avanzan las mediciones.
    Devuelve la lista con srv["real_ping"] inyectado.
    """
    total     = len(servidores)
    contador  = [0]
    lock      = threading.Lock()

    def medir(srv):
        ping = medir_ping_servidor(srv, place_id)
        srv  = dict(srv)           # copia para no mutar el original
        srv["real_ping"] = ping
        srv["region"]    = inferir_region_servidor(srv, place_id)
        with lock:
            contador[0] += 1
            if progress_cb:
                progress_cb(contador[0], total)
        return srv

    resultados = []
    with ThreadPoolExecutor(max_workers=PING_WORKERS) as ex:
        futuros = {ex.submit(medir, s): s for s in servidores}
        for f in as_completed(futuros):
            try:
                resultados.append(f.result())
            except Exception:
                pass

    return resultados


def clasificar(todos):
    """
    Divide en (llenos, vacios) y ordena por ping real ascendente (el más bajo
    primero = el más cercano geográficamente a ti).
    - Casi lleno : jugando > 7  (más de 7 jugadores en el servidor)
    - Casi vacío : jugando <= UMBRAL_VACIO_MAX (6 o menos)
    """
    llenos, vacios = [], []
    for srv in todos:
        jugando = srv.get("playing", 0)
        maximo  = srv.get("maxPlayers", 1)
        if jugando > 7:
            llenos.append(srv)
        elif jugando <= UMBRAL_VACIO_MAX:
            vacios.append(srv)

    def ping_key(s):
        return s.get("real_ping", s.get("ping", PING_MALO))

    # Criterio único: ping real ascendente. Menor ping = servidor más cercano.
    llenos.sort(key=lambda s: (ping_key(s), -s.get("playing", 0)))
    vacios.sort(key=lambda s: (ping_key(s),  s.get("playing", 0)))
    return llenos[:LIMITE_POR_TAB], vacios[:LIMITE_POR_TAB]

def join_link(place_id, servidor, ticket):
    job_id = servidor["id"]
    plu = (
        f"https://assetgame.roblox.com/game/PlaceLauncher.ashx"
        f"?request=RequestGameJob&placeId={place_id}&gameId={job_id}"
        f"&isPartyLeader=false&gender=&isTeleport=false"
    )
    return (
        f"roblox-player:1+launchmode:play+gameinfo:{ticket}"
        f"+placelauncherurl:{urllib.parse.quote(plu, safe='')}"
        f"+browsertrackerid:0+robloxLocale:en_us+gameLocale:en_us+channel:"
    )


# ══════════════════════════════════════════════════════════════════════════════
#  WIDGETS
# ══════════════════════════════════════════════════════════════════════════════

def ping_color(ms):
    if ms >= PING_MALO:
        return TEXT_DIM
    if ms <= 80:
        return GREEN
    if ms <= 150:
        return YELLOW
    if ms <= 220:
        return ORANGE
    return RED


class PingBadge(ctk.CTkLabel):
    def __init__(self, master, ms, label="REAL", **kw):
        if ms >= PING_MALO:
            color, txt = TEXT_DIM, "  ---"
        else:
            color = ping_color(ms)
            txt   = f"  {ms}ms"
        super().__init__(master, text=txt, text_color=color,
                         font=("Consolas", 12, "bold"), **kw)


class OccupancyBar(ctk.CTkProgressBar):
    def __init__(self, master, jugando, maximo, **kw):
        ratio = jugando / maximo if maximo else 0
        color = (GREEN  if ratio < 0.50 else
                 YELLOW if ratio < 0.80 else
                 ORANGE if ratio < 0.95 else RED)
        super().__init__(master, width=76, height=7,
                         progress_color=color, fg_color=BORDER, **kw)
        self.set(ratio)


class ServerRow(ctk.CTkFrame):
    def __init__(self, master, index, servidor, on_join, **kw):
        bg = BG_ROW if index % 2 == 0 else BG_ROW_ALT
        super().__init__(master, fg_color=bg, corner_radius=6, **kw)
        self._bg      = bg
        self.servidor = servidor
        self._build(index, servidor, on_join)
        for w in [self] + list(self.winfo_children()):
            w.bind("<Enter>", lambda e: self.configure(fg_color=BG_ROW_SEL))
            w.bind("<Leave>", lambda e: self.configure(fg_color=self._bg))

    def _build(self, idx, srv, on_join):
        real_ping = srv.get("real_ping", PING_MALO)
        api_ping  = srv.get("ping", "?")
        jugando   = srv.get("playing", 0)
        maximo    = srv.get("maxPlayers", 0)
        hueco     = maximo - jugando
        job_id    = srv["id"][:16] + "..."
        region    = srv.get("region", "?")

        # Color especial para datacenters preferidos (Miami / Brasil)
        PREFERIDOS = {"Miami, FL", "São Paulo, BR"}
        region_color = ACCENT if region in PREFERIDOS else TEXT_DIM

        c = dict(fg_color="transparent")

        # Numero
        ctk.CTkLabel(self, text=f"#{idx}", font=("Rajdhani", 12, "bold"),
                     text_color=TEXT_DIM, width=28, **c
                     ).grid(row=0, column=0, padx=(8,2), pady=7)

        # Ping REAL (medido desde tu maquina) — columna principal
        PingBadge(self, real_ping, fg_color="transparent", width=72
                  ).grid(row=0, column=1, padx=2)

        # Ping API (para referencia, mas pequeno y tenue)
        api_txt = f"api:{api_ping}ms" if isinstance(api_ping, int) else "api:?"
        ctk.CTkLabel(self, text=api_txt, font=("Consolas", 9),
                     text_color=TEXT_DIM, width=62, **c
                     ).grid(row=0, column=2, padx=1)

        # Región / Datacenter
        ctk.CTkLabel(self, text=region, font=("Rajdhani", 11, "bold"),
                     text_color=region_color, width=110, anchor="w", **c
                     ).grid(row=0, column=3, padx=(4, 2))

        # Barra ocupacion
        OccupancyBar(self, jugando, maximo
                     ).grid(row=0, column=4, padx=6)

        # Jugadores
        ctk.CTkLabel(self, text=f"{jugando}/{maximo}",
                     font=("Consolas", 11), text_color=TEXT, width=52, **c
                     ).grid(row=0, column=5, padx=2)

        # Huecos
        hc = GREEN if hueco >= 5 else (YELLOW if hueco >= 2 else RED)
        ctk.CTkLabel(self, text=f"+{hueco}", font=("Consolas", 11),
                     text_color=hc, width=34, **c
                     ).grid(row=0, column=6, padx=2)

        # ID servidor
        ctk.CTkLabel(self, text=job_id, font=("Consolas", 9),
                     text_color=TEXT_DIM, anchor="w", **c
                     ).grid(row=0, column=7, padx=(4,6), sticky="ew")

        # Boton
        ctk.CTkButton(self, text="UNIRSE ->",
                      font=("Rajdhani", 12, "bold"),
                      fg_color=ACCENT2, hover_color=ACCENT,
                      text_color="white", width=90, height=28,
                      corner_radius=5,
                      command=lambda: on_join(srv)
                      ).grid(row=0, column=8, padx=(2,10), pady=5)

        self.grid_columnconfigure(7, weight=1)


class ServerTab(ctk.CTkFrame):
    def __init__(self, master, on_join, **kw):
        super().__init__(master, fg_color="transparent", **kw)
        self._on_join = on_join

        # Cabecera
        th = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=6, height=28)
        th.pack(fill="x", pady=(0,2))
        th.pack_propagate(False)
        cols = [
            ("#",        28), ("MI PING",  72), ("API",   62),
            ("REGIÓN",  110), ("OCUP.",    76), ("PLAYERS", 52),
            ("HUECO",   34),  ("SERVER ID", 120), ("", 90),
        ]
        for i, (txt, w) in enumerate(cols):
            ctk.CTkLabel(th, text=txt, font=("Rajdhani", 10, "bold"),
                         text_color=ACCENT if txt in ("MI PING", "REGIÓN") else TEXT_DIM,
                         width=w, fg_color="transparent"
                         ).grid(row=0, column=i,
                                padx=(8 if i==0 else 2, 2), pady=3)
        th.grid_columnconfigure(7, weight=1)

        self.scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=ACCENT2)
        self.scroll.pack(fill="both", expand=True)

    def cargar(self, servidores):
        for w in self.scroll.winfo_children():
            w.destroy()
        if not servidores:
            ctk.CTkLabel(self.scroll,
                         text="No hay servidores en esta categoria.",
                         font=("Rajdhani", 13), text_color=TEXT_DIM
                         ).pack(pady=40)
            return
        for i, srv in enumerate(servidores, 1):
            ServerRow(self.scroll, i, srv, self._on_join).pack(fill="x", pady=1)

    def limpiar(self):
        for w in self.scroll.winfo_children():
            w.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  VENTANA PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Roblox Fast Join")
        self.geometry("960x680")
        self.minsize(860, 560)
        self.configure(fg_color=BG)
        self._session   = None
        self._user_info = None
        self._modal     = None
        self._place_id        = None
        self._historial_visible = False
        self._hist_win = None
        self._build_ui()
        # Geolocalizar IP antes del login
        threading.Thread(target=self._geolocate, daemon=True).start()
        self._auto_login()

    def _geolocate(self):
        """
        Intenta geolocalizar por IP (3 servicios). Si todos fallan,
        abre el modal de selección manual de región.
        """
        global _USER_LAT, _USER_LON, _USER_LOC
        self.after(0, lambda: self._set_status("Detectando ubicación...", TEXT_DIM))
        result = obtener_ubicacion_ip()
        if result:
            _USER_LAT, _USER_LON, _USER_LOC = result
            dc = datacenter_mas_cercano(_USER_LAT, _USER_LON)
            self.after(0, lambda: self._set_status(
                f"Ubicación: {_USER_LOC}  |  DC más cercano: {dc}", ACCENT))
        else:
            # Todos los servicios fallaron → pedir selección manual
            self.after(0, self._pedir_region_manual)

    def _pedir_region_manual(self):
        """Abre modal para que el usuario elija su región manualmente."""
        self._set_status("No se pudo detectar ubicación. Elige tu región.", YELLOW)
        RegionModal(self, on_submit=self._on_region_manual)

    def _on_region_manual(self, nombre_dc):
        """Callback del modal de región. Aplica la selección."""
        global _USER_LAT, _USER_LON, _USER_LOC
        if not nombre_dc:
            # Canceló → usar fallback silencioso
            _USER_LOC = "Región no configurada"
            self._set_status("Región no configurada. Se usará el ping como criterio.", TEXT_DIM)
            return
        for nombre, lat, lon, _ in ROBLOX_DATACENTERS:
            if nombre == nombre_dc:
                _USER_LAT, _USER_LON = lat, lon
                break
        _USER_LOC = f"Manual: {nombre_dc}"
        dc = datacenter_mas_cercano(_USER_LAT, _USER_LON)
        self._set_status(f"Región seleccionada: {nombre_dc}  |  DC más cercano: {dc}", GREEN)

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build_ui(self):
        # Header
        hdr = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, height=54)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        ctk.CTkLabel(hdr, text="  ROBLOX FAST JOIN",
                     font=("Rajdhani", 20, "bold"), text_color=ACCENT
                     ).pack(side="left", padx=14)

        self.btn_logout = ctk.CTkButton(
            hdr, text="Cerrar sesion", font=("Rajdhani", 11),
            fg_color="transparent", border_width=1, border_color=BORDER,
            text_color=TEXT_DIM, hover_color="#200a0a",
            width=110, height=26, command=self._logout)
        self.btn_logout.pack(side="right", padx=10)

        self.btn_historial = ctk.CTkButton(
            hdr, text="  HISTORIAL  ", font=("Rajdhani", 12, "bold"),
            fg_color="transparent", border_width=1, border_color=ACCENT2,
            text_color=ACCENT, hover_color=BG_INPUT,
            width=110, height=26, command=self._toggle_historial)
        self.btn_historial.pack(side="right", padx=(0,6))

        self.lbl_user = ctk.CTkLabel(hdr, text="Sin sesion",
                                     font=("Rajdhani", 13), text_color=TEXT_DIM)
        self.lbl_user.pack(side="right", padx=6)

        ctk.CTkFrame(self, fg_color=BORDER, height=1).pack(fill="x")

        # Barra de busqueda
        search = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, height=54)
        search.pack(fill="x")
        search.pack_propagate(False)

        ctk.CTkLabel(search, text="Place ID:", font=("Rajdhani", 13),
                     text_color=TEXT_DIM, fg_color="transparent"
                     ).pack(side="left", padx=(14,6))

        self.entry_pid = ctk.CTkEntry(
            search, placeholder_text="Ej: 4924144336",
            font=("Consolas", 13), fg_color=BG_INPUT,
            border_color=BORDER, text_color=TEXT, width=220, height=32)
        self.entry_pid.pack(side="left", padx=4)
        self.entry_pid.bind("<Return>", lambda _: self._buscar())

        self.btn_buscar = ctk.CTkButton(
            search, text="  BUSCAR  ",
            font=("Rajdhani", 14, "bold"),
            fg_color=ACCENT, hover_color=ACCENT_HVR,
            text_color="white", height=32, corner_radius=7,
            command=self._buscar)
        self.btn_buscar.pack(side="left", padx=8)

        self.lbl_status = ctk.CTkLabel(
            search, text="Esperando...", font=("Rajdhani", 12),
            text_color=TEXT_DIM, fg_color="transparent", anchor="w")
        self.lbl_status.pack(side="left", padx=8, fill="x", expand=True)

        ctk.CTkFrame(self, fg_color=BORDER, height=1).pack(fill="x")

        # Barra de progreso de ping (oculta por defecto)
        self._prog_frame = ctk.CTkFrame(self, fg_color=BG_CARD,
                                        corner_radius=0, height=28)
        self._prog_frame.pack(fill="x")
        self._prog_frame.pack_propagate(False)

        self._prog_lbl = ctk.CTkLabel(
            self._prog_frame, text="", font=("Rajdhani", 11),
            text_color=ACCENT, fg_color="transparent", width=220, anchor="w")
        self._prog_lbl.pack(side="left", padx=12)

        self._prog_bar = ctk.CTkProgressBar(
            self._prog_frame, height=8,
            progress_color=ACCENT, fg_color=BORDER)
        self._prog_bar.pack(side="left", fill="x", expand=True, padx=(0,14), pady=9)
        self._prog_bar.set(0)
        self._prog_frame.pack_forget()   # ocultar al inicio

        # Pestanas
        tab_bar = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, height=40)
        tab_bar.pack(fill="x")
        tab_bar.pack_propagate(False)

        self._tab_btns   = {}
        self._tab_frames = {}
        self._tab_activa = ctk.StringVar(value="llenos")

        for key, label in [("llenos", "  CASI LLENOS  "),
                            ("vacios",  "  CASI VACIOS  ")]:
            btn = ctk.CTkButton(
                tab_bar, text=label, font=("Rajdhani", 13, "bold"),
                fg_color=ACCENT2, hover_color=ACCENT,
                text_color="white", height=34, corner_radius=0, width=155,
                command=lambda k=key: self._cambiar_tab(k))
            btn.pack(side="left", padx=(8 if key=="llenos" else 2, 0), pady=3)
            self._tab_btns[key] = btn

        self.lbl_cnt_llenos = ctk.CTkLabel(
            tab_bar, text="", font=("Rajdhani", 11),
            text_color=ORANGE, fg_color="transparent")
        self.lbl_cnt_llenos.pack(side="left", padx=8)

        self.lbl_cnt_vacios = ctk.CTkLabel(
            tab_bar, text="", font=("Rajdhani", 11),
            text_color=GREEN, fg_color="transparent")
        self.lbl_cnt_vacios.pack(side="left", padx=2)

        # Nota de ping
        ctk.CTkLabel(tab_bar,
                     text="  MI PING = latencia real  |  REGIÓN en azul = servidor prioritario",
                     font=("Rajdhani", 10), text_color=TEXT_DIM,
                     fg_color="transparent"
                     ).pack(side="right", padx=12)

        # (Panel historial se crea como CTkToplevel en _toggle_historial)

        # Contenedor tabs
        self._container = ctk.CTkFrame(self, fg_color="transparent")
        self._container.pack(fill="both", expand=True, padx=10, pady=(6,4))

        for key in ("llenos", "vacios"):
            f = ServerTab(self._container, on_join=self._unirse)
            self._tab_frames[key] = f

        self._cambiar_tab("llenos")

        # Footer
        foot = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, height=28)
        foot.pack(fill="x", side="bottom")
        foot.pack_propagate(False)
        ctk.CTkLabel(foot, text="v3.0  —  Roblox Fast Join  |  Ping medido en tiempo real",
                     font=("Rajdhani", 10), text_color=TEXT_DIM
                     ).pack(side="left", padx=14)

    def _cambiar_tab(self, key):
        self._tab_activa.set(key)
        for k, f in self._tab_frames.items():
            f.pack_forget()
        self._tab_frames[key].pack(fill="both", expand=True)
        for k, btn in self._tab_btns.items():
            btn.configure(fg_color=ACCENT if k == key else ACCENT2)

    # ── Login ─────────────────────────────────────────────────────────────────

    def _auto_login(self):
        self._set_status("Verificando sesion...", ACCENT)
        threading.Thread(target=self._login_thread, daemon=True).start()

    def _login_thread(self):
        cookie = cargar_cookie_guardada()
        fuente = "archivo guardado"
        if not cookie:
            cookie, nav = leer_cookie_navegadores()
            if cookie:
                guardar_cookie(cookie)
                fuente = nav
            else:
                self.after(0, self._pedir_cookie_manual)
                return
        session = crear_session(cookie)
        me      = verificar_sesion(session)
        if "id" not in me:
            borrar_cookie()
            self.after(0, lambda: self._set_status("Cookie caducada.", YELLOW))
            self.after(0, self._pedir_cookie_manual)
            return
        self._session   = session
        self._user_info = me
        nombre = me.get("name", "?")
        self.after(0, lambda: self.lbl_user.configure(
            text=f"  {nombre}", text_color=GREEN))
        self.after(0, lambda: self._set_status(
            f"Sesion activa ({fuente}). Introduce un Place ID.", GREEN))

    def _pedir_cookie_manual(self):
        if self._modal:
            return
        self._modal = CookieModal(self, on_submit=self._on_cookie_manual)

    def _on_cookie_manual(self, cookie):
        self._modal = None
        if not cookie:
            return
        guardar_cookie(cookie)
        self._set_status("Verificando cookie...", ACCENT)
        threading.Thread(target=self._login_thread, daemon=True).start()

    def _logout(self):
        borrar_cookie()
        self._session = self._user_info = None
        self.lbl_user.configure(text="Sin sesion", text_color=TEXT_DIM)
        self._set_status("Sesion cerrada.", TEXT_DIM)
        self._pedir_cookie_manual()

    # ── Busqueda ──────────────────────────────────────────────────────────────

    def _buscar(self):
        if not self._session:
            self._set_status("Inicia sesion primero.", YELLOW)
            return
        pid = self.entry_pid.get().strip()
        if not pid.isdigit():
            self._set_status("El Place ID debe ser numerico.", RED)
            return
        self._place_id = pid
        for f in self._tab_frames.values():
            f.limpiar()
        self.lbl_cnt_llenos.configure(text="")
        self.lbl_cnt_vacios.configure(text="")
        self.btn_buscar.configure(state="disabled", text="Buscando...")
        self._set_status(f"Descargando lista de servidores...", ACCENT)
        threading.Thread(target=self._buscar_thread, args=(pid,), daemon=True).start()

    def _buscar_thread(self, pid):
        # 1. Descargar lista
        try:
            todos = obtener_todos_servidores(pid, self._session)
        except Exception as e:
            self.after(0, lambda: self._set_status(f"Error: {e}", RED))
            self.after(0, lambda: self.btn_buscar.configure(
                state="normal", text="  BUSCAR  "))
            return

        if not todos:
            self.after(0, lambda: self._set_status(
                "No se encontraron servidores.", YELLOW))
            self.after(0, lambda: self.btn_buscar.configure(
                state="normal", text="  BUSCAR  "))
            return

        n = len(todos)
        self.after(0, lambda: self._set_status(
            f"{n} servidores descargados. Midiendo ping real...", ACCENT))
        self.after(0, self._mostrar_progreso)

        # 2. Medir ping real en paralelo con progreso en UI
        def on_progress(actual, total):
            pct = actual / total
            self.after(0, lambda: self._prog_bar.set(pct))
            self.after(0, lambda: self._prog_lbl.configure(
                text=f"Midiendo ping... {actual}/{total}"))

        con_ping = medir_ping_paralelo(todos, pid, progress_cb=on_progress)

        # 3. Clasificar y mostrar
        llenos, vacios = clasificar(con_ping)
        nombre_juego   = obtener_nombre_juego(pid, self._session)
        self.after(0, lambda: self._ocultar_progreso())
        self.after(0, lambda: self._mostrar(pid, llenos, vacios, n, nombre_juego))

    def _mostrar_progreso(self):
        self._prog_frame.pack(fill="x", after=None)  # re-insertar si estaba oculto
        # Repack en orden correcto
        self._prog_frame.pack_forget()
        # Insertar despues del separador de busqueda — antes de las pestanas
        self._prog_frame.pack(fill="x", before=self._container)
        self._prog_bar.set(0)
        self._prog_lbl.configure(text="Iniciando medicion de ping...")

    def _ocultar_progreso(self):
        self._prog_frame.pack_forget()

    def _mostrar(self, pid, llenos, vacios, total, nombre_juego=""):
        self.btn_buscar.configure(state="normal", text="  BUSCAR  ")
        self._tab_frames["llenos"].cargar(llenos)
        self._tab_frames["vacios"].cargar(vacios)
        self.lbl_cnt_llenos.configure(
            text=f"Casi llenos: {len(llenos)}")
        self.lbl_cnt_vacios.configure(
            text=f"  |  Casi vacios: {len(vacios)}")
        self._set_status(
            f"{total} servidores analizados. Ordenados por proximidad (ping real). "
            f"{len(llenos)} llenos, {len(vacios)} vacios.", GREEN)
        # Guardar en historial
        if nombre_juego:
            agregar_al_historial(pid, nombre_juego)
            self._refrescar_historial()

    # ── Unirse ────────────────────────────────────────────────────────────────

    def _unirse(self, servidor):
        if not self._place_id:
            return
        self._set_status("Generando auth-ticket...", ACCENT)
        threading.Thread(target=self._unirse_thread,
                         args=(self._place_id, servidor), daemon=True).start()

    def _unirse_thread(self, place_id, servidor):
        try:
            ticket = obtener_auth_ticket(self._session)
        except RuntimeError as e:
            self.after(0, lambda: self._set_status(f"Error: {e}", RED))
            return
        webbrowser.open(join_link(place_id, servidor, ticket))
        rp      = servidor.get("real_ping", "?")
        jugando = servidor.get("playing", 0)
        maximo  = servidor.get("maxPlayers", 0)
        self.after(0, lambda: self._set_status(
            f"Lanzando Roblox  ->  ping real: {rp}ms  |  {jugando}/{maximo} jugadores",
            GREEN))

    # ── Historial ─────────────────────────────────────────────────────────────

    def _toggle_historial(self):
        # Si ya hay una ventana abierta, cerrarla
        if hasattr(self, "_hist_win") and self._hist_win and self._hist_win.winfo_exists():
            self._hist_win.destroy()
            self._hist_win = None
            self.btn_historial.configure(fg_color="transparent", text_color=ACCENT)
            return
        # Crear ventana de historial
        win = ctk.CTkToplevel(self)
        win.title("Historial de búsquedas")
        win.geometry("360x520")
        win.resizable(False, True)
        win.configure(fg_color=BG_CARD)
        # Posicionar junto a la ventana principal
        x = self.winfo_x() + self.winfo_width() - 370
        y = self.winfo_y() + 60
        win.geometry(f"+{x}+{y}")
        win.protocol("WM_DELETE_WINDOW", lambda: (
            win.destroy(),
            setattr(self, "_hist_win", None),
            self.btn_historial.configure(fg_color="transparent", text_color=ACCENT)
        ))
        self._hist_win = win
        self.btn_historial.configure(fg_color=ACCENT2, text_color="white")
        self._hist_scroll = ctk.CTkScrollableFrame(win, fg_color="transparent",
            scrollbar_button_color=BORDER, scrollbar_button_hover_color=ACCENT2)

        # Header dentro del toplevel
        hdr = ctk.CTkFrame(win, fg_color=BG_INPUT, corner_radius=0, height=40)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text="  HISTORIAL DE BÚSQUEDAS",
                     font=("Rajdhani", 13, "bold"), text_color=ACCENT,
                     fg_color="transparent").pack(side="left", padx=10)
        ctk.CTkButton(hdr, text="Limpiar", font=("Rajdhani", 11),
                      fg_color="transparent", text_color=TEXT_DIM,
                      hover_color=BG_ROW, width=60, height=28,
                      command=self._limpiar_historial).pack(side="right", padx=8)

        self._hist_scroll.pack(fill="both", expand=True, padx=4, pady=4)
        self._refrescar_historial()

    def _refrescar_historial(self):
        """Redibuja las entradas del panel historial."""
        for w in self._hist_scroll.winfo_children():
            w.destroy()
        entradas = cargar_historial()
        if not entradas:
            ctk.CTkLabel(self._hist_scroll,
                         text="Sin búsquedas recientes.",
                         font=("Rajdhani", 12), text_color=TEXT_DIM
                         ).pack(pady=30)
            return
        for entrada in entradas:
            pid    = entrada.get("place_id", "")
            nombre = entrada.get("nombre",   pid)
            fecha  = entrada.get("fecha",    "")
            card = ctk.CTkFrame(self._hist_scroll, fg_color=BG_ROW,
                                corner_radius=7)
            card.pack(fill="x", pady=3, padx=2)
            # Hover
            for w in [card]:
                w.bind("<Enter>", lambda e, c=card: c.configure(fg_color=BG_ROW_SEL))
                w.bind("<Leave>", lambda e, c=card: c.configure(fg_color=BG_ROW))
            top = ctk.CTkFrame(card, fg_color="transparent")
            top.pack(fill="x", padx=8, pady=(6,2))
            ctk.CTkLabel(top, text=nombre,
                         font=("Rajdhani", 13, "bold"), text_color=TEXT,
                         anchor="w", wraplength=200
                         ).pack(side="left", fill="x", expand=True)
            bot = ctk.CTkFrame(card, fg_color="transparent")
            bot.pack(fill="x", padx=8, pady=(0,6))
            ctk.CTkLabel(bot, text=f"ID: {pid}",
                         font=("Consolas", 9), text_color=TEXT_DIM, anchor="w"
                         ).pack(side="left")
            ctk.CTkLabel(bot, text=fecha,
                         font=("Rajdhani", 10), text_color=TEXT_DIM, anchor="e"
                         ).pack(side="left", padx=(8,0))
            ctk.CTkButton(bot, text="BUSCAR →",
                          font=("Rajdhani", 11, "bold"),
                          fg_color=ACCENT2, hover_color=ACCENT,
                          text_color="white", width=80, height=24,
                          corner_radius=5,
                          command=lambda p=pid: self._buscar_desde_historial(p)
                          ).pack(side="right")

    def _buscar_desde_historial(self, place_id):
        """Rellena el entry con el place_id y lanza la búsqueda."""
        # Cerrar ventana historial
        if hasattr(self, "_hist_win") and self._hist_win and self._hist_win.winfo_exists():
            self._hist_win.destroy()
            self._hist_win = None
            self.btn_historial.configure(fg_color="transparent", text_color=ACCENT)
        self.entry_pid.delete(0, "end")
        self.entry_pid.insert(0, place_id)
        self._buscar()

    def _limpiar_historial(self):
        guardar_historial([])
        if hasattr(self, "_hist_scroll") and self._hist_scroll.winfo_exists():
            self._refrescar_historial()

    # ── Helper ────────────────────────────────────────────────────────────────

    def _set_status(self, msg, color=TEXT):
        self.lbl_status.configure(text=msg, text_color=color)


# ══════════════════════════════════════════════════════════════════════════════
#  MODAL SELECCIÓN DE REGIÓN
# ══════════════════════════════════════════════════════════════════════════════

class RegionModal(ctk.CTkToplevel):
    """
    Modal que aparece cuando la geolocalización por IP falla.
    Muestra los datacenters de Roblox disponibles para que el usuario elija
    el más cercano a su ubicación real.
    """
    REGIONES = [
        ("Miami, FL",        "🇺🇸  Miami, FL  —  Mejor para Colombia, Venezuela, Caribe"),
        ("São Paulo, BR",    "🇧🇷  São Paulo, Brasil  —  Mejor para Sudamérica"),
        ("Dallas, TX",       "🇺🇸  Dallas, TX  —  Centro de EE.UU."),
        ("Ashburn, VA",      "🇺🇸  Ashburn, VA  —  Este de EE.UU."),
        ("Los Angeles, CA",  "🇺🇸  Los Ángeles, CA  —  Oeste de EE.UU."),
        ("Amsterdam, NL",    "🇳🇱  Ámsterdam  —  Europa Occidental"),
        ("London, UK",       "🇬🇧  Londres  —  Europa / Reino Unido"),
        ("Singapore, SG",    "🇸🇬  Singapur  —  Sudeste Asiático"),
        ("Tokyo, JP",        "🇯🇵  Tokio  —  Asia Oriental"),
        ("Sydney, AU",       "🇦🇺  Sídney  —  Oceanía"),
    ]

    def __init__(self, parent, on_submit):
        super().__init__(parent)
        self.on_submit  = on_submit
        self._seleccion = ctk.StringVar(value="Miami, FL")
        self.title("Seleccionar región")
        self.geometry("520x460")
        self.resizable(False, False)
        self.configure(fg_color=BG_CARD)
        self.grab_set()
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="¿Dónde estás ubicado?",
                     font=("Rajdhani", 18, "bold"), text_color=ACCENT
                     ).pack(pady=(20, 4))
        ctk.CTkLabel(self,
                     text="No se pudo detectar tu ubicación automáticamente.\n"
                          "Elige el servidor de Roblox más cercano a ti:",
                     font=("Rajdhani", 13), text_color=TEXT_DIM, justify="center"
                     ).pack(pady=(0, 12))

        scroll = ctk.CTkScrollableFrame(self, fg_color=BG_INPUT,
                                        corner_radius=8, height=280)
        scroll.pack(fill="x", padx=24)

        for dc_key, label in self.REGIONES:
            is_priority = dc_key in ("Miami, FL", "São Paulo, BR")
            row = ctk.CTkFrame(scroll, fg_color="transparent")
            row.pack(fill="x", pady=2)
            rb = ctk.CTkRadioButton(
                row, text=label,
                variable=self._seleccion, value=dc_key,
                font=("Rajdhani", 13, "bold" if is_priority else "normal"),
                text_color=ACCENT if is_priority else TEXT,
                fg_color=ACCENT, hover_color=ACCENT_HVR,
                border_color=BORDER)
            rb.pack(anchor="w", padx=12, pady=3)

        ctk.CTkLabel(self,
                     text="★ = Recomendado para Colombia / Venezuela",
                     font=("Rajdhani", 10), text_color=TEXT_DIM
                     ).pack(pady=(8, 0))

        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(pady=12)
        ctk.CTkButton(row, text="Cancelar", font=("Rajdhani", 13),
                      fg_color="transparent", border_width=1, border_color=BORDER,
                      text_color=TEXT_DIM, hover_color="#1a0a0a",
                      width=100, height=34,
                      command=self._cancelar).pack(side="left", padx=6)
        ctk.CTkButton(row, text="Confirmar región",
                      font=("Rajdhani", 13, "bold"), width=180, height=34,
                      fg_color=ACCENT, hover_color=ACCENT_HVR,
                      command=self._submit).pack(side="left", padx=6)

    def _submit(self):
        val = self._seleccion.get()
        self.destroy()
        self.on_submit(val)

    def _cancelar(self):
        self.destroy()
        self.on_submit(None)


# ══════════════════════════════════════════════════════════════════════════════
#  MODAL COOKIE
# ══════════════════════════════════════════════════════════════════════════════

class CookieModal(ctk.CTkToplevel):
    def __init__(self, parent, on_submit):
        super().__init__(parent)
        self.on_submit = on_submit
        self.title("Iniciar sesion")
        self.geometry("520x420")
        self.resizable(False, False)
        self.configure(fg_color=BG_CARD)
        self.grab_set()
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Sesion de Roblox",
                     font=("Rajdhani", 18, "bold"), text_color=ACCENT
                     ).pack(pady=(20,4))
        ctk.CTkLabel(self,
                     text="No se detectó sesión en Chrome/Edge/Firefox automáticamente.",
                     font=("Rajdhani", 13), text_color=TEXT_DIM, justify="center"
                     ).pack(pady=(0,4))

        info = ctk.CTkFrame(self, fg_color=BG_INPUT, corner_radius=8)
        info.pack(fill="x", padx=24, pady=(0,10))
        ctk.CTkLabel(info,
                     text="ℹ  La app intenta leer la cookie automáticamente de tu navegador.\n"
                          "   Causas frecuentes de fallo: Roblox.com no está abierto/logueado,\n"
                          "   perfil de Chrome bloqueado, o navegador con encriptación activa.",
                     font=("Rajdhani", 11), text_color=TEXT_DIM,
                     justify="left", anchor="w"
                     ).pack(padx=12, pady=8, anchor="w")

        ctk.CTkLabel(self,
                     text="Introduce tu cookie .ROBLOSECURITY manualmente:",
                     font=("Rajdhani", 13), text_color=TEXT, justify="center"
                     ).pack(pady=(0,6))

        self.entry = ctk.CTkEntry(
            self, placeholder_text="_|WARNING:-DO-NOT-SHARE-THIS...",
            font=("Consolas", 11), fg_color=BG_INPUT,
            border_color=BORDER, text_color=TEXT,
            width=440, height=36, show="*")
        self.entry.pack(padx=30)

        pasos = ctk.CTkFrame(self, fg_color=BG_INPUT, corner_radius=8)
        pasos.pack(fill="x", padx=24, pady=(8,12))
        ctk.CTkLabel(pasos,
                     text="Pasos:  roblox.com en tu navegador  →  F12  →\n"
                          "Application (Chrome/Edge) o Storage (Firefox)  →  Cookies\n"
                          "→  https://www.roblox.com  →  copia .ROBLOSECURITY",
                     font=("Consolas", 10), text_color=TEXT_DIM,
                     justify="left", anchor="w"
                     ).pack(padx=12, pady=8, anchor="w")

        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack()
        ctk.CTkButton(row, text="Cancelar", font=("Rajdhani", 13),
                      fg_color="transparent", border_width=1, border_color=BORDER,
                      text_color=TEXT_DIM, hover_color="#1a0a0a",
                      width=100, height=34,
                      command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(row, text="Guardar y continuar",
                      font=("Rajdhani", 13, "bold"), width=180, height=34,
                      fg_color=ACCENT, hover_color=ACCENT_HVR,
                      command=self._submit).pack(side="left", padx=6)

    def _submit(self):
        val = self.entry.get().strip()
        self.destroy()
        self.on_submit(val)


# ══════════════════════════════════════════════════════════════════════════════
#  MODAL DE ACTIVACIÓN DE LICENCIA
# ══════════════════════════════════════════════════════════════════════════════

class LicenseModal(ctk.CTkToplevel):
    """
    Se muestra cuando no hay licencia guardada o la guardada es inválida.
    El usuario introduce su clave y se valida contra el servidor.
    """
    def __init__(self, parent, on_success, error_msg=""):
        super().__init__(parent)
        self.on_success  = on_success
        self.title("Activar Roblox Fast Join")
        self.geometry("500x360")
        self.resizable(False, False)
        self.configure(fg_color=BG_CARD)
        self.grab_set()
        self.protocol("WM_DELETE_WINDOW", self._cerrar)
        self._build(error_msg)

    def _build(self, error_msg=""):
        # Logo / título
        ctk.CTkLabel(self, text="ROBLOX FAST JOIN",
                     font=("Rajdhani", 22, "bold"), text_color=ACCENT
                     ).pack(pady=(24, 2))
        ctk.CTkLabel(self, text="Introduce tu clave de licencia para continuar",
                     font=("Rajdhani", 13), text_color=TEXT_DIM
                     ).pack(pady=(0, 16))

        # Caja de clave
        self.entry = ctk.CTkEntry(
            self, placeholder_text="RFJ-XXXX-XXXX-XXXX-XXXX",
            font=("Consolas", 13), fg_color=BG_INPUT,
            border_color=BORDER if not error_msg else RED,
            text_color=TEXT, width=380, height=40)
        self.entry.pack(padx=40)

        # Mensaje de error (si lo hay)
        self.lbl_err = ctk.CTkLabel(
            self, text=error_msg,
            font=("Rajdhani", 12), text_color=RED)
        self.lbl_err.pack(pady=(6, 0))

        # Separador info
        info = ctk.CTkFrame(self, fg_color=BG_INPUT, corner_radius=8)
        info.pack(fill="x", padx=40, pady=14)
        ctk.CTkLabel(info,
                     text="🔑  Licencia permanente  — acceso de por vida\n"
                          "⏱  Token de 6 horas  — acceso temporal\n\n"
                          "Contacta al vendedor para obtener tu clave.",
                     font=("Rajdhani", 12), text_color=TEXT_DIM,
                     justify="left", anchor="w"
                     ).pack(padx=14, pady=10, anchor="w")

        # Botón activar
        self.btn = ctk.CTkButton(
            self, text="  ACTIVAR  ",
            font=("Rajdhani", 14, "bold"),
            fg_color=ACCENT, hover_color=ACCENT_HVR,
            text_color="white", height=38, width=200,
            corner_radius=8,
            command=self._activar)
        self.btn.pack(pady=(0, 10))

        self.entry.bind("<Return>", lambda _: self._activar())

    def _activar(self):
        key = self.entry.get().strip().upper()
        if not key:
            self._mostrar_error("Introduce una clave.")
            return
        self.btn.configure(state="disabled", text="Verificando...")
        self.lbl_err.configure(text="", text_color=ACCENT)
        threading.Thread(target=self._verificar_thread, args=(key,), daemon=True).start()

    def _verificar_thread(self, key):
        try:
            info = validar_licencia_servidor(key)
        except Exception as e:
            self.after(0, lambda: self._mostrar_error(f"Sin conexión con el servidor: {e}"))
            return

        if not info.get("ok"):
            msg = info.get("error", "Clave inválida")
            self.after(0, lambda: self._mostrar_error(msg))
            return

        # Guardar y continuar
        guardar_licencia_local(key, info)
        self.after(0, lambda: self._exito(key, info))

    def _mostrar_error(self, msg):
        self.lbl_err.configure(text=msg, text_color=RED)
        self.entry.configure(border_color=RED)
        self.btn.configure(state="normal", text="  ACTIVAR  ")

    def _exito(self, key, info):
        self.destroy()
        self.on_success(key, info)

    def _cerrar(self):
        """Cierra la app si el usuario cancela la activación."""
        self.destroy()
        sys.exit(0)


# ══════════════════════════════════════════════════════════════════════════════
#  CUENTA REGRESIVA PARA TOKENS TEMPORALES (badge en el header)
# ══════════════════════════════════════════════════════════════════════════════

class TokenCountdown:
    """
    Actualiza un CTkLabel con el tiempo restante del token.
    Llama a on_expire() cuando llega a 0.
    """
    def __init__(self, label: ctk.CTkLabel, expires_at_iso: str, on_expire):
        self._label      = label
        self._expires    = expires_at_iso
        self._on_expire  = on_expire
        self._running    = True
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while self._running:
            secs = segundos_restantes(self._expires)
            if secs <= 0:
                self._running = False
                self._label.after(0, lambda: self._label.configure(
                    text="⏱ EXPIRADO", text_color=RED))
                self._label.after(0, self._on_expire)
                return
            color = GREEN if secs > 3600 else (YELLOW if secs > 600 else RED)
            txt   = f"⏱ {formatear_tiempo(secs)}"
            self._label.after(0, lambda t=txt, c=color: self._label.configure(
                text=t, text_color=c))
            time.sleep(1)

    def stop(self):
        self._running = False


# ══════════════════════════════════════════════════════════════════════════════
#  PUNTO DE ENTRADA CON VALIDACIÓN DE LICENCIA
# ══════════════════════════════════════════════════════════════════════════════

def arrancar_con_licencia(key: str, info: dict):
    """Lanza la app principal e inyecta el badge de licencia."""
    main_app = App()

    # ── Badge de licencia en el header ────────────────────────────────────────
    tipo = info.get("type", "permanent")
    exp  = info.get("expires_at")

    # Buscamos el header (primer hijo de la ventana)
    hdr = None
    for child in main_app.winfo_children():
        if isinstance(child, ctk.CTkFrame):
            hdr = child
            break

    if hdr:
        if tipo == "permanent":
            ctk.CTkLabel(hdr, text="✓ LICENCIA PERMANENTE",
                         font=("Rajdhani", 11, "bold"), text_color=GREEN,
                         fg_color="transparent"
                         ).pack(side="left", padx=(0, 10))
        else:
            # Token temporal — cuenta regresiva
            badge = ctk.CTkLabel(hdr, text="⏱ --:--:--",
                                 font=("Rajdhani", 12, "bold"),
                                 text_color=YELLOW,
                                 fg_color="transparent")
            badge.pack(side="left", padx=(0, 10))

            def token_expirado():
                import tkinter.messagebox as mb
                mb.showerror("Token expirado",
                             "Tu sesión de 6 horas ha terminado.\n"
                             "Adquiere una licencia permanente para acceso continuo.")
                main_app.destroy()
                sys.exit(0)

            main_app._countdown = TokenCountdown(badge, exp, on_expire=token_expirado)

        # Botón para desactivar / cambiar licencia
        def desactivar():
            borrar_licencia_local()
            main_app.destroy()
            iniciar()   # vuelve a pedir clave

        ctk.CTkButton(hdr, text="Licencia", font=("Rajdhani", 10),
                      fg_color="transparent", border_width=1,
                      border_color=BORDER, text_color=TEXT_DIM,
                      hover_color=BG_INPUT, width=70, height=22,
                      command=desactivar
                      ).pack(side="left", padx=(0, 6))

    main_app.mainloop()


def iniciar():
    """Flujo de arranque: valida licencia antes de mostrar la app."""

    # Ventana raíz mínima para poder abrir modales
    root = ctk.CTk()
    root.withdraw()   # invisible — solo es el padre de los modales

    def on_license_ok(key, info):
        root.destroy()
        arrancar_con_licencia(key, info)

    def pedir_clave(error=""):
        LicenseModal(root, on_success=on_license_ok, error_msg=error)
        root.mainloop()

    # ── ¿Hay licencia guardada localmente? ────────────────────────────────────
    local = cargar_licencia_local()
    if local:
        key = local.get("key", "")
        try:
            info = validar_licencia_servidor(key)
            if info.get("ok"):
                root.destroy()
                arrancar_con_licencia(key, info)
                return
            else:
                borrar_licencia_local()
                pedir_clave(info.get("error", "Licencia inválida"))
        except Exception:
            # Sin conexión — si la licencia local es permanente dejamos pasar
            # (modo offline para permanentes)
            tipo = local.get("type", "token")
            if tipo == "permanent":
                root.destroy()
                arrancar_con_licencia(key, local)
                return
            else:
                # Token temporal: sin conexión no podemos verificar expiración
                exp = local.get("expires_at")
                if exp and segundos_restantes(exp) > 0:
                    root.destroy()
                    arrancar_con_licencia(key, local)
                    return
                else:
                    borrar_licencia_local()
                    pedir_clave("Sin conexión y token expirado.")
    else:
        pedir_clave()


if __name__ == "__main__":
    iniciar()