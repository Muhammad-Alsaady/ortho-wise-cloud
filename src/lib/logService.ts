import { supabase } from '@/integrations/supabase/client';

type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

interface LogContext {
  clinicId: string | null;
  userId: string | null;
}

let _context: LogContext = { clinicId: null, userId: null };

/** Call once from AuthContext after login to set clinic/user for all subsequent logs */
export const setLogContext = (clinicId: string | null, userId: string | null) => {
  _context = { clinicId, userId };
};

const insertLog = async (
  level: LogLevel,
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
) => {
  try {
    if (!_context.clinicId) {
      console.warn('[LogService] No clinic_id set — skipping log');
      return;
    }

    await supabase.from('logs').insert({
      clinic_id: _context.clinicId,
      user_id: _context.userId,
      level,
      action,
      entity,
      message,
      details: details ?? null,
    });
  } catch (err) {
    // Logging must never break app flow
    console.error('[LogService] Failed to write log:', err);
  }
};

export const logInfo = (
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
) => insertLog('INFO', action, entity, message, details);

export const logWarning = (
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
) => insertLog('WARNING', action, entity, message, details);

export const logError = (
  action: string,
  entity: string,
  error: unknown,
  details?: Record<string, unknown>,
) => {
  const message = error instanceof Error ? error.message : String(error);
  return insertLog('ERROR', action, entity, message, details);
};
