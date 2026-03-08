import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  appointment: any;
  onClose: () => void;
}

const PaymentModal: React.FC<Props> = ({ open, appointment, onClose }) => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [plans, setPlans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [discountPlan, setDiscountPlan] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const { data: visits } = await supabase
      .from('visits')
      .select('id')
      .eq('appointment_id', appointment.id);

    if (!visits || visits.length === 0) return;

    const visitIds = visits.map(v => v.id);
    const { data: plansData } = await supabase
      .from('treatment_plans')
      .select('*, treatment:treatments(name)')
      .in('visit_id', visitIds);

    setPlans(plansData || []);

    if (plansData && plansData.length > 0) {
      const planIds = plansData.map(p => p.id);
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .in('treatment_plan_id', planIds)
        .order('created_at', { ascending: false });
      setPayments(paymentsData || []);
    }
  };

  useEffect(() => { fetchData(); }, [appointment]);

  const totalBilled = plans.reduce((s, p) => s + Number(p.price) - Number(p.discount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalBilled - totalPaid;

  const handleAddPayment = async () => {
    if (!selectedPlan || !amount) return;
    setSaving(true);
    const { error } = await supabase.from('payments').insert({
      treatment_plan_id: selectedPlan,
      amount: Number(amount),
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      setAmount('');
      fetchData();
    }
    setSaving(false);
  };

  const handleAddDiscount = async () => {
    if (!discountPlan || !discountAmount) return;
    setSaving(true);
    const plan = plans.find(p => p.id === discountPlan);
    if (!plan) return;
    const { error } = await supabase
      .from('treatment_plans')
      .update({ discount: Number(plan.discount) + Number(discountAmount) })
      .eq('id', discountPlan);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      setDiscountAmount('');
      fetchData();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('payment.title')} - {appointment.patient?.name}</DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted p-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.totalBilled')}</p>
            <p className="text-lg font-bold">{totalBilled}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.totalPaid')}</p>
            <p className="text-lg font-bold text-green-600">{totalPaid}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('payment.balance')}</p>
            <p className="text-lg font-bold text-destructive">{balance}</p>
          </div>
        </div>

        <Tabs defaultValue="payment">
          <TabsList className="w-full">
            <TabsTrigger value="payment" className="flex-1">{t('payment.addPayment')}</TabsTrigger>
            <TabsTrigger value="discount" className="flex-1">{t('payment.addDiscount')}</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">{t('payment.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="payment" className="space-y-3 mt-4">
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger><SelectValue placeholder={t('doctor.treatment')} /></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.treatment?.name} ({Number(p.price) - Number(p.discount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder={t('payment.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button className="w-full" onClick={handleAddPayment} disabled={saving || !selectedPlan || !amount}>
              {t('payment.addPayment')}
            </Button>
          </TabsContent>

          <TabsContent value="discount" className="space-y-3 mt-4">
            <Select value={discountPlan} onValueChange={setDiscountPlan}>
              <SelectTrigger><SelectValue placeholder={t('doctor.treatment')} /></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.treatment?.name} ({t('doctor.discount')}: {p.discount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder={t('payment.amount')} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            <Button className="w-full" variant="secondary" onClick={handleAddDiscount} disabled={saving || !discountPlan || !discountAmount}>
              {t('payment.addDiscount')}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payment.date')}</TableHead>
                  <TableHead>{t('payment.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
                ) : payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.created_at), 'PPP HH:mm')}</TableCell>
                    <TableCell className="font-medium">{p.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
