import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Save, Lock } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const Profile: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [name, setName] = useState(profile?.name || '');
  const [nameLoading, setNameLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const handleUpdateName = async () => {
    if (!user || !name.trim()) return;
    setNameLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('profile.nameUpdated') });
    }
    setNameLoading(false);
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(e => { errs[e.path[0]] = e.message; });
      setPasswordErrors(errs);
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('profile.passwordChanged') });
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordLoading(false);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card>
        <CardHeader><CardTitle>{t('profile.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('auth.email')}</label>
            <Input value={user?.email || ''} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('patients.name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <Button onClick={handleUpdateName} disabled={nameLoading || !name.trim()}>
            <Save className="me-2 h-4 w-4" />
            {nameLoading ? t('common.loading') : t('common.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('profile.changePassword')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('profile.newPassword')}</label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            {passwordErrors.newPassword && <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('profile.confirmPassword')}</label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            {passwordErrors.confirmPassword && <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>}
          </div>
          <Button onClick={handleChangePassword} disabled={passwordLoading}>
            <Lock className="me-2 h-4 w-4" />
            {passwordLoading ? t('common.loading') : t('profile.changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
