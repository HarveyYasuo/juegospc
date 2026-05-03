"""
Roblox Fast Join — Servidor de Licencias v1.0
==============================================
Gestiona licencias permanentes y tokens temporales (máx 6h).

Instalar:
    pip install flask python-dotenv

Ejecutar:
    python server.py

Variables de entorno — crea un archivo .env en la misma carpeta
con los valores de SECRET_KEY, ADMIN_KEY, etc.
"""

import os, sqlite3, secrets, hashlib, datetime, json
from functools import wraps
from flask import Flask, request, jsonify, g

# ── Cargar .env automáticamente ───────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass   # si no está instalado, usa las variables del sistema igualmente
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY  = os.environ.get("SECRET_KEY",  "CAMBIA_ESTA_CLAVE_SECRETA_EN_PRODUCCION")
ADMIN_KEY   = os.environ.get("ADMIN_KEY",   "CAMBIA_ESTA_CLAVE_ADMIN")
DATABASE    = os.environ.get("DATABASE",    "licenses.db")
TOKEN_MAX_H = 6          # horas máximas para tokens temporales
VERSION_OK  = "3.0"      # versión mínima del cliente aceptada


# ══════════════════════════════════════════════════════════════════════════════
#  BASE DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS licenses (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                key         TEXT    UNIQUE NOT NULL,
                type        TEXT    NOT NULL DEFAULT 'permanent',
                hwid        TEXT,
                created_at  TEXT    NOT NULL,
                expires_at  TEXT,
                activated_at TEXT,
                uses_left   INTEGER DEFAULT NULL,
                active      INTEGER DEFAULT 1,
                note        TEXT
            );

            CREATE TABLE IF NOT EXISTS activations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT    NOT NULL,
                hwid        TEXT    NOT NULL,
                ip          TEXT,
                timestamp   TEXT    NOT NULL
            );
        """)
        db.commit()


# ══════════════════════════════════════════════════════════════════════════════
#  UTILIDADES
# ══════════════════════════════════════════════════════════════════════════════

def now_iso():
    return datetime.datetime.utcnow().isoformat()

def iso_to_dt(s):
    return datetime.datetime.fromisoformat(s)

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-Admin-Key") or request.args.get("admin_key")
        if key != ADMIN_KEY:
            return jsonify({"ok": False, "error": "No autorizado"}), 403
        return f(*args, **kwargs)
    return decorated

def generate_license_key(prefix="RFJ"):
    """Genera clave con formato RFJ-XXXX-XXXX-XXXX-XXXX"""
    parts = [secrets.token_hex(2).upper() for _ in range(4)]
    return f"{prefix}-{'-'.join(parts)}"

def generate_token(license_key, hwid, hours):
    """Genera un token firmado con HMAC-SHA256 válido por N horas."""
    expires = datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
    payload = {
        "lic": license_key,
        "hwid": hwid,
        "exp": expires.isoformat(),
        "iat": now_iso(),
    }
    # Firmamos el payload con HMAC simple (no requiere librería jwt)
    data    = json.dumps(payload, sort_keys=True)
    sig     = hashlib.sha256((data + SECRET_KEY).encode()).hexdigest()
    token   = hashlib.sha256(f"{license_key}{hwid}{expires.isoformat()}{SECRET_KEY}".encode()).hexdigest()
    return token, expires.isoformat()

def hash_hwid(hwid: str) -> str:
    """Hashea el HWID antes de guardarlo en DB (privacidad)."""
    return hashlib.sha256((hwid + SECRET_KEY).encode()).hexdigest()[:32]


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINTS PÚBLICOS (usados por el cliente)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/v1/validate", methods=["POST"])
def validate():
    """
    El cliente llama aquí al arrancar.
    Body JSON: { "key": "...", "hwid": "...", "version": "3.0" }
    Respuesta: { "ok": true, "type": "permanent"|"token", "expires_at": null|"ISO" }
    """
    data    = request.get_json(silent=True) or {}
    key     = (data.get("key") or "").strip().upper()
    hwid    = (data.get("hwid") or "").strip()
    version = data.get("version", "0")

    if not key or not hwid:
        return jsonify({"ok": False, "error": "Datos incompletos"}), 400

    db  = get_db()
    row = db.execute("SELECT * FROM licenses WHERE key=?", (key,)).fetchone()

    if not row:
        return jsonify({"ok": False, "error": "Licencia no encontrada"}), 404

    if not row["active"]:
        return jsonify({"ok": False, "error": "Licencia desactivada"}), 403

    hwid_hash = hash_hwid(hwid)

    # Verificar HWID — si no está vinculada aún, vincularla
    if row["hwid"] is None:
        db.execute("UPDATE licenses SET hwid=?, activated_at=? WHERE key=?",
                   (hwid_hash, now_iso(), key))
        db.commit()
    elif row["hwid"] != hwid_hash:
        return jsonify({"ok": False,
                        "error": "Licencia vinculada a otro dispositivo"}), 403

    # Verificar expiración (tokens temporales)
    if row["expires_at"]:
        exp = iso_to_dt(row["expires_at"])
        if datetime.datetime.utcnow() > exp:
            db.execute("UPDATE licenses SET active=0 WHERE key=?", (key,))
            db.commit()
            return jsonify({"ok": False, "error": "Licencia expirada"}), 403

    # Registrar activación
    db.execute("INSERT INTO activations (license_key,hwid,ip,timestamp) VALUES (?,?,?,?)",
               (key, hwid_hash, request.remote_addr, now_iso()))
    db.commit()

    return jsonify({
        "ok":         True,
        "type":       row["type"],
        "expires_at": row["expires_at"],
        "version_ok": version >= VERSION_OK,
    })


@app.route("/v1/version", methods=["GET"])
def version_check():
    """El cliente comprueba si hay una versión nueva."""
    return jsonify({
        "latest":  VERSION_OK,
        "download": "https://tu-sitio.com/download"
    })


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINTS DE ADMIN (requieren X-Admin-Key)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/admin/create", methods=["POST"])
@require_admin
def admin_create():
    """
    Crea una licencia nueva.
    Body: {
        "type": "permanent" | "token",
        "hours": 6,          ← solo si type=token
        "note": "cliente X"
    }
    """
    data  = request.get_json(silent=True) or {}
    ltype = data.get("type", "permanent")
    note  = data.get("note", "")
    hours = min(int(data.get("hours", TOKEN_MAX_H)), TOKEN_MAX_H)

    key        = generate_license_key()
    expires_at = None

    if ltype == "token":
        expires_at = (datetime.datetime.utcnow() +
                      datetime.timedelta(hours=hours)).isoformat()

    db = get_db()
    db.execute(
        "INSERT INTO licenses (key,type,created_at,expires_at,note) VALUES (?,?,?,?,?)",
        (key, ltype, now_iso(), expires_at, note)
    )
    db.commit()

    return jsonify({
        "ok":         True,
        "key":        key,
        "type":       ltype,
        "expires_at": expires_at,
        "note":       note,
    })


@app.route("/admin/list", methods=["GET"])
@require_admin
def admin_list():
    """Lista todas las licencias."""
    db   = get_db()
    rows = db.execute("SELECT * FROM licenses ORDER BY id DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/admin/revoke", methods=["POST"])
@require_admin
def admin_revoke():
    """Revoca una licencia. Body: { "key": "RFJ-..." }"""
    data = request.get_json(silent=True) or {}
    key  = (data.get("key") or "").strip().upper()
    db   = get_db()
    db.execute("UPDATE licenses SET active=0 WHERE key=?", (key,))
    db.commit()
    return jsonify({"ok": True, "revoked": key})


@app.route("/admin/reset-hwid", methods=["POST"])
@require_admin
def admin_reset_hwid():
    """Desvincula el HWID de una licencia (para cambio de PC). Body: { "key": "..." }"""
    data = request.get_json(silent=True) or {}
    key  = (data.get("key") or "").strip().upper()
    db   = get_db()
    db.execute("UPDATE licenses SET hwid=NULL, activated_at=NULL WHERE key=?", (key,))
    db.commit()
    return jsonify({"ok": True, "message": f"HWID reseteado para {key}"})


@app.route("/admin/stats", methods=["GET"])
@require_admin
def admin_stats():
    """Estadísticas rápidas."""
    db = get_db()
    total      = db.execute("SELECT COUNT(*) FROM licenses").fetchone()[0]
    active     = db.execute("SELECT COUNT(*) FROM licenses WHERE active=1").fetchone()[0]
    permanent  = db.execute("SELECT COUNT(*) FROM licenses WHERE type='permanent' AND active=1").fetchone()[0]
    tokens     = db.execute("SELECT COUNT(*) FROM licenses WHERE type='token' AND active=1").fetchone()[0]
    activations= db.execute("SELECT COUNT(*) FROM activations").fetchone()[0]
    return jsonify({
        "total_licenses":   total,
        "active":           active,
        "permanent":        permanent,
        "tokens_active":    tokens,
        "total_activations": activations,
    })


# ══════════════════════════════════════════════════════════════════════════════
#  RUTAS WEB — Generación de tokens vía anuncios (Linkvertise / Work.ink)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Flujo:
#    1. Usuario llega a /get-token
#    2. Elige Linkvertise o Work.ink  → lo redirigimos al link de anuncios
#    3. La plataforma redirige de vuelta a /verify?src=linkvertise&code=XXX
#    4. Verificamos el code con la API de la plataforma
#    5. Si es válido → generamos token 6h y lo mostramos
#
# ══════════════════════════════════════════════════════════════════════════════

from flask import render_template, redirect, url_for, session as flask_session
import urllib.parse

# ── Configuración de plataformas de anuncios ──────────────────────────────────
# Linkvertise: crea tu link en linkvertise.com y pega la URL aquí
LINKVERTISE_URL    = os.environ.get("LINKVERTISE_URL", "https://linkvertise.com/TU_ID/roblox-fast-join")
LINKVERTISE_API    = os.environ.get("LINKVERTISE_API", "TU_API_KEY_LINKVERTISE")

# Work.ink: crea tu link en work.ink y pega la URL aquí
WORKINK_URL        = os.environ.get("WORKINK_URL",  "https://work.ink/TU_ID/roblox-fast-join")
WORKINK_API        = os.environ.get("WORKINK_API",  "TU_API_KEY_WORKINK")

# Clave para firmar la sesión Flask (distinta a SECRET_KEY del server)
app.secret_key = os.environ.get("FLASK_SECRET", SECRET_KEY + "_web")

# Rate limiting simple por IP (evita abuso)
_ip_cooldown: dict = {}   # ip -> ultimo timestamp de token generado
TOKEN_COOLDOWN_H = 6      # horas mínimas entre tokens para la misma IP


def _ip_en_cooldown(ip: str) -> bool:
    ts = _ip_cooldown.get(ip)
    if not ts:
        return False
    diff = datetime.datetime.utcnow() - datetime.datetime.fromisoformat(ts)
    return diff.total_seconds() < TOKEN_COOLDOWN_H * 3600


def _registrar_ip(ip: str):
    _ip_cooldown[ip] = now_iso()


def _crear_token_publico(ip: str, fuente: str) -> dict:
    """Genera un token de 6h y lo guarda en la DB."""
    key        = generate_license_key(prefix="TKN")
    expires_at = (datetime.datetime.utcnow() +
                  datetime.timedelta(hours=TOKEN_MAX_H)).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO licenses (key,type,created_at,expires_at,note,active) VALUES (?,?,?,?,?,1)",
        (key, "token", now_iso(), expires_at, f"web:{fuente}:{ip}")
    )
    db.commit()
    _registrar_ip(ip)
    return {"key": key, "expires_at": expires_at}


def _verificar_linkvertise(code: str) -> bool:
    """
    Sin API key de Linkvertise (plan gratuito):
    Confiamos en que el usuario llegó a /verify después de pasar
    por el link de anuncios. La protección contra abuso la hace
    el rate limit por IP — 1 token cada 6h por dirección IP.

    Cuando consigas API key en Linkvertise, descomenta el bloque
    de abajo y borra el "return True".
    """
    return True

    # ── Con API key (descomentar cuando la tengas) ──────────────────
    # try:
    #     r = requests.get(
    #         "https://publisher.linkvertise.com/api/v1/redirect/link/verification",
    #         params={"api_key": LINKVERTISE_API, "token": code},
    #         timeout=8
    #     )
    #     data = r.json()
    #     return data.get("success") is True or data.get("valid") is True
    # except Exception:
    #     return False


def _verificar_workink(code: str) -> bool:
    """
    Sin API key de Work.ink (plan gratuito):
    Igual que Linkvertise — confiamos en el redirect + rate limit IP.

    Cuando consigas API key, descomenta el bloque de abajo.
    """
    return True

    # ── Con API key (descomentar cuando la tengas) ──────────────────
    # try:
    #     r = requests.get(
    #         "https://work.ink/api/validate",
    #         params={"api_key": WORKINK_API, "token": code},
    #         timeout=8
    #     )
    #     data = r.json()
    #     return data.get("success") is True or data.get("valid") is True
    # except Exception:
    #     return False


# ── Páginas web ───────────────────────────────────────────────────────────────

@app.route("/")
@app.route("/get-token")
def get_token_page():
    """Landing page principal."""
    return render_template("index.html",
                           linkvertise_url=LINKVERTISE_URL,
                           workink_url=WORKINK_URL)


@app.route("/verify")
def verify():
    """
    Callback que reciben Linkvertise y Work.ink después de que el usuario
    completó los anuncios.
    Params: ?src=linkvertise|workink  (&code=TOKEN opcional)
    """
    src  = request.args.get("src", "")
    code = request.args.get("code", "").strip()   # opcional — no todas las plataformas lo mandan
    ip   = request.remote_addr

    if src not in ("linkvertise", "workink"):
        return render_template("result.html", ok=False, error="Fuente desconocida.")

    # Rate limit por IP
    if _ip_en_cooldown(ip):
        return render_template("result.html",
                               ok=False,
                               error="Ya obtuviste un token recientemente. "
                                     f"Espera {TOKEN_COOLDOWN_H} horas.")

    # Verificar con la plataforma (ambas retornan True por ahora sin API key)
    if src == "linkvertise":
        valido = _verificar_linkvertise(code)
    else:
        valido = _verificar_workink(code)

    if not valido:
        return render_template("result.html",
                               ok=False,
                               error="No se pudo verificar que completaste los anuncios. "
                                     "Intenta de nuevo.")

    # Generar token
    info = _crear_token_publico(ip, src)
    return render_template("result.html",
                           ok=True,
                           key=info["key"],
                           expires_at=info["expires_at"],
                           src=src)


# ══════════════════════════════════════════════════════════════════════════════
init_db()
if __name__ == "__main__":
    
    print("=" * 55)
    print("  Roblox Fast Join — Servidor de Licencias v1.0")
    print("=" * 55)
    print(f"  Admin key : {ADMIN_KEY}")
    print(f"  Database  : {DATABASE}")
    print(f"  Token max : {TOKEN_MAX_H}h")
    print(f"  Web       : http://localhost:5000/get-token")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5000, debug=False)
