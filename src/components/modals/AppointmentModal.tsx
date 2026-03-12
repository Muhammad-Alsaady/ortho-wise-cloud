import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { format } from 'date-fns';
import { CalendarIcon, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { checkAuthError } from '@/lib/api';

const TIME_SLOTS: string[] = [];
for (let h = 9; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FoundPatient {
  id: string;
  name: string;
  phone: string | null;
  age: number | null;
  notes: string | null;
  lastVisitDate: string | null;
  balance: number;
}

interface FieldErrors {
  patientName?: string;
  phone?: string;
  doctorId?: string;
  time?: string;
}

const AppointmentModal: React.FC<Props> = ({ open, onClose }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Patient fields — always visible
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  // Lookup state
  const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found'>('idle');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Appointment fields
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Validation
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPatientName('');
      setPhone('');
      setPatientAge('');
      setPatientNotes('');
      setFoundPatient(null);
      setLookupStatus('idle');
      setDoctorId('');
      setDate(new Date());
      setTime('');
      setErrors({});
      setSubmitted(false);
    }
  }, [open]);

// Load doctors for the clinic
useEffect(() => {
  if (!clinicId) {
    console.warn('[AppointmentModal] clinicId is null — cannot fetch doctors');
    setDoctorsError('Clinic not loaded yet. Try closing and reopening this dialog.');
    return;
  }

  const fetchDoctors = async () => {
    setDoctorsLoading(true);
    setDoctorsError(null);

    console.log('[AppointmentModal] Fetching doctors for clinicId:', clinicId);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          user_id,
          user_roles!inner(role)
        `)
        .eq('clinic_id', clinicId)
        .eq('user_roles.role', 'doctor');

      if (error) {
        if (checkAuthError(error, 'AppointmentModal.fetchDoctors')) return;

        console.error('[AppointmentModal] Error fetching doctors:', error);
        setDoctorsError(`Failed to load doctors: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[AppointmentModal] No doctors found for clinic:', clinicId);
        setDoctors([]);
        setDoctorsError('No doctors found in this clinic');
        return;
      }

      console.log('[AppointmentModal] Doctors loaded:', data);

      setDoctors(data);
    } catch (err: any) {
      console.error('[AppointmentModal] Unexpected error fetching doctors:', err);
      setDoctorsError('Unexpected error loading doctors');
    } finally {
      setDoctorsLoading(false);
    }
  };

  fetchDoctors();
}, [clinicId]);

  // Phone lookup with debounce — auto-populates patient fields
  const lookupPatient = useCallback(async (phoneNum: string) => {
    if (!clinicId) return;
    const digits = phoneNum.replace(/\D/g, '');
    if (digits.length < 8) {
      if (foundPatient) {
        setFoundPatient(null);
        setLookupStatus('idle');
      }
      return;
    }

    setLookupStatus('searching');

    const { data } = await supabase
      .from('patients')
      .select('id, name, phone, age, notes')
      .eq('clinic_id', clinicId)
      .ilike('phone', `%${digits.slice(-8)}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      let lastVisitDate: string | null = null;
      let balance = 0;

      const { data: balanceData } = await supabase
        .from('patient_balances')
        .select('balance')
        .eq('patient_id', data.id)
        .maybeSingle();

      if (balanceData) balance = Number(balanceData.balance) || 0;

      const { data: lastApt } = await supabase
        .from('appointments')
        .select('appointment_date')
        .eq('patient_id', data.id)
        .order('appointment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastApt) lastVisitDate = lastApt.appointment_date;

      const found: FoundPatient = {
        id: data.id,
        name: data.name,
        phone: data.phone,
        age: data.age,
        notes: data.notes,
        lastVisitDate,
        balance,
      };

      setFoundPatient(found);
      setLookupStatus('found');

      // Auto-populate fields
      setPatientName(data.name);
      setPatientAge(data.age != null ? String(data.age) : '');
      setPatientNotes(data.notes || '');
    } else {
      setFoundPatient(null);
      setLookupStatus('idle');
    }
  }, [clinicId, foundPatient]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      // Only clear found patient if phone changed significantly
      if (foundPatient) {
        setFoundPatient(null);
        setLookupStatus('idle');
      }
      return;
    }
    searchTimeout.current = setTimeout(() => lookupPatient(phone), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!patientName.trim()) errs.patientName = t('patients.name') + ' ' + (t('common.required') || 'required');
    if (!doctorId) errs.doctorId = t('reception.doctor') + ' ' + (t('common.required') || 'required');
    if (!time) errs.time = t('reception.time') + ' ' + (t('common.required') || 'required');
    return errs;
  };

  const handleSave = async () => {
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (!clinicId) return;
    setSaving(true);

    let patientId = foundPatient?.id || null;
    const finalName = patientName.trim();
    const finalPhone = phone.trim();

    // Create patient if not found
    if (!patientId) {
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          name: finalName,
          phone: finalPhone || null,
          age: patientAge ? Number(patientAge) : null,
          notes: patientNotes || null,
          clinic_id: clinicId,
        })
        .select('id')
        .single();

      if (patientError) {
        toast({ title: 'Error', description: patientError.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      patientId = newPatient.id;
    }

    const { error } = await supabase.from('appointments').insert({
      clinic_id: clinicId,
      doctor_id: doctorId,
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
      patient_id: patientId,
      patient_name: finalName,
      patient_phone: finalPhone || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('reception.newAppointment') });
      onClose();
    }
    setSaving(false);
  };

  // Clear specific error when user fixes it
  useEffect(() => {
    if (!submitted) return;
    setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientName, doctorId, time, submitted]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('reception.newAppointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Found patient banner */}
          {lookupStatus === 'found' && foundPatient && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {t('reception.existingPatientFound') || 'Existing patient found'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {foundPatient.lastVisitDate && (
                  <span>{t('reception.lastVisit') || 'Last visit'}: <strong>{foundPatient.lastVisitDate}</strong></span>
                )}
                <span>
                  {t('reception.remaining') || 'Balance'}:{' '}
                  <Badge variant={foundPatient.balance > 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {foundPatient.balance}
                  </Badge>
                </span>
              </div>
            </div>
          )}

          {lookupStatus === 'searching' && (
            <p className="text-xs text-muted-foreground animate-pulse">{t('common.loading')}...</p>
          )}

          {/* Patient Info Section */}
          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            <legend className="px-2 text-sm font-semibold text-foreground">
              {t('patients.name') ? t('reception.patientInfo') || 'Patient Info' : 'Patient Info'}
            </legend>

            <div className="grid grid-cols-2 gap-3">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('patients.name')} *</label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className={cn(errors.patientName && 'border-destructive ring-destructive/30 ring-2')}
                  readOnly={!!foundPatient}
                />
                {errors.patientName && <p className="text-xs text-destructive">{errors.patientName}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('patients.phone')}</label>
                <Input
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Age */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('patients.age')}</label>
                <Input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  readOnly={!!foundPatient}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('patients.notes') || 'Notes'}</label>
              <Textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={2}
                readOnly={!!foundPatient}
              />
            </div>
          </fieldset>

          {/* Appointment Info Section */}
          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            <legend className="px-2 text-sm font-semibold text-foreground">
              {t('reception.appointmentInfo') || 'Appointment Info'}
            </legend>

            {/* Doctor */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.doctor')} *</label>
              <Select value={doctorId} onValueChange={setDoctorId} disabled={doctorsLoading}>
                <SelectTrigger className={cn(errors.doctorId && 'border-destructive ring-destructive/30 ring-2')}>
                  <SelectValue placeholder={doctorsLoading ? "Loading doctors..." : t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {doctorsLoading && <p className="text-xs text-muted-foreground">Loading doctors...</p>}
              {doctorsError && <p className="text-xs text-destructive">{doctorsError}</p>}
              {!doctorsLoading && !doctorsError && doctors.length === 0 && (
                <p className="text-xs text-amber-600">No doctors available in this clinic</p>
              )}
              {errors.doctorId && <p className="text-xs text-destructive">{errors.doctorId}</p>}
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('payment.date')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-start")}>
                    <CalendarIcon className="me-2 h-4 w-4" />
                    {format(date, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reception.time')} *</label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className={cn(errors.time && 'border-destructive ring-destructive/30 ring-2')}>
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
