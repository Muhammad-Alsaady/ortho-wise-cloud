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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Download, UserPlus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AuditLogs from '@/components/AuditLogs';
import { callManageUser, checkAuthError } from '@/lib/api';
import { logInfo, logError } from '@/lib/logService';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['doctor', 'reception']),
});

const AdminPanel: React.FC = () => {
  const { clinicId, role } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [receptionists, setReceptionists] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [appointmentFee, setAppointmentFee] = useState('0');
  const [savingSettings, setSavingSettings] = useState(false);
  // Superadmin clinic selection
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  
  // Use selected clinic for superadmin, or user's clinic for regular admin
  const effectiveClinicId = role === 'superadmin' ? selectedClinicId : clinicId;

  // Treatment modal
  const [treatmentModal, setTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<any>(null);
  const [treatmentName, setTreatmentName] = useState('');
  const [treatmentPrice, setTreatmentPrice] = useState('');

  // Delete treatment
  const [deleteTreatmentTarget, setDeleteTreatmentTarget] = useState<any>(null);
  const [deleteTreatmentLoading, setDeleteTreatmentLoading] = useState(false);

  // User modal
  const [userModal, setUserModal] = useState(false);
  const userFormMethods = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', password: '', role: 'doctor' },
  });

  // Deactivate user
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Fetch clinics for superadmin
  const fetchClinics = async () => {
    if (role !== 'superadmin') return;
    try {
      const { data, error } = await supabase.from('clinics').select('*').order('name');
      if (error) throw error;
      setClinics(data || []);
      // Auto-select first clinic if none selected
      if (!selectedClinicId && data && data.length > 0) {
        setSelectedClinicId(data[0].id);
      }
    } catch (err: any) {
      console.error('fetchClinics error:', err);
      toast({ title: 'Error loading clinics', description: err.message, variant: 'destructive' });
    }
  };

  const fetchData = async () => {
    if (!effectiveClinicId) return;
    setLoading(true);

    try {
      const profiles = await callManageUser('list_users', { clinic_id: effectiveClinicId });
      const docs: any[] = [];
      const recs: any[] = [];
      (profiles || []).forEach((p: any) => {
        const roles = Array.isArray(p.user_roles) ? p.user_roles : [];
        roles.forEach((r: any) => {
          if (r.role === 'doctor') docs.push(p);
          if (r.role === 'reception') recs.push(p);
        });
      });
      setDoctors(docs);
      setReceptionists(recs);
    } catch (err: any) {
      console.error('[AdminPanel] fetchData users error:', err);
      toast({ title: 'Error loading users', description: err?.message ?? 'Failed to load users', variant: 'destructive' });
    }

    try {
      const { data: txs, error } = await supabase
        .from('treatments')
        .select('*')
        .eq('clinic_id', effectiveClinicId)
        .order('name');
      if (error) {
        if (checkAuthError(error, 'AdminPanel.treatments')) return;
        console.error('[AdminPanel] treatments fetch error:', error);
      }
      setTreatments(txs || []);
    } catch (err: any) {
      console.error('[AdminPanel] treatments exception:', err);
    }

    setLoading(false);
  };

  useEffect(() => { 
    if (role === 'superadmin') {
      fetchClinics();
    }
  }, [role]);
  
  useEffect(() => {
    fetchData();
  }, [effectiveClinicId]);

  // Load clinic settings whenever the active clinic changes
  useEffect(() => {
    if (!effectiveClinicId) return;
    supabase.from('clinics').select('appointment_fee').eq('id', effectiveClinicId).single()
      .then(({ data }) => {
        setAppointmentFee(String(data?.appointment_fee ?? 0));
      });
  }, [effectiveClinicId]);

  const handleSaveTreatment = async () => {
    if (!effectiveClinicId || !treatmentName) return;
    try {
      if (editingTreatment) {
        const { error } = await supabase.from('treatments').update({ name: treatmentName, price: Number(treatmentPrice) || 0 }).eq('id', editingTreatment.id);
        if (error) { logError('UPDATE_TREATMENT', 'treatment', error, { treatmentId: editingTreatment.id }); toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
        logInfo('UPDATE_TREATMENT', 'treatment', 'Treatment updated', { treatmentId: editingTreatment.id, name: treatmentName });
      } else {
        const { error } = await supabase.from('treatments').insert({ clinic_id: effectiveClinicId, name: treatmentName, price: Number(treatmentPrice) || 0 });
        if (error) { logError('CREATE_TREATMENT', 'treatment', error); toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
        logInfo('CREATE_TREATMENT', 'treatment', 'Treatment created', { name: treatmentName, price: Number(treatmentPrice) || 0 });
      }
      setTreatmentModal(false);
      setEditingTreatment(null);
      setTreatmentName('');
      setTreatmentPrice('');
      fetchData();
    } catch (err: any) {
      logError('SAVE_TREATMENT', 'treatment', err);
      console.error('[AdminPanel] handleSaveTreatment error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to save treatment', variant: 'destructive' });
    }
  };

  const openEditTreatment = (tx: any) => {
    setEditingTreatment(tx);
    setTreatmentName(tx.name);
    setTreatmentPrice(String(tx.price));
    setTreatmentModal(true);
  };

  const handleDeleteTreatment = async () => {
    if (!deleteTreatmentTarget) return;
    setDeleteTreatmentLoading(true);
    try {
      const { error } = await supabase.from('treatments').delete().eq('id', deleteTreatmentTarget.id);
      if (error) {
        logError('DELETE_TREATMENT', 'treatment', error, { treatmentId: deleteTreatmentTarget.id });
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        logInfo('DELETE_TREATMENT', 'treatment', 'Treatment deleted', { treatmentId: deleteTreatmentTarget.id, name: deleteTreatmentTarget.name });
        fetchData();
      }
    } catch (err: any) {
      logError('DELETE_TREATMENT', 'treatment', err, { treatmentId: deleteTreatmentTarget.id });
      console.error('[AdminPanel] handleDeleteTreatment error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteTreatmentLoading(false);
      setDeleteTreatmentTarget(null);
    }
  };

  const handleCreateUser = async (values: z.infer<typeof userSchema>) => {
    if (!effectiveClinicId) return;
    try {
      await callManageUser('create_user', {
        email: values.email,
        password: values.password,
        name: values.name,
        clinic_id: effectiveClinicId,
        role: values.role,
      });
      logInfo('CREATE_USER', 'auth', `${values.role} user created`, { email: values.email, role: values.role });
      toast({ title: `${values.role === 'doctor' ? 'Doctor' : 'Receptionist'} created successfully` });
      setUserModal(false);
      userFormMethods.reset();
      fetchData();
    } catch (err: any) {
      logError('CREATE_USER', 'auth', err, { email: values.email, role: values.role });
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeactivateUser = async () => {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await callManageUser('delete_user', { user_id: deactivateTarget.user_id });
      logInfo('DEACTIVATE_USER', 'auth', 'User deactivated', { userId: deactivateTarget.user_id, name: deactivateTarget.name });
      toast({ title: t('admin.userDeactivated') });
      fetchData();
    } catch (err: any) {
      logError('DEACTIVATE_USER', 'auth', err, { userId: deactivateTarget.user_id });
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setDeactivateLoading(false);
    setDeactivateTarget(null);
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

  const handleSaveSettings = async () => {
    if (!effectiveClinicId) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from('clinics')
      .update({ appointment_fee: Number(appointmentFee) || 0 })
      .eq('id', effectiveClinicId);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: t('admin.settingsSaved') });
    setSavingSettings(false);
  };

  return (
    <div className="space-y-4">
      {effectiveClinicId && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <span className="text-sm font-medium text-muted-foreground">Tenant ID:</span>
            <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{effectiveClinicId}</code>
          </CardContent>
        </Card>
      )}

      {role === 'superadmin' && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Select Clinic:</span>
              <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Choose a clinic to manage" />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-muted-foreground ms-2 text-xs">({c.id.slice(0, 8)}…)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {!effectiveClinicId && role === 'superadmin' ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Please select a clinic to manage its data.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="treatments">
          <TabsList>
            <TabsTrigger value="treatments">{t('admin.treatments')}</TabsTrigger>
            <TabsTrigger value="doctors">{t('admin.doctors')}</TabsTrigger>
            <TabsTrigger value="receptionists">{t('admin.receptionists')}</TabsTrigger>
            <TabsTrigger value="audit">{t('admin.auditLogs')}</TabsTrigger>
            <TabsTrigger value="backup">{t('admin.backup')}</TabsTrigger>
            <TabsTrigger value="settings">{t('admin.settings')}</TabsTrigger>
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
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditTreatment(tx)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTreatmentTarget(tx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('admin.doctors')}</CardTitle>
              <Button onClick={() => { userFormMethods.reset({ name: '', email: '', password: '', role: 'doctor' }); setUserModal(true); }}>
                <UserPlus className="me-2 h-4 w-4" />{t('admin.addDoctor')}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t('patients.name')}</TableHead><TableHead>{t('auth.email')}</TableHead><TableHead>{t('reception.actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {doctors.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.email}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeactivateTarget(d)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {doctors.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receptionists" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('admin.receptionists')}</CardTitle>
              <Button onClick={() => { userFormMethods.reset({ name: '', email: '', password: '', role: 'reception' }); setUserModal(true); }}>
                <UserPlus className="me-2 h-4 w-4" />{t('admin.addReceptionist')}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t('patients.name')}</TableHead><TableHead>{t('auth.email')}</TableHead><TableHead>{t('reception.actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {receptionists.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeactivateTarget(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {receptionists.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
                  )}
                </TableBody>
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

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.settings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.appointmentFee')}</label>
                <p className="text-xs text-muted-foreground">{t('admin.appointmentFeeDesc')}</p>
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    type="number"
                    min="0"
                    value={appointmentFee}
                    onChange={(e) => setAppointmentFee(e.target.value)}
                  />
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? t('common.loading') : t('common.save')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* Treatment Modal */}
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

      {/* Create User Modal */}
      <Dialog open={userModal} onOpenChange={setUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userFormMethods.watch('role') === 'doctor' ? t('admin.addDoctor') : t('admin.addReceptionist')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={userFormMethods.handleSubmit(handleCreateUser)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('patients.name')} *</label>
              <Input {...userFormMethods.register('name')} />
              {userFormMethods.formState.errors.name && <p className="text-sm text-destructive">{userFormMethods.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.email')} *</label>
              <Input type="email" {...userFormMethods.register('email')} />
              {userFormMethods.formState.errors.email && <p className="text-sm text-destructive">{userFormMethods.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.password')} *</label>
              <Input type="password" {...userFormMethods.register('password')} />
              {userFormMethods.formState.errors.password && <p className="text-sm text-destructive">{userFormMethods.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={userFormMethods.watch('role')} onValueChange={v => userFormMethods.setValue('role', v as 'doctor' | 'reception')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">{t('admin.doctors')}</SelectItem>
                  <SelectItem value="reception">{t('admin.receptionists')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserModal(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Treatment Confirmation */}
      <AlertDialog open={!!deleteTreatmentTarget} onOpenChange={() => setDeleteTreatmentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.deleteTreatment')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.deleteTreatmentConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTreatment} disabled={deleteTreatmentLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteTreatmentLoading ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate User Confirmation */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.deactivateUser')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.deactivateUserConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateUser} disabled={deactivateLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deactivateLoading ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
