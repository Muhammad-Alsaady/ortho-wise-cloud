import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { checkAuthError } from '@/lib/api';

const AuditLogs: React.FC = () => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from('audit_logs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { checkAuthError(error, 'AuditLogs'); console.error('[AuditLogs] fetch error:', error); }
        setLogs(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AuditLogs] exception:', err);
        setLoading(false);
      });
  }, [clinicId]);

  const actionColors: Record<string, string> = {
    payment_created: 'bg-green-100 text-green-800',
    treatment_created: 'bg-blue-100 text-blue-800',
    treatment_updated: 'bg-yellow-100 text-yellow-800',
    appointment_created: 'bg-purple-100 text-purple-800',
    appointment_updated: 'bg-orange-100 text-orange-800',
    treatment_plan_created: 'bg-cyan-100 text-cyan-800',
    treatment_plan_updated: 'bg-pink-100 text-pink-800',
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.auditLogs')}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('payment.date')}</TableHead>
              <TableHead>{t('admin.action')}</TableHead>
              <TableHead>{t('admin.entityType')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
            ) : logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{format(new Date(log.created_at), 'dd/MM/yyyy h:mm a')}</TableCell>
                <TableCell>
                  <Badge className={actionColors[log.action] || 'bg-muted text-muted-foreground'}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{log.entity_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AuditLogs;
