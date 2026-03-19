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

/**
 * Fire-and-forget insert — never uses async/await so it cannot
 * block, stall token refreshes, or interfere with the caller.
 */
const insertLog = (
  level: LogLevel,
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
): void => {
  try {
    if (!_context.clinicId) return;

    supabase
      .from('logs')
      .insert({
        clinic_id: _context.clinicId,
        user_id: _context.userId,
        level,
        action,
        entity,
        message,
        details: details ?? null,
      })
      .then(({ error }) => {
        if (error) console.error('[LogService]', error.message);
      })
      .catch((err) => {
        console.error('[LogService] Failed to write log:', err);
      });
  } catch (err) {
    // Logging must never break app flow
    console.error('[LogService] Unexpected error:', err);
  }
};

export const logInfo = (
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
): void => { insertLog('INFO', action, entity, message, details); };

export const logWarning = (
  action: string,
  entity: string,
  message: string,
  details?: Record<string, unknown>,
): void => { insertLog('WARNING', action, entity, message, details); };

export const logError = (
  action: string,
  entity: string,
  error: unknown,
  details?: Record<string, unknown>,
): void => {
  const message = error instanceof Error ? error.message : String(error);
  insertLog('ERROR', action, entity, message, details);
};
