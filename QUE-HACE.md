# Qué es el Developer Command Center y en qué te ayuda

Este documento responde tres preguntas: **qué problema resuelve**, **qué puede
monitorear exactamente**, y **qué ganas usándolo**.

Está escrito distinguiendo con claridad entre lo que la plataforma hace **hoy**
y lo que está planificado para más adelante, porque una herramienta de
monitoreo en la que no puedes confiar es peor que no tener ninguna.

---

## 1. El problema que resuelve

Cuando tienes varios proyectos en marcha, la información de "¿está todo bien?"
vive repartida:

- El estado de tus APIs → entrando a cada una, o esperando a que alguien se queje.
- El uso de CPU y disco del servidor → por SSH.
- Los últimos despliegues → en GitHub Actions o en el panel del hosting.
- Si Docker sigue en pie → por SSH otra vez.
- Tus bloques de trabajo y reuniones → en otra app distinta.

El resultado práctico es que **te enteras tarde**. Y cuando estás fuera de casa,
con el móvil, la respuesta a "¿se cayó algo?" cuesta cinco minutos y varias
aplicaciones.

El DCC junta todo eso en **una sola pantalla, accesible desde cualquier lugar
por Internet**, diseñada para entenderse en tres segundos: verde, ámbar o rojo.

---

## 2. Qué puede monitorear

### 2.1 Cualquier servicio con una URL de salud — el núcleo

Este es el corazón de la plataforma. Registras un servicio con una URL y el
sistema la consulta **cada 30 segundos** (configurable), guardando cada
resultado.

Funciona con cualquier cosa que responda por HTTP:

- Tus APIs (propias o de terceros)
- Tus webs y frontends
- Un endpoint `/health` de tu backend
- Servicios externos de los que dependes (una pasarela de pago, un proveedor)

De cada servicio verás:

| Dato | Ejemplo |
|---|---|
| **Estado** | ONLINE · WARNING · OFFLINE · UNKNOWN |
| **Latencia** | 128 ms |
| **Uptime** | 99,98 % (porcentaje móvil sobre los últimos 200 chequeos) |
| **Último chequeo** | hace 12 segundos |
| **Ambiente** | PRODUCTION · STAGING · DEVELOPMENT |
| **Versión** | v2.4.18 |

La distinción entre WARNING y OFFLINE importa: un servicio que responde pero
**lento** aparece en ámbar antes de caerse. Es la diferencia entre enterarte
antes o después de que tus usuarios lo noten.

Cada chequeo se guarda en el historial, así que no solo ves el estado actual
sino la tendencia. El uptime se recalcula en cada ciclo sobre los últimos 200
chequeos: tras una caída sube poco a poco al recuperarse, en vez de volver de
golpe al 100 % y borrar la evidencia del incidente.

### 2.2 El servidor donde corre el DCC

CPU, RAM, disco, carga del sistema y uptime **de la máquina donde está instalado
el propio DCC**.

> ⚠️ **Aclaración importante:** estas métricas son de la máquina que ejecuta el
> DCC, no de tus otros servidores. Para vigilar otro servidor, lo que se
> monitorea hoy es su endpoint HTTP, no sus recursos internos. Ver §4.

Cada barra de CPU/RAM/Disco lleva debajo una minigráfica con la tendencia de
los últimos 30 minutos, para distinguir "acaba de subir" de "así ha estado
todo el rato" sin tener que ir a mirar logs.

### 2.3 La base de datos PostgreSQL

Conexiones abiertas, tamaño ocupado, latencia y versión. Sin exponer jamás
credenciales ni cadenas de conexión.

### 2.4 Contenedores Docker

Si el DCC corre en una máquina con acceso al socket de Docker, lista los
contenedores con su estado y tiempo en marcha.

> En Render **esta sección aparecerá vacía**, porque un servicio gestionado no
> da acceso al demonio Docker del host. Es útil si instalas el DCC en tu propio
> servidor o NAS.

### 2.5 Sí mismo

El DCC se vigila a sí mismo: su API, su base de datos y su motor de monitoreo
aparecen como un panel más. Si el vigilante falla, lo ves.

### 2.6 Alertas automáticas

