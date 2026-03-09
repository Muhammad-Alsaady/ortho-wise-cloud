import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Users, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const invokeManageUser = async (body: Record<string, any>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/manage-user`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const SuperAdmin: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [clinics, setClinics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  // Clinic modal
  const [clinicModal, setClinicModal] = useState(false);
  const [editingClinic, setEditingClinic] = useState<any>(null);
  const [clinicForm, setClinicForm] = useState({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' });

  // User modal
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '', clinic_id: '', role: 'reception' as string });

  const fetchClinics = useCallback(async () => {
    try {
      const data = await invokeManageUser({ action: 'list_clinics' });
      setClinics(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const fetchUsers = useCallback(async (clinicId?: string) => {
    try {
      const data = await invokeManageUser({ action: 'list_users', clinic_id: clinicId || undefined });
      setUsers(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([fetchClinics(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchClinics, fetchUsers]);

  const handleSaveClinic = async () => {
    try {
      if (editingClinic) {
        await invokeManageUser({ action: 'update_clinic', id: editingClinic.id, ...clinicForm });
      } else {
        await invokeManageUser({ action: 'create_clinic', ...clinicForm });
      }
      toast({ title: editingClinic ? 'Clinic updated' : 'Clinic created' });
      setClinicModal(false);
      setEditingClinic(null);
      setClinicForm({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' });
      fetchClinics();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!userForm.email || !userForm.password || !userForm.name || !userForm.clinic_id) {
        toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
        return;
      }
      await invokeManageUser({ action: 'create_user', ...userForm });
      toast({ title: 'User created successfully' });
      setUserModal(false);
      setUserForm({ email: '', password: '', name: '', clinic_id: '', role: 'reception' });
      fetchUsers(selectedClinicId || undefined);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEditClinic = (clinic: any) => {
    setEditingClinic(clinic);
    setClinicForm({
      name: clinic.name,
      address: clinic.address || '',
      phone: clinic.phone || '',
      license_expiry: clinic.license_expiry ? clinic.license_expiry.slice(0, 10) : '',
      plan_type: clinic.plan_type || 'basic',
    });
    setClinicModal(true);
  };

  const filteredUsers = selectedClinicId ? users.filter(u => u.clinic_id === selectedClinicId) : users;

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin': return 'destructive';
      case 'admin': return 'default';
      case 'doctor': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="clinics">
        <TabsList>
          <TabsTrigger value="clinics">
            <Building2 className="me-2 h-4 w-4" />
            Clinics
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="me-2 h-4 w-4" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Clinics</CardTitle>
              <Button onClick={() => { setEditingClinic(null); setClinicForm({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' }); setClinicModal(true); }}>
                <Plus className="me-2 h-4 w-4" />Add Clinic
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>{t('reception.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinics.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{c.plan_type || 'basic'}</Badge></TableCell>
                      <TableCell>{c.license_expiry ? new Date(c.license_expiry).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openEditClinic(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clinics.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No clinics yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Users</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={selectedClinicId} onValueChange={(v) => { setSelectedClinicId(v === 'all' ? '' : v); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All clinics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clinics</SelectItem>
                    {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setUserForm({ email: '', password: '', name: '', clinic_id: selectedClinicId || '', role: 'reception' }); setUserModal(true); }}>
                  <Plus className="me-2 h-4 w-4" />Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('patients.name')}</TableHead>
                    <TableHead>{t('auth.email')}</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Clinic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => {
                    const roles = Array.isArray(u.user_roles) ? u.user_roles : [];
                    const clinicName = clinics.find(c => c.id === u.clinic_id)?.name || '—';
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {roles.map((r: any, i: number) => (
                            <Badge key={i} variant={getRoleBadgeVariant(r.role)} className="me-1">{r.role}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>{clinicName}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clinic Modal */}
      <Dialog open={clinicModal} onOpenChange={setClinicModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClinic ? 'Edit Clinic' : 'Add Clinic'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Clinic Name *</label>
              <Input value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input value={clinicForm.address} onChange={e => setClinicForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input value={clinicForm.phone} onChange={e => setClinicForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Type</label>
                <Select value={clinicForm.plan_type} onValueChange={v => setClinicForm(f => ({ ...f, plan_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">License Expiry</label>
                <Input type="date" value={clinicForm.license_expiry} onChange={e => setClinicForm(f => ({ ...f, license_expiry: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setClinicModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveClinic} disabled={!clinicForm.name}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Modal */}
      <Dialog open={userModal} onOpenChange={setUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('patients.name')} *</label>
              <Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.email')} *</label>
              <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.password')} *</label>
              <Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Clinic *</label>
                <Select value={userForm.clinic_id} onValueChange={v => setUserForm(f => ({ ...f, clinic_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select clinic" /></SelectTrigger>
                  <SelectContent>
                    {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role *</label>
                <Select value={userForm.role} onValueChange={v => setUserForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUserModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreateUser}>Create User</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
