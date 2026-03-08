import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Lock } from 'lucide-react';

interface LicenseGuardProps {
  children: React.ReactNode;
}

const LicenseGuard: React.FC<LicenseGuardProps> = ({ children }) => {
  const { clinicId } = useAuth();
  const { t } = useLanguage();
  const [clinic, setClinic] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('clinics').select('*').eq('id', clinicId).single().then(({ data }) => {
        setClinic(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [clinicId]);

  if (loading) return null;

  const isExpired = clinic?.license_expiry && new Date(clinic.license_expiry) < new Date();
  const isExpiringSoon = clinic?.license_expiry && !isExpired && 
    new Date(clinic.license_expiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (isExpired) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <Lock className="h-5 w-5" />
          <AlertTitle className="text-lg">{t('license.expired')}</AlertTitle>
          <AlertDescription>{t('license.expiredDesc')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      {isExpiringSoon && (
        <Alert className="mb-4 border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>{t('license.expiringSoon')}</AlertTitle>
          <AlertDescription>
            {t('license.expiringSoonDesc')} {clinic?.license_expiry ? new Date(clinic.license_expiry).toLocaleDateString() : ''}
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
};

export default LicenseGuard;
