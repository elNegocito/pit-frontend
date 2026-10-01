# Trabajar y probar en local

Esta guía explica cómo correr la app **completa en tu máquina** (Next.js + una base de datos Supabase local en Docker) para probar la rama `feature/printable-tickets` sin tocar producción ni Vercel.

> **Regla de oro:** en local la app apunta a la BD local (`127.0.0.1:54321`). Nunca pongas las llaves de producción en `.env.local` mientras pruebas esta rama: la migración nueva todavía no está en producción.

---

## 0. Qué trae esta rama

| Funcionalidad | Dónde |
|---|---|
| Formulario a la izquierda y **ticket en vivo** a la derecha | `/entry` |
| **Número de ticket automático** (5+ dígitos, sigue después del mayor que ya existe) | BD: secuencia `ticket_number_seq` |
| **Imprimir**: 3 copias en una hoja Letter con perforaciones (3⅔" y 7⅓") | Botón *Save & Print* / *Print* en cada fila |
| **Trucks** con su GROSS → el ticket muestra Gross / Tare / Net (Tare = Gross − Net) | `/trucks` (admin) |
| **Orders** (proyectos): 1 order por customer, sale sola en el ticket | `/job-orders` (admin) |
| PO # y Job # opcionales | `/entry` |
| Loads today por **customer** y por **truck** | En el ticket |
| La operadora puede **Editar** y **Void** tickets **de hoy** | Botones en *Today's tickets* |
| El admin ve **Modified / VOID**, el **historial** de cambios y un aviso con los cambios del día. Solo el admin puede **Delete** | `/dashboard` |

Los tickets que no son de un truck registrado salen solo con **Net**; los customers sin order salen sin *Order*. Todo lo anterior (precios, COD/ACCOUNT, ledger, exportes) sigue igual. Los tickets VOID no suman en totales.

---

## 1. Requisitos (una sola vez)

- **Docker** corriendo (`docker ps` debe responder).
- **pnpm** (`corepack enable` o `npm i -g pnpm`).
- Dependencias: `pnpm install`

El CLI de Supabase ya viene como dependencia del proyecto (`pnpm supabase ...`).

## 2. Levantar la base de datos local

```bash
pnpm supabase start
```

La primera vez descarga las imágenes de Docker (tarda varios minutos). Al terminar imprime algo así:

```
API URL: http://127.0.0.1:54321
Studio URL: http://127.0.0.1:54323
anon key / Publishable key: eyJhbGciOi... (o sb_publishable_...)
```

Si se te pierde: `pnpm supabase status`.

## 3. Variables de entorno locales

Crea `.env.local` en la raíz (está en `.gitignore`):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key / publishable key que imprimió supabase start>
```

> Si ya tenías un `.env.local` con las llaves de producción, guárdalo aparte (por ejemplo `cp .env.local .env.prod.backup`) antes de cambiarlo.

## 4. Crear el esquema y los datos de prueba

```bash
# Borra la BD local y aplica TODAS las migraciones (001 → 006) + seed.sql
pnpm supabase db reset

