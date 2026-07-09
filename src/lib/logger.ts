import { LogLevel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Retención de logs: se purgan solos pasados estos días (evita que la tabla crezca infinito).
const RETENTION_DAYS = 90;

export type LogMeta = {
  businessId?: string | null;
  userId?: string | null;
  context?: Record<string, unknown>;
};

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function write(level: LogLevel, event: string, message: string, meta: LogMeta) {
  try {
    await prisma.appLog.create({
      data: {
        level,
        event: clip(event, 120),
        message: clip(message, 1000),
        context: meta.context ? clip(safeJson(meta.context), 5000) : null,
        businessId: meta.businessId ?? null,
        userId: meta.userId ?? null,
      },
    });
    maybePrune();
  } catch (error) {
    // El logging NUNCA debe romper el flujo de la app.
    console.error("[logger] no se pudo escribir el log:", error);
  }
}

/** Evento de negocio (auditoría): ventas, cierres, altas, accesos, etc. */
export function logEvent(event: string, message: string, meta: LogMeta = {}) {
  return write(LogLevel.INFO, event, message, meta);
}

/** Aviso no fatal. */
export function logWarn(event: string, message: string, meta: LogMeta = {}) {
  return write(LogLevel.WARN, event, message, meta);
}

/** Error del backend. También lo manda a la consola (para los logs de Vercel). */
export function logError(event: string, error: unknown, meta: LogMeta = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[${event}]`, err);
  return write(LogLevel.ERROR, event, err.message, {
    ...meta,
    context: { ...(meta.context ?? {}), stack: err.stack },
  });
}

// Purga oportunista (baja probabilidad, sin bloquear) de logs más viejos que la retención.
function maybePrune() {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  void prisma.appLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
}
