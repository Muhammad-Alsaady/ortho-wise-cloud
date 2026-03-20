import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { CalendarIcon, Search, Plus, Send, CreditCard, Pencil, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import AppointmentModal from '@/components/modals/AppointmentModal';
import EditAppointmentModal from '@/components/modals/EditAppointmentModal';
import PaymentModal from '@/components/modals/PaymentModal';
import { useToast } from '@/hooks/use-toast';
import { checkAuthError } from '@/lib/api';
import { logInfo, logError } from '@/lib/logService';

/** Convert "HH:mm" 24-hour string to "h:mm AM/PM" */
function formatTime12(time24: string | null | undefined): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.slice(0, 5).split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${period}`;
}

const statusColors: Record<string, string> = {
  Booked: 'bg-blue-100 text-blue-800',
  Waiting: 'bg-yellow-100 text-yellow-800',
  WithDoctor: 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const ReceptionDashboard: React.FC = () => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [editAppointment, setEditAppointment] = useState<any>(null);
  const [paymentAppointment, setPaymentAppointment] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const fetchRef = useRef(0); // dedup concurrent fetches
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!clinicId) return;
    const fetchId = ++fetchRef.current;
    setLoading(true);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(name, phone),
          doctor:profiles!appointments_doctor_id_fkey(name)
        `)
        .eq('clinic_id', clinicId)
        .eq('appointment_date', dateStr)
        .order('appointment_time', { ascending: true });

      // Stale response — a newer fetch was started
      if (fetchId !== fetchRef.current) return;

      if (error) {
        if (checkAuthError(error, 'Reception.fetchAppointments')) return;
        console.error('[ReceptionDashboard] fetchAppointments error:', error);
        setAppointments([]);
        setLoading(false);
        return;
      }

      const aptIds = (data || []).map(a => a.id);
      let summaryMap: Record<string, any> = {};

      if (aptIds.length > 0) {
        const { data: summaries } = await supabase
          .from('appointment_summary')
          .select('*')
          .in('appointment_id', aptIds);

        if (fetchId !== fetchRef.current) return;

        (summaries || []).forEach(s => {
          summaryMap[s.appointment_id] = s;
        });
      }

      const enriched = (data || []).map(apt => {
        const summary = summaryMap[apt.id];
        return {
          ...apt,
          treatmentCount: Number(summary?.treatment_count || 0),
          totalBilled: Number(summary?.total_billed || 0),
          totalPaid: Number(summary?.total_paid || 0),
        };
      });

      setAppointments(enriched);
    } catch (err: any) {
      if (fetchId !== fetchRef.current) return;
      console.error('[ReceptionDashboard] fetchAppointments exception:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to load appointments', variant: 'destructive' });
      setAppointments([]);
    } finally {
      if (fetchId === fetchRef.current) setLoading(false);
    }
  }, [clinicId, date]);

  /** Debounced fetch — collapses rapid-fire realtime events into a single call */
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAppointments(), 300);
  }, [fetchAppointments]);

  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel(`appointments-changes-${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `clinic_id=eq.${clinicId}`,
      }, () => {
        debouncedFetch();
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [clinicId, date, fetchAppointments, debouncedFetch]);

  const filtered = useMemo(() => {
    if (!search) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a =>
      a.patient?.name?.toLowerCase().includes(q) ||
      a.patient?.phone?.includes(q)
    );
  }, [appointments, search]);

  const handleSendToDoctor = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Waiting' as const })
        .eq('id', appointmentId);

      if (error) {
        logError('SEND_TO_DOCTOR', 'appointment', error, { appointmentId });
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        logInfo('SEND_TO_DOCTOR', 'appointment', 'Patient sent to doctor queue', { appointmentId });
        toast({ title: t('reception.sendToDoctor') });
      }
    } catch (err: any) {
      logError('SEND_TO_DOCTOR', 'appointment', err, { appointmentId });
      console.error('[ReceptionDashboard] handleSendToDoctor error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to send', variant: 'destructive' });
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' as const })
        .eq('id', cancelTarget.id);

      if (error) {
        logError('CANCEL_APPOINTMENT', 'appointment', error, { appointmentId: cancelTarget.id });
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        logInfo('CANCEL_APPOINTMENT', 'appointment', 'Appointment cancelled', { appointmentId: cancelTarget.id });
        toast({ title: t('reception.appointmentCancelled') });
      }
    } catch (err: any) {
      logError('CANCEL_APPOINTMENT', 'appointment', err, { appointmentId: cancelTarget.id });
      console.error('[ReceptionDashboard] handleCancelAppointment error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to cancel', variant: 'destructive' });
    } finally {
      setCancelLoading(false);
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[260px] justify-start text-start font-normal")}>
                <CalendarIcon className="me-2 h-4 w-4" />
                {format(date, 'EEEE, MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDateOpen(false); } }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('reception.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10"
            />
          </div>

          <Button onClick={() => setShowAppointmentModal(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('reception.newAppointment')}
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reception.patient')}</TableHead>
                <TableHead>{t('reception.phone')}</TableHead>
                <TableHead>{t('reception.doctor')}</TableHead>
                <TableHead>{t('reception.time')}</TableHead>
                <TableHead>{t('reception.treatments')}</TableHead>
                <TableHead>{t('reception.paid')}</TableHead>
                <TableHead>{t('reception.remaining')}</TableHead>
                <TableHead>{t('reception.status')}</TableHead>
                <TableHead>{t('reception.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t('reception.noAppointments')}</TableCell></TableRow>
              ) : filtered.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium">{apt.patient?.name}</TableCell>
                  <TableCell>{apt.patient?.phone}</TableCell>
                  <TableCell>{apt.doctor?.name}</TableCell>
                  <TableCell>{formatTime12(apt.appointment_time)}</TableCell>
                  <TableCell>{apt.treatmentCount}</TableCell>
                  <TableCell className="text-green-600 font-medium">{apt.totalPaid}</TableCell>
                  <TableCell className="text-destructive font-medium">{apt.totalBilled - apt.totalPaid}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', statusColors[apt.status])}>
                      {t(`status.${apt.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditAppointment(apt)}>
                        <Pencil className="h-3 w-3 me-1" />
                        {t('common.edit')}
                      </Button>
                      {apt.status === 'Booked' && (
                        <Button size="sm" variant="outline" onClick={() => handleSendToDoctor(apt.id)}>
                          <Send className="h-3 w-3 me-1" />
                          {t('reception.sendToDoctor')}
                        </Button>
                      )}
                      {(apt.status === 'WithDoctor' || apt.status === 'Completed') && apt.totalBilled > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setPaymentAppointment(apt)}>
                          <CreditCard className="h-3 w-3 me-1" />
                          {t('reception.payment')}
                        </Button>
                      )}
                      {(apt.status === 'Booked' || apt.status === 'Waiting') && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelTarget(apt)}>
                          <XCircle className="h-3 w-3 me-1" />
                          {t('common.cancel')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showAppointmentModal && (
        <AppointmentModal
          open={showAppointmentModal}
          onClose={() => { setShowAppointmentModal(false); }}
        />
      )}

      {editAppointment && (
        <EditAppointmentModal
          open={!!editAppointment}
          appointment={editAppointment}
          onClose={() => { setEditAppointment(null); }}
        />
      )}

      {paymentAppointment && (
        <PaymentModal
          open={!!paymentAppointment}
          appointment={paymentAppointment}
          onClose={() => { setPaymentAppointment(null); }}
        />
      )}

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reception.cancelAppointment')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reception.cancelConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAppointment} disabled={cancelLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelLoading ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReceptionDashboard;
