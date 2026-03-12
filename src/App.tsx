// Dental Clinic Management App
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import Layout from "@/components/Layout";
import LicenseGuard from "@/components/LicenseGuard";
import ErrorBoundary from "@/components/ErrorBoundary";

import Login from "@/pages/Login";
import ReceptionDashboard from "@/pages/ReceptionDashboard";
import PatientManagement from "@/pages/PatientManagement";
import DoctorQueue from "@/pages/DoctorQueue";
import DoctorVisit from "@/pages/DoctorVisit";
import AdminPanel from "@/pages/AdminPanel";
import Reports from "@/pages/Reports";
import SuperAdmin from "@/pages/SuperAdmin";
import Profile from "@/pages/Profile";

import { supabase } from "./integrations/supabase/client";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, role, loading } = useAuth();

  // Handle session expiration safely
  useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth event:", event);

    if (event === "SIGNED_OUT") {
      window.location.href = "/login";
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <LicenseGuard>
        <Routes>

          {/* Root route */}
          <Route
            path="/"
            element={
              role === "doctor" || role === "admin_doctor"
                ? <Navigate to="/doctor-queue" replace />
                : <ReceptionDashboard />
            }
          />

          {/* Reception + Admin + Superadmin + Doctor */}
          {(role === "reception" ||
            role === "admin" ||
            role === "superadmin" ||
            role === "doctor" ||
            role === "admin_doctor") && (
            <>
              <Route path="/patients" element={<PatientManagement />} />
            </>
          )}

          {/* Doctor routes */}
          {(role === "doctor" || role === "admin_doctor") && (
            <>
              <Route path="/doctor-queue" element={<DoctorQueue />} />
            </>
          )}

          {/* Shared routes */}
          <Route path="/visit/:id" element={<DoctorVisit />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin routes */}
          {(role === "admin" ||
            role === "superadmin" ||
            role === "admin_doctor") && (
            <>
              <Route path="/reports" element={<Reports />} />
              <Route path="/admin" element={<AdminPanel />} />
            </>
          )}

          {/* Superadmin */}
          {role === "superadmin" && (
            <Route path="/superadmin" element={<SuperAdmin />} />
          )}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </LicenseGuard>
    </Layout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
