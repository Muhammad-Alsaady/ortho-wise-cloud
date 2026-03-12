import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon, TrendingUp, DollarSign, Activity, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkAuthError } from '@/lib/api';

const COLORS = ['hsl(174, 62%, 38%)', 'hsl(210, 30%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(142, 71%, 45%)', 'hsl(270, 50%, 50%)'];

const Reports: React.FC = () => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctors, setDoctors] = useState<any[]>([]);

  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [doctorPerf, setDoctorPerf] = useState<any[]>([]);
  const [treatmentPop, setTreatmentPop] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('profiles').select('id, name, user_id').eq('clinic_id', clinicId).then(async ({ data, error }) => {
      if (error) {
        console.error('[Reports] doctor fetch error:', error);
        return;
      }
      if (!data) return;
      const docs: any[] = [];
      for (const p of data) {
        try {
          const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', p.user_id);
          if (roles?.some(r => r.role === 'doctor')) docs.push(p);
        } catch (err) {
          console.error('[Reports] role fetch error for', p.user_id, err);
        }
      }
      setDoctors(docs);
    }).catch(err => console.error('[Reports] doctors fetch exception:', err));
  }, [clinicId]);

  const fetchReports = async () => {
    if (!clinicId) return;
    setLoading(true);

    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd');

    try {
      const [drRes, mrRes, dpRes, tpRes, pbRes] = await Promise.all([
        supabase.from('daily_revenue').select('*').eq('clinic_id', clinicId).gte('revenue_date', fromStr).lte('revenue_date', toStr).order('revenue_date'),
        supabase.from('monthly_revenue').select('*').eq('clinic_id', clinicId),
        (() => {
          let q = supabase.from('doctor_performance').select('*').eq('clinic_id', clinicId);
          if (doctorFilter !== 'all') q = q.eq('doctor_id', doctorFilter);
          return q;
        })(),
        supabase.from('treatment_popularity').select('*').eq('clinic_id', clinicId).order('usage_count', { ascending: false }),
        supabase.from('patient_balances').select('*').eq('clinic_id', clinicId).gt('balance', 0).order('balance', { ascending: false }),
      ]);

      if (drRes.error) { if (checkAuthError(drRes.error, 'Reports.daily_revenue')) return; console.error('[Reports] daily_revenue error:', drRes.error); }
      if (mrRes.error) { if (checkAuthError(mrRes.error, 'Reports.monthly_revenue')) return; console.error('[Reports] monthly_revenue error:', mrRes.error); }
      if (dpRes.error) { if (checkAuthError(dpRes.error, 'Reports.doctor_performance')) return; console.error('[Reports] doctor_performance error:', dpRes.error); }
      if (tpRes.error) { if (checkAuthError(tpRes.error, 'Reports.treatment_popularity')) return; console.error('[Reports] treatment_popularity error:', tpRes.error); }
      if (pbRes.error) { if (checkAuthError(pbRes.error, 'Reports.patient_balances')) return; console.error('[Reports] patient_balances error:', pbRes.error); }

      setDailyRevenue(drRes.data || []);
      setMonthlyRevenue(mrRes.data || []);
      setDoctorPerf(dpRes.data || []);
      setTreatmentPop(tpRes.data || []);
      setBalances(pbRes.data || []);
    } catch (err: any) {
      console.error('[Reports] fetchReports exception:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [clinicId, dateFrom, dateTo, doctorFilter]);

  const totalRevenue = dailyRevenue.reduce((s, d) => s + Number(d.total_revenue || 0), 0);
  const totalOutstanding = balances.reduce((s, b) => s + Number(b.balance || 0), 0);
  const totalVisits = doctorPerf.reduce((s, d) => s + Number(d.total_visits || 0), 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start text-start text-sm">
                <CalendarIcon className="me-2 h-4 w-4" />
                {format(dateFrom, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start text-start text-sm">
                <CalendarIcon className="me-2 h-4 w-4" />
                {format(dateTo, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('reception.doctor')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.doctors')}</SelectItem>
              {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">{t('payment.totalPaid')}</p><p className="text-2xl font-bold">{totalRevenue}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10"><TrendingUp className="h-6 w-6 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">{t('payment.balance')}</p><p className="text-2xl font-bold">{totalOutstanding}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent"><Activity className="h-6 w-6 text-accent-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">{t('doctor.visit')}</p><p className="text-2xl font-bold">{totalVisits}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary"><Users className="h-6 w-6 text-secondary-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">{t('nav.patients')}</p><p className="text-2xl font-bold">{balances.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">{t('report.dailyRevenue')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('report.monthlyRevenue')}</TabsTrigger>
          <TabsTrigger value="doctors">{t('report.doctorPerformance')}</TabsTrigger>
          <TabsTrigger value="treatments">{t('report.commonTreatments')}</TabsTrigger>
          <TabsTrigger value="balances">{t('report.outstandingBalances')}</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('report.dailyRevenue')}</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="revenue_date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total_revenue" fill="hsl(174, 62%, 38%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('report.monthlyRevenue')}</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="revenue_month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total_revenue" fill="hsl(210, 30%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('report.doctorPerformance')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reception.doctor')}</TableHead>
                    <TableHead>{t('doctor.visit')}</TableHead>
                    <TableHead>{t('reception.treatments')}</TableHead>
                    <TableHead>{t('payment.totalBilled')}</TableHead>
                    <TableHead>{t('payment.totalPaid')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctorPerf.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.doctor_name}</TableCell>
                      <TableCell>{d.total_visits}</TableCell>
                      <TableCell>{d.total_treatments}</TableCell>
                      <TableCell>{d.total_billed}</TableCell>
                      <TableCell>{d.total_collected}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatments" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t('report.commonTreatments')}</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={treatmentPop} dataKey="usage_count" nameKey="treatment_name" cx="50%" cy="50%" outerRadius={100} label>
                      {treatmentPop.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('admin.treatments')}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.treatmentName')}</TableHead>
                      <TableHead>{t('report.usageCount')}</TableHead>
                      <TableHead>{t('report.revenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentPop.map((tp, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{tp.treatment_name}</TableCell>
                        <TableCell>{tp.usage_count}</TableCell>
                        <TableCell>{tp.total_revenue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('report.outstandingBalances')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('patients.name')}</TableHead>
                    <TableHead>{t('patients.phone')}</TableHead>
                    <TableHead>{t('payment.totalBilled')}</TableHead>
                    <TableHead>{t('payment.totalPaid')}</TableHead>
                    <TableHead>{t('payment.balance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{b.patient_name}</TableCell>
                      <TableCell>{b.phone}</TableCell>
                      <TableCell>{b.total_billed}</TableCell>
                      <TableCell>{b.total_paid}</TableCell>
                      <TableCell className="text-destructive font-bold">{b.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