Un motor de reglas evalúa continuamente y genera alertas con cuatro niveles
(INFO · WARNING · ERROR · CRITICAL):

| Regla | Se dispara cuando |
|---|---|
| Servicio caído | Un servicio pasa a OFFLINE → **CRÍTICA** |
| Latencia alta | La respuesta supera 2000 ms → aviso |
| CPU alta | Uso por encima del 85 % → aviso |
| Memoria alta | Uso por encima del 90 % → aviso |
| Disco lleno | Ocupación por encima del 85 % → aviso |

Puedes **reconocerlas** (para que dejen de reclamar tu atención mientras las
investigas) o **resolverlas**.

Detalle que marca la diferencia: las alertas se **deduplican**. Si tu API lleva
media hora caída, verás *una* alerta con un contador "×60", no sesenta alertas
idénticas tapando todo lo demás. (Comprobado con una caída real: diez ciclos
fallidos produjeron una única alerta crítica con contador ×10.)

### 2.7 Productividad

- **Pomodoro (Focus):** temporizador de 25/5/15 minutos. El estado vive en el
  servidor, así que puedes empezar una sesión en el ordenador y ver el tiempo
  restante en el móvil. Sobrevive a reinicios.
- **Calendario:** los eventos del día en la misma pantalla que tu
  infraestructura.

### 2.8 Repositorios de GitHub

Con un token configurado: últimos commits, pull requests e issues abiertos.
Sin token, esa sección muestra datos de ejemplo y el resto funciona igual.

---

## 3. Los beneficios concretos

### Te enteras antes, no cuando te avisa un usuario
Chequeos cada 30 segundos frente a "me lo dijo un cliente". Y el estado ámbar
te avisa de la degradación **antes** de la caída.

### Una pantalla en lugar de siete pestañas
Servicios, sistema, proyectos, despliegues, alertas, foco y agenda en la misma
vista. La información importante se entiende sin leer, por color y posición.

### Funciona desde cualquier sitio
Es una plataforma web con HTTPS y autenticación, no una app de escritorio atada
a tu red local. Desde el móvil en la calle ves exactamente lo mismo que en casa.
Y se instala como app (PWA) en Android, iPhone o escritorio.

### Modo pantalla siempre encendida
La vista `/command-center` está pensada para dejarla puesta en un monitor
secundario, una tablet o un Echo Show: sin menús, letra grande y
autoactualizándose. Un vistazo desde el otro lado de la habitación basta.

### Historial, no solo el instante actual
Cada chequeo y cada métrica se guardan. Eso permite responder "¿esto ya pasaba
la semana pasada?" en vez de adivinar.

### Es tuyo, sin cuotas por servicio
Los servicios de monitoreo comerciales cobran por endpoint vigilado o por
usuario. Aquí pagas el hosting (unos 13 USD/mes) y monitoreas lo que quieras,
con los datos en tu propia base de datos.

### Construido para crecer
La arquitectura está preparada para las siguientes fases —notificaciones push,
Telegram, Alexa, integración con GitHub Actions— sin tener que rehacerlo. No
están implementadas, pero el sitio donde encajan ya existe.

### No expone tus secretos
Contraseñas, tokens y cadenas de conexión nunca llegan al navegador. La consola
está pensada desde el primer día como una aplicación expuesta a Internet:
sesiones en servidor, protección contra fuerza bruta, límite de peticiones,
CSRF y cabeceras de seguridad. Los detalles están en
[SECURITY.md](./SECURITY.md).

---

## 4. Qué NO hace todavía (léelo antes de decidir)

Prefiero que lo sepas ahora y no después de desplegarlo:

| Limitación de hoy | Qué significa en la práctica |
|---|---|
| **No mide recursos de servidores remotos** | De otro servidor ves si su URL responde y con qué latencia, no su CPU ni su disco. Para eso hace falta un agente, que es fase posterior |
| **Las notificaciones no salen de la pantalla** | Las alertas se ven en el dashboard; todavía no llegan por push, email, Telegram ni Discord. Tienes que mirar |
| **Los despliegues no se registran solos** | La sección existe y muestra datos, pero aún no hay webhook que los reciba desde GitHub Actions |
| **Docker solo en local** | Requiere acceso al socket; en hosting gestionado no aplica |
| **El calendario no sincroniza** | Google/Outlook/Apple están planificados, no conectados |
| **Sin 2FA ni recuperación de contraseña** | La estructura está lista; la implementación es de fase 2 |

