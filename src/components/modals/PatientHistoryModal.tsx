import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { checkAuthError } from '@/lib/api';

interface Props {
  open: boolean;
  patient: { id: string; name: string };
  onClose: () => void;
}

const PatientHistoryModal: React.FC<Props> = ({ open, patient, onClose }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient?.id) return;
    setLoading(true);

    const fetchHistory = async () => {
      try {
        const { data: appointments, error: aErr } = await supabase
          .from('appointments')
          .select('*, doctor:profiles!appointments_doctor_id_fkey(name)')
          .eq('patient_id', patient.id)
          .order('appointment_date', { ascending: false });

        if (aErr) {
          if (checkAuthError(aErr, 'PatientHistory.appointments')) return;
          console.error('[PatientHistory] appointments error:', aErr);
          setLoading(false);
          return;
        }

        if (!appointments || appointments.length === 0) {
          setHistory([]);
          setLoading(false);
          return;
        }

        const aptIds = appointments.map(a => a.id);
        const { data: visits, error: vErr } = await supabase
          .from('visits')
          .select('id, appointment_id')
          .in('appointment_id', aptIds);

        if (vErr) checkAuthError(vErr, 'PatientHistory.visits');

        const visitIds = (visits || []).map(v => v.id);
        let plans: any[] = [];
        let payments: any[] = [];

        if (visitIds.length > 0) {
          const { data: p, error: plErr } = await supabase
            .from('treatment_plans')
            .select('id, visit_id, price, discount, treatment:treatments(name)')
            .in('visit_id', visitIds);
          if (plErr) checkAuthError(plErr, 'PatientHistory.plans');
          plans = p || [];

          const planIds = plans.map(p => p.id);
          if (planIds.length > 0) {
            const { data: pay, error: payErr } = await supabase
              .from('payments')
              .select('treatment_plan_id, amount')
              .in('treatment_plan_id', planIds);
            if (payErr) checkAuthError(payErr, 'PatientHistory.payments');
            payments = pay || [];
          }
        }

        const enriched = appointments.map(apt => {
          const aptVisits = (visits || []).filter(v => v.appointment_id === apt.id);
          const aptVisitIds = aptVisits.map(v => v.id);
          const aptPlans = plans.filter(p => aptVisitIds.includes(p.visit_id));
          const aptPlanIds = aptPlans.map(p => p.id);
          const aptPayments = payments.filter(p => aptPlanIds.includes(p.treatment_plan_id));

          const totalBilled = aptPlans.reduce((s: number, p: any) => s + Number(p.price) - Number(p.discount), 0);
          const totalPaid = aptPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const treatmentNames = aptPlans.map((p: any) => p.treatment?.name).filter(Boolean).join(', ');

          return { ...apt, treatmentNames, totalBilled, totalPaid, balance: totalBilled - totalPaid };
        });

        setHistory(enriched);
      } catch (err) {
        console.error('[PatientHistory] fetchHistory exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patient?.id]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('patients.history')}: {patient?.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payment.date')}</TableHead>
                <TableHead>{t('reception.doctor')}</TableHead>
                <TableHead>{t('reception.treatments')}</TableHead>
                <TableHead>{t('payment.totalBilled')}</TableHead>
                <TableHead>{t('payment.totalPaid')}</TableHead>
                <TableHead>{t('payment.balance')}</TableHead>
                <TableHead>{t('reception.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : history.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{h.appointment_date}</TableCell>
                  <TableCell>{h.doctor?.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{h.treatmentNames || '—'}</TableCell>
                  <TableCell>{h.totalBilled}</TableCell>
                  <TableCell className="text-green-600">{h.totalPaid}</TableCell>
                  <TableCell className="text-destructive font-medium">{h.balance}</TableCell>
                  <TableCell><Badge variant="outline">{t(`status.${h.status}`)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PatientHistoryModal;
