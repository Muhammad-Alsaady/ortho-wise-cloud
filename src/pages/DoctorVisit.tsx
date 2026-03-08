import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Save, CheckCircle, Upload, ArrowLeft } from 'lucide-react';

const DoctorVisit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useLanguage();
  const { clinicId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [visit, setVisit] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVisit = async () => {
    if (!id) return;
    setLoading(true);

    const { data: visitData } = await supabase
      .from('visits')
      .select(`*, appointment:appointments(*, patient:patients(*))`)
      .eq('id', id)
      .single();

    if (visitData) {
      setVisit(visitData);
      setNotes(visitData.notes || '');
      setPatient(visitData.appointment?.patient);
    }

    const { data: plans } = await supabase
      .from('treatment_plans')
      .select('*, treatment:treatments(name)')
      .eq('visit_id', id);
    setTreatmentPlans(plans || []);

    const { data: imgs } = await supabase
      .from('treatment_images')
      .select('*')
      .in('treatment_plan_id', (plans || []).map(p => p.id).length > 0 ? (plans || []).map(p => p.id) : ['none']);
    setImages(imgs || []);

    if (clinicId) {
      const { data: txs } = await supabase
        .from('treatments')
        .select('*')
        .eq('clinic_id', clinicId);
      setTreatments(txs || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchVisit();
    // Realtime: re-fetch when treatment_plans or payments change
    const channel = supabase
      .channel(`visit-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treatment_plans' }, () => fetchVisit())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchVisit())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, clinicId]);

  const handleAddTreatment = async () => {
    if (!selectedTreatment || !id) return;
    const treatment = treatments.find(t => t.id === selectedTreatment);
    if (!treatment) return;

    const { error } = await supabase.from('treatment_plans').insert({
      visit_id: id,
      treatment_id: treatment.id,
      price: treatment.price,
      discount: 0,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSelectedTreatment('');
      fetchVisit();
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    const { error } = await supabase.from('visits').update({ notes }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('doctor.saveNotes') });
    }
  };

  const handleCompleteVisit = async () => {
    if (!id || !visit) return;
    await supabase.from('visits').update({ status: 'Completed' as const }).eq('id', id);
    await supabase.from('appointments').update({ status: 'Completed' as const }).eq('id', visit.appointment_id);
    toast({ title: t('doctor.completeVisit') });
    navigate('/doctor-queue');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || treatmentPlans.length === 0) return;

    const filePath = `${clinicId}/${id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('treatment-images').upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('treatment-images').getPublicUrl(filePath);

    await supabase.from('treatment_images').insert({
      treatment_plan_id: treatmentPlans[0].id,
      image_url: urlData.publicUrl,
    });

    fetchVisit();
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">{t('common.loading')}</p>;

  const totalBilled = treatmentPlans.reduce((s, p) => s + Number(p.price) - Number(p.discount), 0);

  return (
    <div dir={dir} className="space-y-4 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/doctor-queue')}>
        <ArrowLeft className="me-2 h-4 w-4" />
        {t('doctor.queue')}
      </Button>

      {/* Patient Info */}
      <Card>
        <CardHeader><CardTitle>{t('doctor.patientInfo')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">{t('patients.name')}:</span> <strong>{patient?.name}</strong></div>
            <div><span className="text-muted-foreground">{t('patients.phone')}:</span> <strong>{patient?.phone}</strong></div>
            <div><span className="text-muted-foreground">{t('patients.age')}:</span> <strong>{patient?.age}</strong></div>
            <div><span className="text-muted-foreground">{t('patients.notes')}:</span> {patient?.notes}</div>
          </div>
        </CardContent>
      </Card>

      {/* Treatment Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('doctor.treatmentPlan')}</CardTitle>
            <div className="text-sm font-semibold">{t('doctor.total')}: {totalBilled}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={selectedTreatment} onValueChange={setSelectedTreatment}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                {treatments.map(tx => (
                  <SelectItem key={tx.id} value={tx.id}>{tx.name} - {tx.price}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddTreatment} disabled={!selectedTreatment}>
              <Plus className="me-2 h-4 w-4" />{t('doctor.addTreatment')}
            </Button>
          </div>

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
              {treatmentPlans.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.treatment?.name}</TableCell>
                  <TableCell>{p.price}</TableCell>
                  <TableCell>{p.discount}</TableCell>
                  <TableCell className="font-medium">{Number(p.price) - Number(p.discount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader><CardTitle>{t('doctor.images')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {images.map(img => (
              <img key={img.id} src={img.image_url} alt="" className="h-24 w-24 rounded-lg object-cover border" />
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="text-sm">{t('doctor.uploadImage')}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>{t('doctor.notes')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          <div className="flex gap-2">
            <Button onClick={handleSaveNotes}>
              <Save className="me-2 h-4 w-4" />{t('doctor.saveNotes')}
            </Button>
            {visit?.status !== 'Completed' && (
              <Button variant="destructive" onClick={handleCompleteVisit}>
                <CheckCircle className="me-2 h-4 w-4" />{t('doctor.completeVisit')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorVisit;
