import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { UserCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { checkAuthError } from '@/lib/api';

const DoctorQueue: React.FC = () => {
  const { profile, clinicId } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    if (!profile || !clinicId) return;
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('appointments')
        .select(`*, patient:patients(name, phone, age)`)
        .eq('clinic_id', clinicId)
        .eq('doctor_id', profile.id)
        .eq('appointment_date', today)
        .in('status', ['Waiting', 'WithDoctor'])
        .order('appointment_time', { ascending: true });

      if (error) {
        if (checkAuthError(error, 'DoctorQueue.fetchQueue')) return;
        console.error('[DoctorQueue] fetchQueue error:', error);
        toast({ title: 'Error loading queue', description: error.message, variant: 'destructive' });
      } else {
        setQueue(data || []);
      }
    } catch (err: any) {
      console.error('[DoctorQueue] fetchQueue exception:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to load queue', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel('doctor-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, clinicId]);

  const handleAcceptPatient = async (appointment: any) => {
    try {
      await supabase.from('appointments').update({ status: 'WithDoctor' as const }).eq('id', appointment.id);

      const { data: visit, error } = await supabase.from('visits').insert({
        appointment_id: appointment.id,
        clinic_id: appointment.clinic_id,
        doctor_id: appointment.doctor_id,
      }).select().single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      navigate(`/visit/${visit.id}`);
    } catch (err: any) {
      console.error('[DoctorQueue] handleAcceptPatient error:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to start visit', variant: 'destructive' });
    }
  };

  const handleContinueVisit = async (appointment: any) => {
    try {
      const { data: visit, error } = await supabase
        .from('visits')
        .select('id')
        .eq('appointment_id', appointment.id)
        .single();

      if (error) {
        console.error('[DoctorQueue] handleContinueVisit error:', error);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      if (visit) navigate(`/visit/${visit.id}`);
    } catch (err: any) {
      console.error('[DoctorQueue] handleContinueVisit exception:', err);
      toast({ title: 'Error', description: err?.message ?? 'Failed to continue visit', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground col-span-full text-center py-12">{t('common.loading')}</p>
        ) : queue.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-12">{t('doctor.noPatients')}</p>
        ) : queue.map((apt) => (
          <Card key={apt.id} className={cn(
            "transition-all hover:shadow-md",
            apt.status === 'WithDoctor' && "border-primary/50 bg-primary/5"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{apt.patient?.name}</CardTitle>
                <Badge className={cn(
                  'text-xs',
                  apt.status === 'Waiting' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'
                )}>
                  {t(`status.${apt.status}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {apt.appointment_time?.slice(0, 5)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('patients.phone')}: {apt.patient?.phone}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('patients.age')}: {apt.patient?.age}
              </div>

              {apt.status === 'Waiting' ? (
                <Button className="w-full" onClick={() => handleAcceptPatient(apt)}>
                  <UserCheck className="me-2 h-4 w-4" />
                  {t('doctor.startVisit')}
                </Button>
              ) : (
                <Button className="w-full" variant="outline" onClick={() => handleContinueVisit(apt)}>
                  {t('doctor.visit')}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DoctorQueue;
