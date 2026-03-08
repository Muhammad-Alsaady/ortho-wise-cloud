import React, { useState, useEffect, useMemo } from 'react';
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
import { format } from 'date-fns';
import { CalendarIcon, Search, Plus, Send, CreditCard, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import AppointmentModal from '@/components/modals/AppointmentModal';
import PaymentModal from '@/components/modals/PaymentModal';
import { useToast } from '@/hooks/use-toast';

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
  const [search, setSearch] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [paymentAppointment, setPaymentAppointment] = useState<any>(null);

  const fetchAppointments = async () => {
    if (!clinicId) return;
    setLoading(true);

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

    if (error) {
      console.error(error);
    } else {
      // Fetch visit/payment data for each appointment
      const enriched = await Promise.all((data || []).map(async (apt) => {
        const { data: visits } = await supabase
          .from('visits')
          .select('id')
          .eq('appointment_id', apt.id);
        
        let treatmentCount = 0;
        let totalBilled = 0;
        let totalPaid = 0;

        if (visits && visits.length > 0) {
          const visitIds = visits.map(v => v.id);
          const { data: plans } = await supabase
            .from('treatment_plans')
            .select('id, price, discount')
            .in('visit_id', visitIds);
          
          if (plans) {
            treatmentCount = plans.length;
            totalBilled = plans.reduce((s, p) => s + Number(p.price) - Number(p.discount), 0);
            
            const planIds = plans.map(p => p.id);
            if (planIds.length > 0) {
              const { data: payments } = await supabase
                .from('payments')
                .select('amount')
                .in('treatment_plan_id', planIds);
              totalPaid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
            }
          }
        }

        return { ...apt, treatmentCount, totalBilled, totalPaid };
      }));

      setAppointments(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();

    // Realtime subscription
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId, date]);

  const filtered = useMemo(() => {
    if (!search) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a =>
      a.patient?.name?.toLowerCase().includes(q) ||
      a.patient?.phone?.includes(q)
    );
  }, [appointments, search]);

  const handleSendToDoctor = async (appointmentId: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'Waiting' as const })
      .eq('id', appointmentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('reception.sendToDoctor') });
      fetchAppointments();
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-start font-normal")}>
                <CalendarIcon className="me-2 h-4 w-4" />
                {format(date, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
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
                  <TableCell>{apt.appointment_time?.slice(0, 5)}</TableCell>
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
                      {apt.status === 'Booked' && (
                        <Button size="sm" variant="outline" onClick={() => handleSendToDoctor(apt.id)}>
                          <Send className="h-3 w-3 me-1" />
                          {t('reception.sendToDoctor')}
                        </Button>
                      )}
                      {(apt.status === 'Completed' || apt.status === 'WithDoctor') && (
                        <Button size="sm" variant="outline" onClick={() => setPaymentAppointment(apt)}>
                          <CreditCard className="h-3 w-3 me-1" />
                          {t('reception.payment')}
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
          onClose={() => { setShowAppointmentModal(false); fetchAppointments(); }}
        />
      )}

      {paymentAppointment && (
        <PaymentModal
          open={!!paymentAppointment}
          appointment={paymentAppointment}
          onClose={() => { setPaymentAppointment(null); fetchAppointments(); }}
        />
      )}
    </div>
  );
};

export default ReceptionDashboard;
