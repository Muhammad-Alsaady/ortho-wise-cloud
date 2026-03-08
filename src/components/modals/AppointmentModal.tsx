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
import { CalendarIcon, Check, Phone, UserCheck, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

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

const AppointmentModal: React.FC<Props> = ({ open, onClose }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Phone lookup
  const [phone, setPhone] = useState('');
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual patient fields (used when not found)
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  // Appointment fields
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Load doctors once
  useEffect(() => {
    if (!clinicId) return;
    supabase.from('profiles').select('id, name, user_id').eq('clinic_id', clinicId).then(async ({ data }) => {
      if (!data) return;
      const doctorProfiles: any[] = [];
      for (const p of data) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', p.user_id);
        if (roles?.some(r => r.role === 'doctor')) doctorProfiles.push(p);
      }
      setDoctors(doctorProfiles);
    });
  }, [clinicId]);

  // Phone number lookup with debounce
  const lookupPatient = useCallback(async (phoneNum: string) => {
    if (!clinicId) return;
    const digits = phoneNum.replace(/\D/g, '');
    if (digits.length < 8) {
      setLookupStatus('idle');
      setFoundPatient(null);
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
      // Fetch last visit date and balance
      let lastVisitDate: string | null = null;
      let balance = 0;

      const { data: balanceData } = await supabase
        .from('patient_balances')
        .select('balance, total_billed, total_paid')
        .eq('patient_id', data.id)
        .maybeSingle();

      if (balanceData) {
        balance = Number(balanceData.balance) || 0;
      }

      // Last visit via appointments
      const { data: lastApt } = await supabase
        .from('appointments')
        .select('appointment_date')
        .eq('patient_id', data.id)
        .order('appointment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastApt) {
        lastVisitDate = lastApt.appointment_date;
      }

      setFoundPatient({
        id: data.id,
        name: data.name,
        phone: data.phone,
        age: data.age,
        notes: data.notes,
        lastVisitDate,
        balance,
      });
      setLookupStatus('found');
    } else {
      setFoundPatient(null);
      setLookupStatus('not_found');
    }
  }, [clinicId]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setLookupStatus('idle');
      setFoundPatient(null);
      return;
    }
    searchTimeout.current = setTimeout(() => lookupPatient(phone), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [phone, lookupPatient]);

  const handleSave = async () => {
    if (!clinicId || !doctorId || !time) return;
    setSaving(true);

    let patientId = foundPatient?.id || null;
    const finalName = foundPatient?.name || patientName.trim();
    const finalPhone = phone.trim();

    if (!finalName) {
      toast({ title: t('patients.name'), description: 'Required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    // If patient not found, create one
    if (!patientId && finalName) {
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

  const canSave = !!doctorId && !!time && (lookupStatus === 'found' || !!patientName.trim());

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reception.newAppointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Phone Number - Primary Lookup */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t('patients.phone')}
            </label>
            <Input
              placeholder="e.g. 05xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              className="text-base"
            />
            {lookupStatus === 'searching' && (
              <p className="text-xs text-muted-foreground animate-pulse">{t('common.loading')}...</p>
            )}
          </div>

          {/* Found Patient Card */}
          {lookupStatus === 'found' && foundPatient && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {t('reception.existingPatientFound') || 'Existing patient found'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('patients.name')}:</span>{' '}
                  <span className="font-medium">{foundPatient.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('patients.age')}:</span>{' '}
                  <span className="font-medium">{foundPatient.age ?? '—'}</span>
                </div>
                {foundPatient.lastVisitDate && (
                  <div>
                    <span className="text-muted-foreground">{t('reception.lastVisit') || 'Last visit'}:</span>{' '}
                    <span className="font-medium">{foundPatient.lastVisitDate}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('reception.remaining')}:</span>{' '}
                  <Badge variant={foundPatient.balance > 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {foundPatient.balance}
                  </Badge>
                </div>
              </div>
              {foundPatient.notes && (
                <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{foundPatient.notes}</p>
              )}
            </div>
          )}

          {/* New Patient Form */}
          {lookupStatus === 'not_found' && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {t('reception.newPatient') || 'New patient — enter details'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('patients.name')} *</label>
                  <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('patients.age')}</label>
                  <Input type="number" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('patients.notes') || 'Notes'}</label>
                <Textarea value={patientNotes} onChange={(e) => setPatientNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          {/* Doctor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.doctor')}</label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
              <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('payment.date')}</label>
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
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.time')}</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {lookupStatus === 'not_found' && <UserPlus className="h-4 w-4 me-1" />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
