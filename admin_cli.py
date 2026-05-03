"""
Roblox Fast Join — Admin CLI
Uso: python admin_cli.py [comando] [opciones]

Requiere: pip install requests
Configura SERVER_URL y ADMIN_KEY antes de usar.
"""

import sys, requests, json

SERVER_URL = "http://localhost:5000"   # cambia a tu dominio en producción
ADMIN_KEY  = "CAMBIA_ESTA_CLAVE_ADMIN"  # igual que en server.py

HEADERS = {"X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json"}

def ok(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def cmd_crear_permanente(note=""):
    r = requests.post(f"{SERVER_URL}/admin/create",
                      headers=HEADERS,
                      json={"type": "permanent", "note": note})
    ok(r.json())

def cmd_crear_token(hours=6, note=""):
    hours = min(int(hours), 6)
    r = requests.post(f"{SERVER_URL}/admin/create",
                      headers=HEADERS,
                      json={"type": "token", "hours": hours, "note": note})
    ok(r.json())

def cmd_listar():
    r = requests.get(f"{SERVER_URL}/admin/list", headers=HEADERS)
    rows = r.json()
    print(f"{'KEY':<28} {'TIPO':<10} {'ACTIVA':<7} {'EXPIRA':<22} {'NOTA'}")
    print("-" * 85)
    for row in rows:
        exp  = (row.get("expires_at") or "—")[:19]
        act  = "✓" if row["active"] else "✗"
        print(f"{row['key']:<28} {row['type']:<10} {act:<7} {exp:<22} {row.get('note','')}")

def cmd_revocar(key):
    r = requests.post(f"{SERVER_URL}/admin/revoke",
                      headers=HEADERS, json={"key": key})
    ok(r.json())

def cmd_reset_hwid(key):
    r = requests.post(f"{SERVER_URL}/admin/reset-hwid",
                      headers=HEADERS, json={"key": key})
    ok(r.json())

def cmd_stats():
    r = requests.get(f"{SERVER_URL}/admin/stats", headers=HEADERS)
    ok(r.json())

CMDS = {
    "permanente":  ("Crear licencia permanente",       cmd_crear_permanente),
    "token":       ("Crear token temporal (máx 6h)",   cmd_crear_token),
    "listar":      ("Listar todas las licencias",       cmd_listar),
    "revocar":     ("Revocar licencia   [KEY]",         cmd_revocar),
    "reset-hwid":  ("Resetear HWID      [KEY]",         cmd_reset_hwid),
    "stats":       ("Ver estadísticas",                 cmd_stats),
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in CMDS:
        print("\n  Roblox Fast Join — Admin CLI")
        print("  " + "─" * 38)
        for cmd, (desc, _) in CMDS.items():
            print(f"  python admin_cli.py {cmd:<14} — {desc}")
        print()
        sys.exit(0)

    cmd  = sys.argv[1]
    args = sys.argv[2:]
    CMDS[cmd][1](*args)
