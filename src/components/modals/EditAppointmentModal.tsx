import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { checkAuthError } from '@/lib/api';

// Build time slots from 9 AM to 11:30 PM; values are 24H (stored in DB), labels are 12H AM/PM
const TIME_SLOTS: { value: string; label: string }[] = [];
for (let h = 9; h < 24; h++) {
  for (const m of [0, 30]) {
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const label = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    TIME_SLOTS.push({ value, label });
  }
}

interface Props {
  open: boolean;
  appointment: any;
  onClose: () => void;
}

const EditAppointmentModal: React.FC<Props> = ({ open, appointment, onClose }) => {
  const { clinicId, profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Appointment tab state
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [savingAppt, setSavingAppt] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [nextDateOpen, setNextDateOpen] = useState(false);

  // Treatments tab state
  const [treatments, setTreatments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [newTreatmentId, setNewTreatmentId] = useState('');
  const [newTreatmentPrice, setNewTreatmentPrice] = useState('');
  const [addingTreatment, setAddingTreatment] = useState(false);

  // Payments tab state
  const [payments, setPayments] = useState<any[]>([]);
  const [aptFeePayments, setAptFeePayments] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const appointmentFee = Number(appointment?.appointment_fee ?? 0);

  // Next visit tab state
  const [nextDoctor, setNextDoctor] = useState('');
  const [nextDate, setNextDate] = useState<Date>(new Date());
  const [nextTime, setNextTime] = useState('');
  const [schedulingNext, setSchedulingNext] = useState(false);

  // Load doctors (batch query instead of sequential per-user loop)
  useEffect(() => {
    if (!clinicId) return;
    const fetchDoctors = async () => {
      try {
        const { data: profilesData, error: pErr } = await supabase
          .from('profiles')
          .select('id, name, user_id')
          .eq('clinic_id', clinicId);
        if (pErr) { checkAuthError(pErr, 'EditAppt.profiles'); return; }
        if (!profilesData || profilesData.length === 0) return;

        const userIds = profilesData.map(p => p.user_id);
        const { data: rolesData, error: rErr } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds)
          .eq('role', 'doctor');
        if (rErr) { checkAuthError(rErr, 'EditAppt.roles'); return; }

        const doctorUserIds = new Set(rolesData?.map(r => r.user_id) || []);
        setDoctors(profilesData.filter(p => doctorUserIds.has(p.user_id)));
      } catch (err) {
        console.error('[EditAppointmentModal] fetchDoctors error:', err);
      }
    };
    fetchDoctors();
  }, [clinicId]);

  // Load treatments catalog
  useEffect(() => {
    if (!clinicId) return;
    supabase.from('treatments').select('id, name, price').eq('clinic_id', clinicId).then(({ data, error }) => {
      if (error) { checkAuthError(error, 'EditAppt.treatments'); return; }
      setTreatments(data || []);
    }).catch(err => console.error('[EditAppt] treatments exception:', err));
  }, [clinicId]);

  // Initialize appointment fields
  useEffect(() => {
    if (!appointment) return;
    setDoctorId(appointment.doctor_id || '');
    setDate(new Date(appointment.appointment_date));
    setTime(appointment.appointment_time?.slice(0, 5) || '');
  }, [appointment]);

  // Load visit, treatments, payments
  const fetchVisitData = useCallback(async () => {
    if (!appointment) return;

    try {
      // Fetch appointment-fee payments
      const { data: aptFeePay } = await supabase
        .from('payments')
        .select('*')
        .eq('appointment_id', appointment.id)
        .order('created_at', { ascending: false });
      setAptFeePayments(aptFeePay || []);

      const { data: visits, error: vErr } = await supabase
        .from('visits')
        .select('id')
        .eq('appointment_id', appointment.id);

      if (vErr) { checkAuthError(vErr, 'EditAppt.visits'); return; }

      if (!visits || visits.length === 0) {
        setVisitId(null);
        setPlans([]);
        setPayments([]);
        return;
      }

      const vid = visits[0].id;
      setVisitId(vid);

      const { data: plansData, error: plErr } = await supabase
        .from('treatment_plans')
        .select('*, treatment:treatments(name)')
        .eq('visit_id', vid);

      if (plErr) checkAuthError(plErr, 'EditAppt.plans');
      setPlans(plansData || []);

      if (plansData && plansData.length > 0) {
        const planIds = plansData.map(p => p.id);
        const { data: paymentsData, error: payErr } = await supabase
          .from('payments')
          .select('*')
          .in('treatment_plan_id', planIds)
          .order('created_at', { ascending: false });
        if (payErr) checkAuthError(payErr, 'EditAppt.payments');
        setPayments(paymentsData || []);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.error('[EditAppointmentModal] fetchVisitData error:', err);
    }
  }, [appointment]);

  useEffect(() => { fetchVisitData(); }, [fetchVisitData]);

  // Financial summary
  const aptFeePaid = aptFeePayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalBilled = plans.reduce((s, p) => s + Number(p.price) - Number(p.discount), 0) + Number(appointment?.appointment_fee ?? 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0) + aptFeePaid;
  const balance = totalBilled - totalPaid;

  // Handlers
  const handleSaveAppointment = async () => {
    if (!doctorId || !time) {
      toast({ title: t('common.required'), variant: 'destructive' });
      return;
    }
    setSavingAppt(true);

    // Reset status to Booked when rescheduling a Completed/Cancelled appointment
    const isRescheduling = appointment.status === 'Completed' || appointment.status === 'Cancelled';
    const updatePayload: Record<string, any> = {
      doctor_id: doctorId,
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
    };
    if (isRescheduling) {
      updatePayload.status = 'Booked';
    }

    const { error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointment.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.save') });
    }
    setSavingAppt(false);
  };

  const handleAddTreatment = async () => {
    if (!newTreatmentId || !visitId) return;
    setAddingTreatment(true);

    const treatmentCatalog = treatments.find(t => t.id === newTreatmentId);
    const price = newTreatmentPrice ? Number(newTreatmentPrice) : Number(treatmentCatalog?.price || 0);

    const { error } = await supabase.from('treatment_plans').insert({
      visit_id: visitId,
      treatment_id: newTreatmentId,
      price,
      discount: 0,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewTreatmentId('');
      setNewTreatmentPrice('');
      fetchVisitData();
    }
    setAddingTreatment(false);
  };

  const handleAddPayment = async () => {
    if (!selectedPlan || !payAmount) return;
    setSavingPayment(true);
    const { error } = await supabase.from('payments').insert({
      treatment_plan_id: selectedPlan,
      amount: Number(payAmount),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setPayAmount('');
      setPayNotes('');
      fetchVisitData();
    }
    setSavingPayment(false);
  };

  const handleScheduleNext = async () => {
    if (!nextDoctor || !nextTime || !clinicId) return;
    setSchedulingNext(true);
    const { error } = await supabase.from('appointments').insert({
      clinic_id: clinicId,
      doctor_id: nextDoctor,
      appointment_date: format(nextDate, 'yyyy-MM-dd'),
      appointment_time: nextTime,
      patient_id: appointment.patient_id,
      patient_name: appointment.patient?.name || appointment.patient_name,
      patient_phone: appointment.patient?.phone || appointment.patient_phone,
      appointment_fee: appointmentFee,
      status: 'Booked' as const,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('edit.nextScheduled') });
      setNextDoctor('');
      setNextTime('');
    }
    setSchedulingNext(false);
  };

  // Auto-set treatment price when selected
  useEffect(() => {
    if (!newTreatmentId) return;
    const found = treatments.find(t => t.id === newTreatmentId);
    if (found) setNewTreatmentPrice(String(found.price));
  }, [newTreatmentId, treatments]);

  const patientName = appointment?.patient?.name || appointment?.patient_name || '';

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('common.edit')} — {patientName}
            <Badge className={cn('text-xs ms-2', appointment?.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')}>
              {t(`status.${appointment?.status}`)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Financial summary bar */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.totalBilled')}</p>
            <p className="text-lg font-bold">{totalBilled}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.totalPaid')}</p>
            <p className="text-lg font-bold text-green-600">{totalPaid}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.balance')}</p>
            <p className={cn("text-lg font-bold", balance > 0 ? "text-destructive" : "text-green-600")}>{balance}</p>
          </div>
        </div>

        <Tabs defaultValue="appointment" className="mt-2">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="appointment">{t('edit.tabAppointment')}</TabsTrigger>
            <TabsTrigger value="treatments">{t('edit.tabTreatments')}</TabsTrigger>
            <TabsTrigger value="payments">{t('edit.tabPayments')}</TabsTrigger>
            <TabsTrigger value="next">{t('edit.tabNextVisit')}</TabsTrigger>
          </TabsList>

          {/* ===== APPOINTMENT TAB ===== */}
          <TabsContent value="appointment" className="space-y-4 mt-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.doctor')} *</label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('payment.date')}</label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-start">
                    <CalendarIcon className="me-2 h-4 w-4" />
                    {format(date, 'EEEE, MMMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDateOpen(false); } }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.time')} *</label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(slot => <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveAppointment} disabled={savingAppt} className="w-full">
              <Save className="me-2 h-4 w-4" />
              {savingAppt ? t('common.loading') : t('common.save')}
            </Button>
          </TabsContent>

          {/* ===== TREATMENTS TAB ===== */}
          <TabsContent value="treatments" className="space-y-4 mt-4">
            {!visitId ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('edit.noVisitYet')}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('doctor.treatment')}</TableHead>
                      <TableHead>{t('doctor.price')}</TableHead>
                      <TableHead>{t('doctor.discount')}</TableHead>
                      <TableHead>{t('doctor.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
                    ) : plans.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.treatment?.name}</TableCell>
                        <TableCell>{Number(p.price)}</TableCell>
                        <TableCell>{Number(p.discount)}</TableCell>
                        <TableCell className="font-medium">{Number(p.price) - Number(p.discount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Add treatment */}
                <fieldset className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-2 text-sm font-semibold">{t('doctor.addTreatment')}</legend>
                  <Select value={newTreatmentId} onValueChange={setNewTreatmentId}>
                    <SelectTrigger><SelectValue placeholder={t('doctor.treatment')} /></SelectTrigger>
                    <SelectContent>
                      {treatments.map(tr => (
                        <SelectItem key={tr.id} value={tr.id}>{tr.name} — {tr.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder={t('doctor.price')}
                    value={newTreatmentPrice}
                    onChange={(e) => setNewTreatmentPrice(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleAddTreatment} disabled={addingTreatment || !newTreatmentId}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('doctor.addTreatment')}
                  </Button>
                </fieldset>
              </>
            )}
          </TabsContent>

          {/* ===== PAYMENTS TAB ===== */}
          <TabsContent value="payments" className="space-y-4 mt-4">
            {plans.length === 0 && aptFeePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('common.noData')}</p>
            ) : (
              <>
                {/* Add payment form — only when treatment plans exist */}
                {plans.length > 0 && (
                  <fieldset className="space-y-3 rounded-lg border border-border p-3">
                    <legend className="px-2 text-sm font-semibold">{t('payment.addPayment')}</legend>
                    <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                      <SelectTrigger><SelectValue placeholder={t('doctor.treatment')} /></SelectTrigger>
                      <SelectContent>
                        {plans.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.treatment?.name} ({Number(p.price) - Number(p.discount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder={t('payment.amount')}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    {appointmentFee > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('payment.appointmentFeeHint') || 'Appointment fee'}: <button type="button" className="text-primary underline" onClick={() => setPayAmount(String(appointmentFee))}>{appointmentFee}</button>
                      </p>
                    )}
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">{t('edit.cash')}</SelectItem>
                        <SelectItem value="Card">{t('edit.card')}</SelectItem>
                        <SelectItem value="Transfer">{t('edit.transfer')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={t('edit.paymentNotes')}
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                    <Button className="w-full" onClick={handleAddPayment} disabled={savingPayment || !selectedPlan || !payAmount}>
                      {t('payment.addPayment')}
                    </Button>
                  </fieldset>
                )}

                {/* Payment history — combines treatment-plan payments and appointment-fee payments */}
                {(() => {
                  const allPayments = [
                    ...aptFeePayments.map(p => ({ ...p, label: t('payment.appointmentFeePaid') })),
                    ...payments.map(p => {
                      const plan = plans.find(pl => pl.id === p.treatment_plan_id);
                      return { ...p, label: plan?.treatment?.name || '' };
                    }),
                  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  return (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">{t('payment.history')}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('payment.amount')}</TableHead>
                            <TableHead>{t('doctor.treatment')}</TableHead>
                            <TableHead>{t('payment.date')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPayments.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
                          ) : allPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.amount}</TableCell>
                              <TableCell className="text-muted-foreground">{p.label}</TableCell>
                              <TableCell>{format(new Date(p.created_at), 'PPP h:mm a')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </>
            )}
          </TabsContent>

          {/* ===== NEXT VISIT TAB ===== */}
          <TabsContent value="next" className="space-y-4 mt-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.doctor')} *</label>
              <Select value={nextDoctor} onValueChange={setNextDoctor}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('payment.date')}</label>
              <Popover open={nextDateOpen} onOpenChange={setNextDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-start">
                    <CalendarIcon className="me-2 h-4 w-4" />
                    {format(nextDate, 'EEEE, MMMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={nextDate} onSelect={(d) => { if (d) { setNextDate(d); setNextDateOpen(false); } }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.time')} *</label>
              <Select value={nextTime} onValueChange={setNextTime}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(slot => <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleScheduleNext} disabled={schedulingNext || !nextDoctor || !nextTime} className="w-full">
              <Plus className="me-2 h-4 w-4" />
              {schedulingNext ? t('common.loading') : t('edit.scheduleNext')}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditAppointmentModal;
