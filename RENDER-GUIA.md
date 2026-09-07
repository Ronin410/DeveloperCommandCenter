# Guía completa: levantar el DCC en Render

Todo lo necesario para poner el Developer Command Center en Internet: qué
herramientas hacen falta, los pasos exactos, y cuánto cuesta.

> Los precios son **orientativos** (consultados a la fecha de este documento) y
> Render los cambia sin avisar. Confirma siempre en
> [render.com/pricing](https://render.com/pricing) antes de contratar.

---

## 1. Qué necesitas

### Herramientas externas obligatorias

| Herramienta | Para qué | Coste |
|---|---|---|
| **Cuenta de GitHub** | Render despliega leyendo el repositorio | Gratis |
| **Cuenta de Render** | Hosting de la aplicación y la base de datos | Gratis para empezar |
| **Un navegador** | Todo el proceso se hace desde el panel de Render | — |

Eso es literalmente todo lo obligatorio. **No necesitas** tarjeta de crédito para
el plan gratuito.

### Herramientas locales (solo si vas a tocar el código)

| Herramienta | Versión | Por qué |
|---|---|---|
| **Node.js** | **22.12 o superior** | La app corre con 20.9+, pero los tests (Vitest 5 / Vite 8) exigen 22.12+. El repo trae un `.nvmrc`, así que basta `nvm use` |
| **Git** | cualquiera | Clonar y subir cambios |
| **psql** *(opcional)* | 16 | Solo si quieres inspeccionar la base de datos a mano |

Si únicamente quieres desplegar y usarlo, **no necesitas instalar nada en tu
máquina**: el despliegue ocurre entero en el panel de Render.

### Herramientas externas opcionales

| Herramienta | Para qué | Coste aproximado |
|---|---|---|
| **Dominio propio** (`dcc.tudominio.com`) | URL bonita en vez de `*.onrender.com` | 10–15 USD/año |
| **Token de GitHub** | Que la sección *Git* muestre tus repos reales en vez de datos simulados | Gratis |
| **Cloudflare** | DNS y protección delante del dominio | Gratis |

### Lo que ya viene resuelto dentro del repositorio

No tienes que configurar nada de esto, pero conviene que sepas que existe:

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Blueprint de Render** | `render.yaml` | Crea el servicio web *y* la base de datos, y cablea las variables |
| **Migraciones** | `prisma/migrations/` | El esquema completo (15 tablas), versionado |
| **Arranque automático** | `src/instrumentation.ts` | Migra, crea tu usuario admin, autorregistra el servicio y arranca el motor de monitoreo |
| **Health check** | `/api/health` | Render lo usa para saber si el deploy fue bien |
| **Versión de Node** | `.nvmrc` | Render la lee sola |

### Lo que NO necesitas

Para que quede claro, porque suele generar dudas:

- ❌ **Docker** — Render construye la app directamente con Node.
- ❌ **Redis** — está previsto para fases futuras; el MVP no lo usa.
- ❌ **Ejecutar migraciones a mano** — se aplican solas en cada arranque.
- ❌ **Ejecutar un script de seed** — tu usuario admin se crea solo.
- ❌ **Configurar HTTPS o certificados** — Render los da hechos.
- ❌ **Un servidor propio, VPS o Nginx.**

---

## 2. Pasos para desplegar

### Paso 0 — Preparar la rama

El blueprint apunta a la rama `main`. El código está en
`claude/desarrollo-proyecto-crnplt`, así que elige una opción:

**Opción A — fusionar a `main`** (recomendada):

```bash
git checkout main
git merge claude/desarrollo-proyecto-crnplt
git push origin main
```

**Opción B — desplegar directamente esa rama**: edita `render.yaml` y cambia
`branch: main` por `branch: claude/desarrollo-proyecto-crnplt`, luego súbelo.

### Paso 1 — Crear el stack en Render

1. Entra en [dashboard.render.com](https://dashboard.render.com).
2. Conecta tu cuenta de GitHub si es la primera vez (**Account Settings →
   GitHub**) y dale acceso al repositorio `DeveloperCommandCenter`.
3. Pulsa **New → Blueprint**.
4. Selecciona el repositorio. Render detectará `render.yaml` automáticamente.
5. Verás que va a crear dos recursos:
   - `dcc` → el servicio web
   - `dcc-postgres` → la base de datos PostgreSQL

### Paso 2 — Rellenar las tres variables que te pide

Render te pedirá solo estas (las demás las resuelve solo):

| Variable | Qué poner |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | Tu email. Será tu usuario para entrar |
| `BOOTSTRAP_ADMIN_PASSWORD` | **Mínimo 12 caracteres.** Usa una contraseña larga y única: esta consola queda expuesta a Internet |
| `GITHUB_TOKEN` | Déjalo **vacío**. Sin él, la sección Git muestra datos simulados y todo lo demás funciona igual |

> ⚠️ Guarda esa contraseña en tu gestor de contraseñas **antes** de continuar.
> Por seguridad, el sistema nunca sobrescribe una cuenta que ya existe: si luego
> cambias la variable, **no** se resetea nada. (Es deliberado — si lo hiciera,
> cualquiera con acceso a tu panel de Render podría apoderarse de la consola.)

### Paso 3 — Apply y esperar

Pulsa **Apply**. El primer despliegue tarda entre 3 y 8 minutos.

En **Logs** deberías ver, en este orden:

```
1 migration found in prisma/migrations
Applying migration `20260907194436_init`
All migrations have been successfully applied.
✓ Ready in 122ms
{"msg":"Bootstrap administrator created","email":"tu@email.com"}
{"msg":"Bootstrap catalogue created","project":"developer-command-center"}
{"msg":"Monitoring engine started","intervalSeconds":30}
```

Esas cinco líneas confirman que todo salió bien: base de datos creada, tu
usuario creado, el DCC registrado como servicio a monitorear y el motor
funcionando.

### Paso 4 — Entrar

Abre la URL que te da Render (`https://dcc-xxxx.onrender.com`) e inicia sesión
con el email y la contraseña del paso 2.

Deberías ver el dashboard con:
- **Services** → *DCC API* en verde (se está monitoreando a sí mismo)
- **System** → CPU, RAM y disco reales del contenedor
- **Command Center** → el estado interno de la plataforma

Los paneles de Projects y Deployments estarán casi vacíos: es correcto, todavía
no has registrado tus propios proyectos.

### Paso 5 — Verificar (opcional)

```bash
# Debe responder ok
curl https://tu-servicio.onrender.com/api/health

# Debe responder 401 (la API está protegida)
curl -o /dev/null -w '%{http_code}\n' https://tu-servicio.onrender.com/api/overview
```

### Paso 6 — Instalarlo en el móvil (opcional)

Abre la URL en el móvil → menú del navegador → **Añadir a pantalla de inicio**.
Queda como una app nativa. En el Echo Show, abre
`https://tu-servicio.onrender.com/command-center` en el navegador Silk.

---

## 3. Variables de entorno: quién pone qué

| Variable | Quién la pone | Valor |
|---|---|---|
| `NODE_ENV` | El blueprint | `production` |
| `MOCK_MODE` | El blueprint | `false` (datos reales) |
| `AUTH_SECRET` | **Render, generado** | Aleatorio, nunca se muestra en el repo |
| `DATABASE_URL` | **Render, automático** | Cableado a `dcc-postgres` |
| `APP_URL` | **Nadie** | Se deduce sola de `RENDER_EXTERNAL_URL` |
| `MONITORING_INTERVAL_SECONDS` | El blueprint | `30` |
| `NEXT_PUBLIC_POLL_INTERVAL_SECONDS` | El blueprint | `30` |
| `BOOTSTRAP_ADMIN_EMAIL` | **Tú** | Tu email |
| `BOOTSTRAP_ADMIN_PASSWORD` | **Tú** | 12+ caracteres |
| `GITHUB_TOKEN` | Tú (opcional) | Vacío está bien |

---

## 4. Dominio propio (opcional)

1. En Render: servicio `dcc` → **Settings → Custom Domains → Add**.
2. Añade en tu proveedor de DNS el registro `CNAME` que Render te indique.
3. **Importante:** añade la variable `APP_URL` con la URL nueva completa
   (`https://dcc.tudominio.com`).

Ese último paso no es opcional: `APP_URL` controla la cookie segura y la
verificación de origen. Si no coincide con lo que ve el navegador, **todos los
POST devuelven 403** y el login parece roto sin explicación.

---

## 5. Presupuesto

### Escenario A — Probarlo gratis · **0 USD/mes**

| Recurso | Plan | Coste |
|---|---|---|
| Servicio web | Free | 0 |
| PostgreSQL | Free | 0 |
| **Total** | | **0 USD/mes** |

Qué sacrificas:

| Limitación | Consecuencia real |
|---|---|
| La base de datos gratuita **se elimina a los 30 días** | Pierdes todos los datos |
| La instancia se duerme sin tráfico | La primera visita tarda ~30 s en despertar |
| 512 MB de RAM compartida | Suficiente para un usuario; los builds son lentos |

**Sirve para:** probarlo, enseñárselo a alguien, decidir si te gusta.
**No sirve para:** que realmente vigile tu infraestructura.

> Detalle: como el DCC se monitorea a sí mismo cada 30 segundos, ese tráfico
> evita que la instancia llegue a dormirse. Ayuda, pero **no salva la base de
> datos del borrado a los 30 días**.

### Escenario B — Uso personal real · **~13 USD/mes**

Es la configuración que recomiendo si vas a depender de él.

| Recurso | Plan | Coste aprox. |
|---|---|---|
| Servicio web | Starter | ~7 USD/mes |
| PostgreSQL | Basic (256 MB) | ~6 USD/mes |
| **Total** | | **~13 USD/mes** (~156 USD/año) |

Qué ganas: la instancia **nunca se duerme** (monitoreo 24/7 de verdad), los datos
**persisten**, y despliegues más rápidos.

Cómo cambiar de plan: servicio `dcc` → **Settings → Instance Type → Starter**.
Base de datos → **Settings → Plan**. En `render.yaml` cambia también
`plan: free` por `plan: starter` para que quede registrado en el repo.

### Escenario C — Con dominio propio · **~14 USD/mes**

| Recurso | Coste aprox. |
|---|---|
| Escenario B | ~13 USD/mes |
| Dominio `.com` | ~12 USD/año (~1 USD/mes) |
| Certificado HTTPS | **0** (Render lo incluye) |
| **Total** | **~14 USD/mes** |

### Escenario D — Si crece (varios usuarios, mucho histórico)

| Recurso | Plan | Coste aprox. |
|---|---|---|
| Servicio web | Standard (2 GB RAM) | ~25 USD/mes |
| PostgreSQL | Pro | desde ~20 USD/mes |
| **Total** | | **~45 USD/mes o más** |

Solo tiene sentido si monitoreas decenas de servicios con historial largo. Para
un centro de mando personal, el escenario B sobra.

### Costes que **no** tienes

- Certificado SSL → incluido.
- Ancho de banda → el tráfico de un dashboard personal no llega ni de lejos a
  los límites incluidos.
- Docker Hub, CI/CD, monitorización externa → GitHub Actions gratis cubre el CI,
  y el repo ya trae el workflow configurado.

### Resumen

| Si quieres... | Presupuesto |
|---|---|
| Probarlo un mes | **0 USD** |
| Que funcione de verdad, siempre encendido | **~13 USD/mes** |
| Lo anterior con dominio propio | **~14 USD/mes** |

---

## 6. Después del despliegue

### Actualizar la aplicación

`autoDeploy` está activado: cada `git push` a la rama configurada despliega solo.
Las migraciones nuevas se aplican en el arranque, sin intervención.

### Copias de seguridad

En plan gratuito **no hay backups**. En planes de pago Render hace backups
diarios automáticos. Manualmente, con la *External Connection String*:

```bash
pg_dump "postgresql://…@…render.com/dcc" | gzip > dcc-$(date +%F).sql.gz
```

### Vigilar el vigilante

Apunta un servicio externo de uptime (UptimeRobot tiene plan gratuito) a
`https://tu-servicio.onrender.com/api/health`. Si el DCC se cae, algo tiene que
avisarte.

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| El deploy falla con `Cannot find module '@tailwindcss/postcss'` (o `typescript`, o cualquier otra herramienta) | Render aplica `NODE_ENV=production` durante el propio build, y npm omite las devDependencies cuando esa variable está presente — incluso con `npm ci`. El blueprint ya usa `npm ci --include=dev` para evitarlo | Si usaste un build command personalizado, cámbialo para incluir `--include=dev` |
| El deploy falla con "cannot have more than one active free tier database" | Render solo permite una base de datos PostgreSQL gratuita por cuenta, y ya tienes otra activa en otro proyecto | Borra o sube de plan la otra base de datos, o cambia el `plan` de `dcc-postgres` en `render.yaml` a uno de pago |
| El deploy falla en el health check | La base de datos no estaba lista al arrancar | Revisa que `dcc-postgres` esté activa y espera; Render reintenta |
| No puedo entrar en un despliegue nuevo | `BOOTSTRAP_ADMIN_*` no estaban puestas al primer arranque | Ponlas y reinicia el servicio: la cuenta se crea al arrancar |
| Cambié `BOOTSTRAP_ADMIN_PASSWORD` y no funciona | Es intencional: nunca modifica cuentas existentes | Usa tu contraseña original, o borra la fila de `User` para re-bootstrapear |
| Todos los POST dan 403 | `APP_URL` no coincide con la URL del navegador | Ponla exacta, o quítala para que use la de Render |
| El dashboard muestra servicios inventados | `MOCK_MODE` sigue en `true` | Ponlo en `false` |
| La primera visita tarda 30 segundos | La instancia gratuita estaba dormida | Sube a Starter |
| Error "The database schema has not been initialised" | El start command no es el correcto | Debe ser `npm run start:migrate` |

---

## 8. Si prefieres no usar base de datos todavía

Puedes desplegar en modo demostración, sin PostgreSQL:

1. En el servicio `dcc`, pon `MOCK_MODE=true`.
2. Añade `MOCK_ADMIN_PASSWORD` con una contraseña tuya.
3. Elimina la variable `DATABASE_URL`.

Verás el dashboard completo con infraestructura simulada, entrando con
`admin@dcc.local` y esa contraseña. **Nada se guarda** y cada reinicio lo
resetea: es una demo, no una instalación.

---

## Referencias

- [`QUE-HACE.md`](./QUE-HACE.md) — qué monitorea la plataforma y en qué te ayuda
- [`render.yaml`](./render.yaml) — el blueprint, con comentarios
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — despliegue en general, incluido servidor propio
- [`SECURITY.md`](./SECURITY.md) — controles de seguridad y limitaciones conocidas
- [`README.md`](./README.md) — qué es el proyecto y cómo correrlo en local
