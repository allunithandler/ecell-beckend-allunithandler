import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Attendance from "./pages/Attendance";
import Tasks from "./pages/Tasks";
import Profile from "./pages/Profile";
import Events from "./pages/Events";
import Organization from "./pages/Organization";
import FacultyView from "./pages/FacultyView";
import EmailTestPage from "./pages/EmailTestPage";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Suppress all console warnings for cleaner development
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const msg = args[0]?.toString() || '';
      if (msg.includes('React Router Future Flag Warning')) return;
      if (msg.includes('Missing `Description`')) return;
      originalWarn(...args);
    };
    
    console.error = (...args) => {
      const msg = args[0]?.toString() || '';
      if (msg.includes('Missing `Description`')) return;
      originalError(...args);
    };
    
    return () => { 
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/faculty/:token" element={<FacultyView />} />
          <Route path="/email-test" element={<EmailTestPage />} />
          <Route path="/attendance" element={<DashboardLayout><Attendance /></DashboardLayout>} />
          <Route path="/tasks" element={<DashboardLayout><Tasks /></DashboardLayout>} />
          <Route path="/events" element={<DashboardLayout><Events /></DashboardLayout>} />
          <Route path="/organization" element={<DashboardLayout><Organization /></DashboardLayout>} />
          <Route path="/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