# Usuarios de prueba, roles, nombres de weighmaster, trucks, customers y orders de ejemplo
docker exec -i supabase_db_pit-frontend psql -U postgres -d postgres < supabase/dev/local-dev.sql
```

Esto crea:

| Usuario | Contraseña | Rol | Weighmaster |
|---|---|---|---|
| `admin@asgoperations.com` | `password123` | admin | DANIEL |
| `operator@asgoperations.com` | `password123` | operator | IVONNE |

Y además: truck **222** con gross **40 t**, truck **1100** con gross **41.79 t**, customer **0911-HOLCIM** con order **11-911-AMRIZE-OPEN**, customer **EGW Services** sin order. La numeración automática arranca en **46285** (simula los tickets que ya hay en producción).

Cada vez que quieras empezar de cero, repite los dos comandos de este paso.

## 5. Correr la app

```bash
pnpm dev
```

Abre http://localhost:3000 e inicia sesión.

Para ver la BD por dentro: **Studio** en http://127.0.0.1:54323 (tablas `orders`, `trucks`, `job_orders`, `ticket_events`).

---

## 6. Qué probar (checklist)

### Como operadora (`operator@asgoperations.com`)

1. **Ticket en vivo**: en `/entry`, escribe Truck `222`, Tons `25`, Customer `0911-HOLCIM`, elige un material.
   - A la derecha el ticket se va llenando: Order `11-911-AMRIZE-OPEN`, **Gross 40.00 / Tare 15.00 / Net 25.00** (y libras), Weighmaster `IVONNE`, Ticket # `Auto`.
2. **Save & Print**: guarda y abre el diálogo de impresión con **3 copias** del ticket. Debe tener número **46285** y *Loads today* customer = 1, truck = 1.
3. Guarda otro con el mismo truck → número 46286 y *Loads today* = 2.
4. Truck no registrado (ej. `999`) con customer `EGW Services` → el ticket sale solo con **Net** y sin Order.
5. Escribe tons mayores que el gross del truck (ej. 222 con 45 t) → aviso de que la tara quedaría negativa.
6. **Editar**: en *Today's tickets* pulsa **Edit** en un ticket, cambia el customer y pulsa **Update**. La fila muestra **Edited**, el número del ticket no cambia.
7. **Void**: pulsa **Void** → confirma → la fila sale tachada con **VOID** y no cuenta en las toneladas.
8. **Print** en una fila → reimprime ese ticket (si está anulado, sale con el sello VOID).

### Como admin (`admin@asgoperations.com`)

1. `/dashboard`: arriba aparece el aviso amarillo con los cambios de hoy ("Ticket 46285 edited — Customer: 0911-HOLCIM → EGW Services").
2. En la tabla: columna **Status** con **Modified** / **VOID**; botón **History** muestra qué cambió (antes → después).
3. Filtro **Status** → *Modified by operator* / *Void*. Los totales (Loads, Tons, Gross) **no** incluyen los VOID.
4. **Delete** en una fila → confirmación → se borra definitivamente.
5. `/trucks`: agrega un truck con su gross; `/job-orders`: agrega una order y asígnala a un customer (un customer solo puede tener una).
6. Export CSV / PDF: incluyen Status, Order, Truck gross y Tare.

### Reglas que deben rechazarse

- La operadora no puede editar ni anular tickets de **otro día** (se bloquea en la BD con RLS).
- Un ticket VOID no se puede editar.
- La operadora no ve el botón Delete ni puede borrar.

---

## 7. Configuración de impresión

En el diálogo de impresión de Chrome/Edge:

- **Paper size:** Letter
- **Margins:** None
- **Scale:** 100 % (Default)
- **Headers and footers:** desactivado
- **Background graphics:** activado (para el sello VOID)

Para revisar las medidas sin gastar papel: *Destination → Save as PDF*. Cada ticket mide 8.5" × 3.66" y caen sobre las perforaciones de las hojas *Lazer Cut Sheets* (3⅔" y 7⅓").

Los datos de la empresa (nombre, dirección, teléfono, mensaje) están en `lib/ticket/company.ts`. El logo por ahora es el texto "ASG"; cuando el cliente mande la imagen se reemplaza en `components/TicketView.tsx`.

---

## 8. Git y Vercel (para no publicar por accidente)

- Trabaja en la rama `feature/printable-tickets`. **Solo `main` despliega a producción.**
- Si haces `git push` de la rama, Vercel crea un **Preview deployment** que usa las variables de entorno de *Preview*. Si esas apuntan a la BD de producción, ese preview fallará (la migración 006 no está allí) y lo que guardes ahí iría a producción. No hagas push de la rama hasta que vayas a publicar, o configura las variables de Preview apuntando a otro proyecto de Supabase.

## 9. Pasar a producción (cuando el cliente apruebe)

Los datos actuales **no hay que mudarlos**: la migración 006 solo **agrega** tablas y columnas sobre la misma BD; los tickets existentes se quedan igual (sin order ni pesos) y la numeración automática sigue después del mayor número que ya existe.

Orden recomendado:

1. Respaldo: Supabase Dashboard → Database → Backups (o `pnpm supabase db dump --linked -f backup.sql`).
2. Aplicar la migración a producción **antes** de mergear:
   ```bash
   pnpm supabase link --project-ref <ref-de-produccion>
   pnpm supabase db push          # aplica solo 006 (las anteriores ya están)
   ```
   (No uses `--include-seed`, y **nunca** corras `supabase/dev/local-dev.sql` en producción.)
3. Poner el nombre del weighmaster de cada usuario (SQL Editor de producción):
   ```sql
   UPDATE public.profiles SET display_name = 'IVONNE' WHERE role = 'operator';
   ```
4. Merge de la rama a `main` → Vercel despliega solo.
5. El admin carga los trucks en `/trucks` y las orders en `/job-orders`.

## 10. Apagar todo

```bash
# Ctrl+C para detener pnpm dev
pnpm supabase stop        # detiene los contenedores (los datos locales se conservan)
pnpm supabase stop --no-backup   # detiene y borra los datos locales
```

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `Cannot connect to the Docker daemon` | Inicia Docker y repite `pnpm supabase start`. |
| Puerto 54321/54322 ocupado | Otro proyecto de Supabase está corriendo: `pnpm supabase stop --project-id <otro>` o cambia los puertos en `supabase/config.toml`. |
| Login dice credenciales inválidas | No corriste `supabase/dev/local-dev.sql` después del `db reset`. |
| Al entrar te devuelve al login | El usuario existe pero no tiene fila en `profiles`: vuelve a correr `local-dev.sql`. |
| La app muestra datos de producción | Revisa `.env.local`: debe decir `http://127.0.0.1:54321`. Reinicia `pnpm dev` después de cambiarlo. |
