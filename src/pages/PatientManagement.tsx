import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit, Eye } from 'lucide-react';
import PatientModal from '@/components/modals/PatientModal';
import PatientProfileModal from '@/components/modals/PatientProfileModal';

const PatientManagement: React.FC = () => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editPatient, setEditPatient] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [profilePatient, setProfilePatient] = useState<any>(null);

  const fetchPatients = async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    setPatients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPatients(); }, [clinicId]);

  const filtered = useMemo(() => {
    if (!search) return patients;
    const q = search.toLowerCase();
    return patients.filter(p => p.name?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [patients, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('patients.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10" />
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('patients.addPatient')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('patients.name')}</TableHead>
                <TableHead>{t('patients.phone')}</TableHead>
                <TableHead>{t('patients.age')}</TableHead>
                <TableHead>{t('patients.notes')}</TableHead>
                <TableHead>{t('reception.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('patients.noPatients')}</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{p.notes}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setProfilePatient(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditPatient(p)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(showAdd || editPatient) && (
        <PatientModal
          open={showAdd || !!editPatient}
          patient={editPatient}
          onClose={() => { setShowAdd(false); setEditPatient(null); fetchPatients(); }}
        />
      )}

      {profilePatient && (
        <PatientProfileModal
          open={!!profilePatient}
          patient={profilePatient}
          onClose={() => setProfilePatient(null)}
        />
      )}
    </div>
  );
};

export default PatientManagement;
