import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { checkAuthError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 30;

const levelColors: Record<string, string> = {
  ERROR: 'bg-red-100 text-red-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
};

const SystemLogs: React.FC = () => {
  const { t } = useLanguage();

  const [logs, setLogs] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterClinicId, setFilterClinicId] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Fetch clinics for filter dropdown
  useEffect(() => {
    supabase
      .from('clinics')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClinics(data || []));
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterClinicId) query = query.eq('clinic_id', filterClinicId);
      if (filterLevel) query = query.eq('level', filterLevel);
      if (filterFrom) query = query.gte('created_at', `${filterFrom}T00:00:00`);
      if (filterTo) query = query.lte('created_at', `${filterTo}T23:59:59`);

      const { data, error, count } = await query;
      if (error) {
        if (checkAuthError(error, 'SystemLogs')) return;
        console.error('[SystemLogs] fetch error:', error);
      }
      setLogs(data || []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('[SystemLogs] exception:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterClinicId, filterLevel, filterFrom, filterTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getClinicName = (clinicId: string) =>
    clinics.find((c) => c.id === clinicId)?.name || clinicId?.slice(0, 8) + '…';

  const handleResetFilters = () => {
    setFilterClinicId('');
    setFilterLevel('');
    setFilterFrom('');
    setFilterTo('');
    setPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('logs.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Clinic filter */}
            <Select
              value={filterClinicId || 'all'}
              onValueChange={(v) => { setFilterClinicId(v === 'all' ? '' : v); setPage(0); }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('logs.allClinics')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.allClinics')}</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Level filter */}
            <Select
              value={filterLevel || 'all'}
              onValueChange={(v) => { setFilterLevel(v === 'all' ? '' : v); setPage(0); }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('logs.allLevels')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.allLevels')}</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
              </SelectContent>
            </Select>

            {/* Date from */}
            <Input
              type="date"
              placeholder={t('logs.from')}
              value={filterFrom}
              onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }}
            />

            {/* Date to */}
            <Input
              type="date"
              placeholder={t('logs.to')}
              value={filterTo}
              onChange={(e) => { setFilterTo(e.target.value); setPage(0); }}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleResetFilters} className="flex-1">
                {t('logs.filters')} ✕
              </Button>
              <Button variant="outline" size="icon" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('logs.title')}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalCount} {t('patients.total')}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payment.date')}</TableHead>
                <TableHead>{t('logs.level')}</TableHead>
                <TableHead>{t('logs.action')}</TableHead>
                <TableHead>{t('logs.entity')}</TableHead>
                <TableHead>{t('logs.message')}</TableHead>
                <TableHead>{t('logs.clinic')}</TableHead>
                <TableHead>{t('logs.user')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t('logs.noLogs')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge className={levelColors[log.level] || 'bg-muted text-muted-foreground'}>
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.action}</TableCell>
                    <TableCell className="text-sm">{log.entity}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm" title={log.message}>
                      {log.message}
                    </TableCell>
                    <TableCell className="text-sm">{getClinicName(log.clinic_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.user_id ? log.user_id.slice(0, 8) + '…' : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {t('patients.page')} {page + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogs;
