import 'server-only';
import { prisma } from './prisma';

type AuditInput = {
  companyId?: string | null;
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'IMPORT' | 'SETTLE' | 'RECONCILE';
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  payload?: unknown;
};

/** Registra uma acao no log de auditoria. Nunca deve quebrar o fluxo principal. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        payload: input.payload ? JSON.stringify(input.payload).slice(0, 8000) : null,
      },
    });
  } catch (error) {
    console.error('[audit] falha ao registrar log', error);
  }
}
