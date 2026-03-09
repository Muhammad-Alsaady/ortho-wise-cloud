import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  CalendarDays, Users, Stethoscope, Settings, LogOut, Globe, Menu, X, BarChart3, Shield, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, profile, signOut } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const navItems = React.useMemo(() => {
    const items = [];
    if (role === 'reception' || role === 'admin' || role === 'superadmin') {
      items.push({ path: '/', label: t('nav.reception'), icon: CalendarDays });
      items.push({ path: '/patients', label: t('nav.patients'), icon: Users });
    }
    if (role === 'doctor') {
      items.push({ path: '/doctor-queue', label: t('nav.doctorQueue'), icon: Stethoscope });
    }
    if (role === 'admin' || role === 'superadmin') {
      items.push({ path: '/reports', label: t('nav.reports'), icon: BarChart3 });
      items.push({ path: '/admin', label: t('nav.admin'), icon: Settings });
    }
    if (role === 'superadmin') {
      items.push({ path: '/superadmin', label: t('nav.superadmin'), icon: Shield });
    }
    return items;
  }, [role, t]);

  return (
    <div dir={dir} className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 z-50 flex w-64 flex-col bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:static lg:translate-x-0",
        dir === 'rtl' ? 'right-0' : 'left-0',
        sidebarOpen 
          ? 'translate-x-0' 
          : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-6 py-5">
          <Stethoscope className="h-7 w-7" />
          <span className="text-lg font-bold">{t('auth.welcome')}</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === item.path
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                  : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[hsl(var(--sidebar-border))] p-4 space-y-2">
          <div className="px-3 py-1 text-xs opacity-70">{profile?.name}</div>
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === '/profile'
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]"
            )}
          >
            <User className="h-4 w-4" />
            {t('nav.profile')}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          >
            <Globe className="h-4 w-4" />
            {language === 'en' ? 'العربية' : 'English'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-card px-4 py-3 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {navItems.find(i => i.path === location.pathname)?.label || 
             (location.pathname === '/profile' ? t('nav.profile') : '')}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
