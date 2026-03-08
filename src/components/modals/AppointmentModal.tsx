import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TIME_SLOTS: string[] = [];
for (let h = 9; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const AppointmentModal: React.FC<Props> = ({ open, onClose }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('patients').select('id, name').eq('clinic_id', clinicId).then(({ data }) => setPatients(data || []));
    supabase.from('profiles').select('id, name, user_id').eq('clinic_id', clinicId).then(async ({ data }) => {
      if (!data) return;
      // Filter to only doctors
      const doctorProfiles: any[] = [];
      for (const p of data) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', p.user_id);
        if (roles?.some(r => r.role === 'doctor')) doctorProfiles.push(p);
      }
      setDoctors(doctorProfiles);
    });
  }, [clinicId]);

  const handleSave = async () => {
    if (!clinicId || !patientId || !doctorId || !time) return;
    setSaving(true);

    const { error } = await supabase.from('appointments').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('reception.newAppointment') });
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reception.newAppointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.patient')}</label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
              <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.doctor')}</label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
              <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

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

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.time')}</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !patientId || !doctorId || !time}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
