import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { checkAuthError } from '@/lib/api';

interface Props {
  open: boolean;
  patient?: any;
  onClose: () => void;
}

const PatientModal: React.FC<Props> = ({ open, patient, onClose }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState(patient?.name || '');
  const [phone, setPhone] = useState(patient?.phone || '');
  const [age, setAge] = useState(patient?.age?.toString() || '');
  const [notes, setNotes] = useState(patient?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clinicId || !name) return;
    setSaving(true);

    try {
      const payload = { name, phone, age: age ? Number(age) : null, notes };

      if (patient) {
        const { error } = await supabase.from('patients').update(payload).eq('id', patient.id);
        if (error) {
          if (checkAuthError(error, 'PatientModal.update')) return;
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
          onClose();
        }
      } else {
        const { error } = await supabase.from('patients').insert({ ...payload, clinic_id: clinicId });
        if (error) {
          if (checkAuthError(error, 'PatientModal.insert')) return;
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      console.error('[PatientModal] handleSave error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{patient ? t('patients.editPatient') : t('patients.addPatient')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patients.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patients.phone')}</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patients.age')}</label>
            <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patients.notes')}</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientModal;
