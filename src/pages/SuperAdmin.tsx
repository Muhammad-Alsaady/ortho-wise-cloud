import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Users, Edit, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { invokeManageUser } from '@/lib/api';

const SuperAdmin: React.FC = () => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [clinics, setClinics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  const [clinicModal, setClinicModal] = useState(false);
  const [editingClinic, setEditingClinic] = useState<any>(null);
  const [clinicForm, setClinicForm] = useState({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' });

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '', clinic_id: '', role: 'admin' });

  const fetchClinics = async () => {
    try {
      const data = await invokeManageUser({ action: 'list_clinics' });
      setClinics(data);
    } catch (err: any) {
      console.error('fetchClinics error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const fetchUsers = async (filterClinicId?: string) => {
    try {
      const data = await invokeManageUser({ action: 'list_users', clinic_id: filterClinicId || undefined });
      setUsers(data);
    } catch (err: any) {
      console.error('fetchUsers error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    Promise.all([fetchClinics(), fetchUsers()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveClinic = async () => {
    try {
      if (editingClinic) {
        await invokeManageUser({ action: 'update_clinic', id: editingClinic.id, ...clinicForm });
        toast({ title: 'Clinic updated' });
      } else {
        await invokeManageUser({ action: 'create_clinic', ...clinicForm });
        toast({ title: 'Clinic created' });
      }
      setClinicModal(false);
      setEditingClinic(null);
      setClinicForm({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' });
      fetchClinics();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateAdmin = async () => {
    try {
      if (!userForm.email || !userForm.password || !userForm.name || !userForm.clinic_id) {
        toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
        return;
      }
      await invokeManageUser({ action: 'create_user', ...userForm, role: 'admin' });
      toast({ title: 'Admin user created successfully' });
      setUserModal(false);
      setUserForm({ email: '', password: '', name: '', clinic_id: '', role: 'admin' });
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const filteredUsers = selectedClinicId ? users.filter(u => u.clinic_id === selectedClinicId) : users;

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin': return 'destructive' as const;
      case 'admin': return 'default' as const;
      case 'doctor': return 'secondary' as const;
      default: return 'outline' as const;
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
          <TabsTrigger value="clinics"><Building2 className="me-2 h-4 w-4" />Clinics</TabsTrigger>
          <TabsTrigger value="users"><Users className="me-2 h-4 w-4" />Admin Users</TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Clinics (Tenants)</CardTitle>
              <Button onClick={() => { setEditingClinic(null); setClinicForm({ name: '', address: '', phone: '', license_expiry: '', plan_type: 'basic' }); setClinicModal(true); }}>
                <Plus className="me-2 h-4 w-4" />Add Clinic
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant ID</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{c.id.slice(0, 8)}…</code>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(c.id)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
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
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No clinics yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Clinic Admin Users</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={selectedClinicId} onValueChange={(v) => setSelectedClinicId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All clinics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clinics</SelectItem>
                    {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setUserForm({ email: '', password: '', name: '', clinic_id: selectedClinicId || '', role: 'admin' }); setUserModal(true); }}>
                  <Plus className="me-2 h-4 w-4" />Add Admin
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
                    <TableHead>Tenant ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => {
                    const userRoles = Array.isArray(u.user_roles) ? u.user_roles : [];
                    const clinicName = clinics.find(c => c.id === u.clinic_id)?.name || '—';
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {userRoles.map((r: any, i: number) => (
                            <Badge key={i} variant={getRoleBadgeVariant(r.role)} className="me-1">{r.role}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>{clinicName}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{u.clinic_id?.slice(0, 8)}…</code>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
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
            {editingClinic && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tenant ID</label>
                <div className="flex items-center gap-2">
                  <Input value={editingClinic.id} readOnly className="font-mono text-xs bg-muted" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(editingClinic.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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

      {/* Admin User Modal */}
      <Dialog open={userModal} onOpenChange={setUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Clinic Admin</DialogTitle>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Clinic *</label>
              <Select value={userForm.clinic_id} onValueChange={v => setUserForm(f => ({ ...f, clinic_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select clinic" /></SelectTrigger>
                <SelectContent>
                  {clinics.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-muted-foreground ms-2 text-xs">({c.id.slice(0, 8)}…)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUserModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreateAdmin}>Create Admin</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
