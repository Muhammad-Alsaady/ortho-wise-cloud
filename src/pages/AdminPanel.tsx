import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Download } from 'lucide-react';
import AuditLogs from '@/components/AuditLogs';

const AdminPanel: React.FC = () => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [receptionists, setReceptionists] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const [treatmentModal, setTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<any>(null);
  const [treatmentName, setTreatmentName] = useState('');
  const [treatmentPrice, setTreatmentPrice] = useState('');

  const fetchData = async () => {
    if (!clinicId) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*, user_roles(role)')
      .eq('clinic_id', clinicId);

    const docs: any[] = [];
    const recs: any[] = [];
    (profiles || []).forEach(p => {
      const roles = (p as any).user_roles;
      if (Array.isArray(roles)) {
        roles.forEach((r: any) => {
          if (r.role === 'doctor') docs.push(p);
          if (r.role === 'reception') recs.push(p);
        });
      }
    });
    setDoctors(docs);
    setReceptionists(recs);

    const { data: txs } = await supabase
      .from('treatments')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name');
    setTreatments(txs || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clinicId]);

  const handleSaveTreatment = async () => {
    if (!clinicId || !treatmentName) return;
    if (editingTreatment) {
      const { error } = await supabase.from('treatments').update({ name: treatmentName, price: Number(treatmentPrice) || 0 }).eq('id', editingTreatment.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('treatments').insert({ clinic_id: clinicId, name: treatmentName, price: Number(treatmentPrice) || 0 });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    setTreatmentModal(false);
    setEditingTreatment(null);
    setTreatmentName('');
    setTreatmentPrice('');
    fetchData();
  };

  const openEditTreatment = (tx: any) => {
    setEditingTreatment(tx);
    setTreatmentName(tx.name);
    setTreatmentPrice(String(tx.price));
    setTreatmentModal(true);
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/export-backup`,
        { headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );

      if (!res.ok) throw new Error('Backup failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinic-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('admin.backup') });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setBackupLoading(false);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="treatments">
        <TabsList>
          <TabsTrigger value="treatments">{t('admin.treatments')}</TabsTrigger>
          <TabsTrigger value="doctors">{t('admin.doctors')}</TabsTrigger>
          <TabsTrigger value="receptionists">{t('admin.receptionists')}</TabsTrigger>
          <TabsTrigger value="audit">{t('admin.auditLogs')}</TabsTrigger>
          <TabsTrigger value="backup">{t('admin.backup')}</TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('admin.treatments')}</CardTitle>
              <Button onClick={() => { setEditingTreatment(null); setTreatmentName(''); setTreatmentPrice(''); setTreatmentModal(true); }}>
                <Plus className="me-2 h-4 w-4" />{t('admin.addTreatment')}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.treatmentName')}</TableHead>
                    <TableHead>{t('admin.price')}</TableHead>
                    <TableHead>{t('reception.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.name}</TableCell>
                      <TableCell>{tx.price}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openEditTreatment(tx)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('admin.doctors')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t('patients.name')}</TableHead><TableHead>{t('auth.email')}</TableHead></TableRow></TableHeader>
                <TableBody>{doctors.map(d => <TableRow key={d.id}><TableCell className="font-medium">{d.name}</TableCell><TableCell>{d.email}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receptionists" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('admin.receptionists')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t('patients.name')}</TableHead><TableHead>{t('auth.email')}</TableHead></TableRow></TableHeader>
                <TableBody>{receptionists.map(r => <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.email}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogs />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.backup')}</CardTitle>
              <CardDescription>{t('admin.backupDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBackup} disabled={backupLoading}>
                <Download className="me-2 h-4 w-4" />
                {backupLoading ? t('common.loading') : t('admin.downloadBackup')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={treatmentModal} onOpenChange={setTreatmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTreatment ? t('admin.editTreatment') : t('admin.addTreatment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.treatmentName')}</label>
              <Input value={treatmentName} onChange={(e) => setTreatmentName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.price')}</label>
              <Input type="number" value={treatmentPrice} onChange={(e) => setTreatmentPrice(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTreatmentModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveTreatment}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
