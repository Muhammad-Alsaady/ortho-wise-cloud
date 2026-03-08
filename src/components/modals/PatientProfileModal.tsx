import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  patient: any;
  onClose: () => void;
}

const PatientProfileModal: React.FC<Props> = ({ open, patient, onClose }) => {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);

  useEffect(() => {
    if (!patient) return;

    supabase
      .from('appointments')
      .select('*, doctor:profiles!appointments_doctor_id_fkey(name)')
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: false })
      .limit(20)
      .then(({ data }) => setAppointments(data || []));

    supabase
      .from('patient_balances')
      .select('*')
      .eq('patient_id', patient.id)
      .single()
      .then(({ data }) => setBalance(data));
  }, [patient]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('patients.viewProfile')}: {patient?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">{t('patients.phone')}:</span> {patient?.phone}</div>
            <div><span className="text-muted-foreground">{t('patients.age')}:</span> {patient?.age}</div>
            {balance && (
              <>
                <div><span className="text-muted-foreground">{t('payment.totalBilled')}:</span> <strong>{balance.total_billed}</strong></div>
                <div><span className="text-muted-foreground">{t('payment.totalPaid')}:</span> <strong>{balance.total_paid}</strong></div>
                <div><span className="text-muted-foreground">{t('payment.balance')}:</span> <strong className="text-destructive">{balance.balance}</strong></div>
              </>
            )}
          </div>

          <h4 className="font-semibold text-sm">{t('reception.title')}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payment.date')}</TableHead>
                <TableHead>{t('reception.time')}</TableHead>
                <TableHead>{t('reception.doctor')}</TableHead>
                <TableHead>{t('reception.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map(a => (
                <TableRow key={a.id}>
                  <TableCell>{a.appointment_date}</TableCell>
                  <TableCell>{a.appointment_time?.slice(0, 5)}</TableCell>
                  <TableCell>{a.doctor?.name}</TableCell>
                  <TableCell><Badge variant="outline">{t(`status.${a.status}`)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientProfileModal;
