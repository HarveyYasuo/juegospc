# Roblox Fast Join — Sistema de Licencias v1.0

## Archivos del proyecto

```
app.py          ← Cliente (distribuyes esto a tus compradores)
server.py       ← Servidor de licencias (lo hosteas en tu VPS)
admin_cli.py    ← Herramienta para generar/gestionar licencias
```

---

## 1. Configurar el servidor

### Instalar dependencias
```bash
pip install flask cryptography
```

### Configurar claves secretas (OBLIGATORIO antes de producción)
Edita `server.py` o exporta variables de entorno:
```bash
export SECRET_KEY="una_clave_larga_y_aleatoria_aqui"
export ADMIN_KEY="otra_clave_solo_para_ti"
```

### Iniciar (desarrollo)
```bash
python server.py
```

### Iniciar (producción con Gunicorn)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 server:app
```

### Recomendado: usar Nginx como proxy inverso
Apunta tu dominio al puerto 5000 con SSL (certbot gratis).

---

## 2. Configurar el cliente

En `app.py`, cambia esta línea con tu dominio real:
```python
LICENSE_SERVER = "https://tu-dominio.com"
```

---

## 3. Generar licencias

### Con el CLI (más cómodo)

```bash
# Ver comandos disponibles
python admin_cli.py

# Licencia permanente (pago único)
python admin_cli.py permanente "Nombre del cliente"

# Token de 6 horas (acceso temporal)
python admin_cli.py token 6 "Trial usuario X"

# Token de 2 horas
python admin_cli.py token 2 "Prueba gratis"

# Ver todas las licencias
python admin_cli.py listar

# Revocar una licencia
python admin_cli.py revocar RFJ-XXXX-XXXX-XXXX-XXXX

# Resetear HWID (el usuario cambió de PC)
python admin_cli.py reset-hwid RFJ-XXXX-XXXX-XXXX-XXXX

# Estadísticas
python admin_cli.py stats
```

### Con curl (desde cualquier terminal)
```bash
# Crear permanente
curl -X POST http://localhost:5000/admin/create \
  -H "X-Admin-Key: TU_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "permanent", "note": "cliente1"}'

# Crear token 6h
curl -X POST http://localhost:5000/admin/create \
  -H "X-Admin-Key: TU_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "token", "hours": 6, "note": "trial"}'
```

---

## 4. Flujo de un comprador

```
1. El comprador paga (Binance Pay, PayPal, etc.)
2. Tú ejecutas:  python admin_cli.py permanente "nombre"
3. Te imprime la clave:  RFJ-A1B2-C3D4-E5F6-G7H8
4. Envías la clave al comprador por DM/Discord/etc.
5. El comprador la introduce en la app → queda activada
6. La clave queda vinculada a su PC (HWID)
```

---

## 5. Tipos de licencia

| Tipo        | Duración    | Uso recomendado         |
|-------------|-------------|-------------------------|
| `permanent` | Indefinida  | Pago único              |
| `token`     | Hasta 6h    | Trial / acceso temporal |

### Comportamiento offline
- **Permanente**: si no hay internet, la app arranca igual con la clave guardada local.
- **Token**: requiere conexión al servidor para validar; si no hay conexión y el token local no ha expirado, deja pasar igualmente.

---

## 6. Seguridad

- El HWID del usuario se guarda **hasheado** (SHA-256), nunca en texto plano.
- Cada clave queda vinculada al primer PC que la activa.
- Para transferir licencia a otro PC: `python admin_cli.py reset-hwid [KEY]`
- Cambia `SECRET_KEY` y `ADMIN_KEY` antes de subir a producción.
- Nunca compartas ni expongas `ADMIN_KEY` públicamente.

---

## 7. Hosting recomendado (barato)

| Proveedor        | Precio aprox. | Notas                        |
|------------------|---------------|------------------------------|
| Railway.app      | Gratis / $5   | Muy fácil, deploy con GitHub |
| Render.com       | Gratis / $7   | Sleep en plan gratis         |
| Hetzner VPS      | €4/mes        | El más barato con IPv4 fija  |
| Oracle Cloud     | Gratis        | Always Free tier (ARM)       |