Todo esto está calendarizado en [ROADMAP.md](./ROADMAP.md).

---

## 5. Cómo registrar tus servicios y proyectos hoy

Desde **Infrastructure → Add service**: nombre, URL de salud, tipo, ambiente y
—opcionalmente— proyecto. Al guardar, el servidor ejecuta un chequeo inmediato
contra esa URL, así que aparece con su estado real (ONLINE/OFFLINE) desde el
primer segundo, no como "UNKNOWN" hasta el próximo ciclo.

Desde la misma tabla, por fila:

- **Check now** — fuerza un chequeo inmediato, sin esperar los 30 segundos.
- **Pause/Resume** — deja de consultarlo sin borrar su historial.
- **Edit** — cambia nombre, tipo, ambiente, proyecto o descripción. La URL de
  salud, por seguridad, nunca viaja al navegador (puede contener un hostname
  interno — ver [SECURITY.md](./SECURITY.md)), así que ese campo aparece vacío;
  déjalo así para conservar la URL actual, o escribe una nueva para
  reapuntarlo (se vuelve a chequear al instante).
- **Remove** (solo ADMIN/OPERATOR, pide confirmación) — lo elimina junto con
  todo su historial de chequeos. Los servicios de demostración del modo mock no
  se pueden eliminar ni editar, para que el modo de prueba siga teniendo datos
  con los que jugar.

Los proyectos se gestionan igual, desde **Projects → Add project**: nombre,
repositorio, ambiente, estado y versión, todos opcionales salvo el nombre.
Cada tarjeta tiene sus propios botones **Edit** y **Remove** (Remove también
solo para ADMIN/OPERATOR). Eliminar un proyecto no borra sus servicios: se
quedan, solo pierden la asociación ("sin proyecto"). Los proyectos de
demostración tampoco se pueden editar ni eliminar.

Si prefieres scriptear el alta (por ejemplo, para dar de alta varios servicios
a la vez), la API acepta lo mismo por HTTP:

```bash
curl -s -b cookies.txt -X POST https://tu-servicio.onrender.com/api/services \
  -H "content-type: application/json" -H "x-dcc-csrf: $CSRF" \
  -d '{"name":"Mi API","healthUrl":"https://api.ejemplo.com/health"}'
```

Consulta [API.md](./API.md) para el resto de campos y las reglas de
validación.

---

## 6. ¿Es esta herramienta para ti?

### Encaja bien si...

- Tienes varios proyectos o servicios propios y quieres verlos juntos.
- Quieres consultar el estado desde el móvil estando fuera.
- Te gusta la idea de un panel siempre encendido en un monitor o Echo Show.
- Prefieres una herramienta propia, con tus datos, a una suscripción por servicio.
- Vas a seguir desarrollándola: la base está pensada para crecer.

### No encaja (todavía) si...

- Necesitas que te **avise** por móvil o email sin mirar la pantalla → fase 5.
- Necesitas métricas de CPU/RAM de servidores remotos → fase 2.
- Necesitas monitoreo desde varias regiones o SLA garantizado → usa un servicio
  comercial como Datadog o Better Stack.
- Vas a monitorear infraestructura crítica de una empresa → esto es un centro de
  mando personal, no un sistema con guardias 24/7.

---

## 7. En una frase

**Un centro de operaciones personal que responde "¿está todo bien?" de un
vistazo, desde cualquier dispositivo, y que crece contigo hasta convertirse en
tu plataforma de DevOps y productividad.**

---

## Documentos relacionados

- [README.md](./README.md) — qué incluye y cómo ejecutarlo
- [RENDER-GUIA.md](./RENDER-GUIA.md) — desplegarlo en Internet paso a paso, con presupuesto
- [ROADMAP.md](./ROADMAP.md) — las nueve fases previstas
- [SECURITY.md](./SECURITY.md) — controles de seguridad y limitaciones conocidas
- [ARCHITECTURE.md](./ARCHITECTURE.md) — cómo está construido y por qué
