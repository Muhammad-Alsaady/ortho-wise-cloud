import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stethoscope, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.resetSent') });
    }
    setResetLoading(false);
  };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--primary)/0.08)] via-background to-[hsl(var(--primary)/0.04)] p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <Globe className="h-4 w-4 me-2" />
          {language === 'en' ? 'العربية' : 'English'}
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Stethoscope className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.welcome')}</CardTitle>
          <CardDescription>{showForgotPassword ? t('auth.resetDesc') : t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!showForgotPassword ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.signingIn') : t('auth.login')}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-primary hover:underline"
                onClick={() => setShowForgotPassword(true)}
              >
                {t('auth.forgotPassword')}
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? t('common.loading') : t('auth.sendResetLink')}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-primary hover:underline"
                onClick={() => setShowForgotPassword(false)}
              >
                {t('auth.backToLogin')}
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
