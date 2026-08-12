# Deploy a producción (VPS + Supabase self-hosted)

La plataforma vive en dos repositorios:

- `nebula-ar/bills`: aplicación, schema Prisma y migraciones del dominio.
- `nebula-ar/supabase-infra`: Compose oficial fijado, Nginx, secretos, roles,
  backups, restore drills y wrappers de deploy.

PostgreSQL 17 es el único motor. No existe un camino SQLite alternativo.

## Conexiones

| Uso | Endpoint en la VPS | Rol |
| --- | --- | --- |
| Runtime Prisma | `127.0.0.1:6543` (Supavisor transaction) | `bills_runtime.<tenant>` |
| Migraciones | `127.0.0.1:54322` (Postgres directo) | `bills_migrator` |
| Supabase server-side | `127.0.0.1:8000` (Kong) | anon/service-role según operación |

Ninguno de esos puertos se publica. Nginx expone HTTPS para Bills, el endpoint
de refresh estrictamente permitido y Studio con Basic Auth + allowlist IP.

## Desarrollo y CI

```bash
npm install
npx supabase start
cp .env.example .env       # completar las claves de `supabase status -o env`
npm run db:migrate
npm run db:seed
npm run dev
```

## Cambios de entidades

1. Editar `prisma/schema.prisma`.
2. Levantar Supabase local y ejecutar `npm run db:migrate -- --name <cambio>`.
3. Revisar el SQL generado y probar unitarios y build.
4. Integrar primero la migración compatible; después el código que la consume.
5. Los cambios de plataforma (imagen, Auth, proxy, backup) van en
   `supabase-infra`; los cambios de dominio permanecen en Bills.

Las migraciones son expand/contract y roll-forward: un rollback de symlink no
deshace DDL ya aplicado.

## Producción

El workflow está inhabilitado hasta que la variable de repositorio
`SUPABASE_CUTOVER_COMPLETE=true` y el archivo root-only
`/etc/bills-cutover-approved` confirmen el cutover. Después, cada push a
`master` empaqueta el SHA exacto y el wrapper root inmutable:

1. verifica `ops.environment_identity`;
2. instala dependencias y genera Prisma como usuario `bills`;
3. aplica migraciones por `DIRECT_URL`;
4. construye Next.js;
5. activa el symlink y verifica `/login`;
6. revierte el symlink si falla el healthcheck.

El procedimiento de instalación inicial limpia, backups y ensayo de restore
está en el `RUNBOOK.md` de `supabase-infra`.

## Auth

- Signup/password grant públicos de GoTrue están deshabilitados.
- Login y registro pasan por Server Actions de Bills.
- Las identidades se crean en Supabase Auth durante el registro; Bills no
  almacena contraseñas de administradores en sus tablas.
- Coincidir por email nunca autoriza: UUID, instancia, negocio y metadata deben
  coincidir.
- Los intentos y leases de provisión son persistentes y auditables.
- Las cuentas autoconfirmadas quedan marcadas `UNVERIFIED_AUTOCONFIRM` hasta
  incorporar SMTP y verificación de propiedad en una fase futura.
- El PIN del mostrador usa `STAFF_SESSION_SECRET`, separado de Supabase Auth.

## Secretos obligatorios

Ver `.env.example`. En producción `/etc/bills.env` es `root:bills 0640` y lo
genera `supabase-infra/scripts/render-bills-env.sh`; nunca se commitea.

El seed borra datos de dominio: se usa sólo en entornos descartables.
