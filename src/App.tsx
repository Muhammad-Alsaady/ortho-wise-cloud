import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import LicenseGuard from "@/components/LicenseGuard";
import Login from "@/pages/Login";
import ReceptionDashboard from "@/pages/ReceptionDashboard";
import PatientManagement from "@/pages/PatientManagement";
import DoctorQueue from "@/pages/DoctorQueue";
import DoctorVisit from "@/pages/DoctorVisit";
import AdminPanel from "@/pages/AdminPanel";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <LicenseGuard>
        <Routes>
          {(role === 'reception' || role === 'admin' || role === 'superadmin') && (
            <>
              <Route path="/" element={<ReceptionDashboard />} />
              <Route path="/patients" element={<PatientManagement />} />
            </>
          )}
          {(role === 'doctor') && (
            <>
              <Route path="/" element={<Navigate to="/doctor-queue" replace />} />
              <Route path="/doctor-queue" element={<DoctorQueue />} />
            </>
          )}
          <Route path="/visit/:id" element={<DoctorVisit />} />
          {(role === 'admin' || role === 'superadmin') && (
            <>
              <Route path="/reports" element={<Reports />} />
              <Route path="/admin" element={<AdminPanel />} />
            </>
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </LicenseGuard>
    </Layout>
  );
};

const App = React.forwardRef<HTMLDivElement>((_, ref) => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
));

App.displayName = 'App';

export default App;
