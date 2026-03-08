import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Search, UserPlus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const TIME_SLOTS: string[] = [];
for (let h = 9; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PatientResult {
  id: string;
  name: string;
  phone: string | null;
}

const AppointmentModal: React.FC<Props> = ({ open, onClose }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Patient search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Inline patient creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [creatingPatient, setCreatingPatient] = useState(false);

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

  // Debounced patient search
  const searchPatients = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query || query.length < 2 || !clinicId) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    setShowResults(true);

    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('clinic_id', clinicId)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);

      setSearchResults(data || []);
      setSearching(false);
    }, 300);
  }, [clinicId]);

  useEffect(() => {
    searchPatients(searchQuery);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, searchPatients]);

  // Close results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectPatient = (patient: PatientResult) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.name);
    setShowResults(false);
    setShowCreateForm(false);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  const handleCreatePatient = async () => {
    if (!clinicId || !newName) return;
    setCreatingPatient(true);

    const { data, error } = await supabase
      .from('patients')
      .insert({ name: newName, phone: newPhone || null, age: newAge ? Number(newAge) : null, clinic_id: clinicId })
      .select('id, name, phone')
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data) {
      handleSelectPatient(data);
      toast({ title: t('patients.addPatient'), description: newName });
      setNewName('');
      setNewPhone('');
      setNewAge('');
    }
    setCreatingPatient(false);
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
    setShowResults(false);
    // Pre-fill with the search query
    const q = searchQuery.trim();
    if (/^\d+$/.test(q)) {
      setNewPhone(q);
      setNewName('');
    } else {
      setNewName(q);
      setNewPhone('');
    }
  };

  const handleSave = async () => {
    if (!clinicId || !doctorId || !time) return;
    if (!selectedPatient && !searchQuery.trim()) return;
    setSaving(true);

    const payload: any = {
      clinic_id: clinicId,
      doctor_id: doctorId,
      appointment_date: format(date, 'yyyy-MM-dd'),
      appointment_time: time,
      patient_id: selectedPatient?.id || null,
      patient_name: selectedPatient?.name || searchQuery.trim(),
      patient_phone: selectedPatient?.phone || null,
    };

    const { error } = await supabase.from('appointments').insert(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('reception.newAppointment') });
      onClose();
    }
    setSaving(false);
  };

  const canSave = !!doctorId && !!time && (!!selectedPatient || !!searchQuery.trim());

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reception.newAppointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Patient Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reception.patient')}</label>
            <div className="relative" ref={resultsRef}>
              {selectedPatient ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{selectedPatient.name}</span>
                  {selectedPatient.phone && (
                    <span className="text-xs text-muted-foreground">{selectedPatient.phone}</span>
                  )}
                  <button onClick={handleClearPatient} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('reception.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-10"
                    autoFocus
                  />
                </>
              )}

              {/* Search Results Dropdown */}
              {showResults && !selectedPatient && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
                  {searching ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPatient(p)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors text-start"
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                        </button>
                      ))}
                      <div className="border-t">
                        <button
                          onClick={handleShowCreateForm}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
                        >
                          <UserPlus className="h-4 w-4" />
                          {t('patients.addPatient')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground mb-2">{t('reception.noAppointments')}</p>
                      <Button size="sm" variant="outline" onClick={handleShowCreateForm} className="w-full">
                        <UserPlus className="h-4 w-4 me-2" />
                        {t('patients.addPatient')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inline Patient Creation Form */}
          {showCreateForm && !selectedPatient && (
            <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
              <p className="text-sm font-medium text-primary">{t('patients.addPatient')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('patients.name')}</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('patients.phone')}</label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('patients.age')}</label>
                  <Input type="number" value={newAge} onChange={(e) => setNewAge(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={handleCreatePatient} disabled={creatingPatient || !newName} className="flex-1">
                    <Check className="h-3 w-3 me-1" />
                    {t('common.save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
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
            <Button onClick={handleSave} disabled={saving || !canSave}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
