# Deploy a producción (Vercel + Supabase)

Esta app usa **SQLite en desarrollo local** y **Postgres (Supabase) en producción**.
El esquema de Postgres se genera automáticamente desde `prisma/schema.prisma`
(la única fuente de verdad) con `scripts/build-postgres-schema.mjs`.

## Resumen de la arquitectura de DB

| Entorno    | Motor    | `DATABASE_URL`                        | Migraciones                     |
| ---------- | -------- | ------------------------------------- | ------------------------------- |
| Local      | SQLite   | `file:./dev.db`                       | `prisma/migrations`             |
| Producción | Postgres | connection string pooled de Supabase  | `prisma/postgres/migrations`    |

El adapter de Prisma se elige solo en runtime según `DATABASE_URL`
(`file:` → SQLite, cualquier otra → Postgres). Ver `src/lib/prisma.ts`.

---

## 1. Crear el proyecto en Supabase

1. Entrá a https://supabase.com/dashboard → **New project**.
2. Elegí una contraseña de base de datos fuerte y **guardala** (la vas a necesitar).
3. Cuando termine de crearse, andá a **Project Settings → Database → Connection string**
   y copiá dos strings (modo **Prisma** o **URI**):
   - **Transaction pooler** (puerto **6543**) → será `DATABASE_URL`. Agregale `?pgbouncer=true` al final.
   - **Direct connection / Session** (puerto **5432**) → será `DIRECT_URL`.

   Ejemplo:
   ```
   DATABASE_URL="postgres://postgres.abcd1234:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgres://postgres.abcd1234:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
   ```

## 2. Configurar las variables de entorno en Vercel

En **Vercel → tu proyecto → Settings → Environment Variables**, agregá (scope: Production, y Preview si querés):

| Variable          | Valor                                                        |
| ----------------- | ----------------------------------------------------------- |
| `DATABASE_URL`    | connection string **pooled** (6543, con `?pgbouncer=true`)  |
| `DIRECT_URL`      | connection string **directa** (5432)                        |
| `NEXTAUTH_SECRET` | secreto fuerte → generalo con `openssl rand -base64 32`      |
| `NEXTAUTH_URL`    | `https://<tu-app>.vercel.app` (o tu dominio propio)          |

> El build de Vercel corre `npm run vercel-build`, que:
> 1. genera el schema de Postgres,
> 2. `prisma generate` (cliente Postgres),
> 3. `prisma migrate deploy` (aplica las migraciones a Supabase usando `DIRECT_URL`),
> 4. `next build`.

## 3. Primer deploy

1. Conectá el repo de GitHub a Vercel (framework detectado: Next.js).
2. Deploy. En el primer build se crean todas las tablas en Supabase.

## 4. Cargar datos de demo (15 días) en Supabase

El seed **no** corre en el build. Corrélo una vez, apuntando a Supabase, desde tu máquina:

```bash
# En tu terminal local, con las mismas connection strings de Supabase:
DATABASE_URL="postgres://...:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgres://...:5432/postgres" \
npm run db:pg:generate   # genera el cliente Postgres localmente
DATABASE_URL="postgres://...:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgres://...:5432/postgres" \
npm run db:pg:seed       # borra y carga la data de demo
```

> En PowerShell (Windows), seteá las variables antes:
> ```powershell
> $env:DATABASE_URL="postgres://...:6543/postgres?pgbouncer=true"
> $env:DIRECT_URL="postgres://...:5432/postgres"
> npm run db:pg:generate
> npm run db:pg:seed
> ```

⚠️ El seed hace `deleteMany()` de todas las tablas antes de cargar. **No lo corras
sobre datos reales.** Es para dejar la demo lista, no para producción con clientes reales.

Después de sembrar, volvé a generar el cliente SQLite para seguir en local:
```bash
npm run db:generate
```

### Credenciales de la demo

- **Admin:** `owner@barber-bills.local` / `admin123`
- **PINs de barberos:** Nico 1111 · Lucas 2222 · Fede 3333 · Matías 4444 · Franco 5555 · Nahuel 6666

---

## Flujo de desarrollo local (SQLite)

```bash
npm install            # postinstall genera el cliente SQLite
npm run db:migrate     # aplica migraciones a dev.db (o `prisma migrate dev`)
npm run db:seed        # carga la data de demo (15 días) en SQLite
npm run dev
```

## Cambios de schema a futuro

1. Editá **`prisma/schema.prisma`** (SQLite, la fuente de verdad).
2. Local: `npm run db:migrate` (crea la migración SQLite y actualiza `dev.db`).
3. Postgres: `npm run db:pg:generate` regenera el schema PG. Para crear la
   migración de Postgres necesitás una DB Postgres accesible:
   ```bash
   npx prisma migrate dev --config prisma.postgres.config.ts --name <nombre>
   ```
   (podés apuntar `DIRECT_URL` a una DB de staging o a un Postgres local).
   Commiteá tanto `prisma/migrations` como `prisma/postgres/migrations`.

> ⚠️ Al usar dos motores distintos, un detalle de dialecto SQL podría comportarse
> distinto entre dev y prod. Si eso se vuelve molesto, considerá mover también el
> dev local a Postgres y eliminar el andamiaje de doble-provider.

## Troubleshooting

- **`prepared statement "s0" already exists` o errores raros de conexión en prod:**
  es el pooler de Supabase en modo transacción. Asegurate de que `DATABASE_URL`
  tenga `?pgbouncer=true` y que `DIRECT_URL` (sin `pgbouncer`) apunte al puerto
  5432. Las migraciones deben usar siempre `DIRECT_URL`.
- **Las migraciones no se aplican en el deploy:** revisá que el build de Vercel
  esté corriendo `npm run vercel-build` (lo fuerza `vercel.json`) y que
  `DIRECT_URL` esté seteada en las env vars de Vercel.

## Nota sobre el rate-limit de login

`src/lib/login-rate-limit.ts` guarda los intentos **en memoria**. En Vercel
(serverless, múltiples instancias) el límite es por instancia, no global. Alcanza
para un MVP; si necesitás rate-limiting fuerte, migralo a un store compartido
(por ej. la misma Postgres o Upstash Redis).
