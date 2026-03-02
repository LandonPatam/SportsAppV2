import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import NFL from "./pages/NFL";
import NBA from "./pages/NBA";
import F1 from "./pages/F1";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            {/* Redirect root path to /nba */}
            <Route path="/" element={<Navigate to="/nba" replace />} />
            
            {/* Main app routes */}
            <Route path="/nfl" element={<NFL />} />
            <Route path="/nba" element={<NBA />} />
            <Route path="/f1" element={<F1 />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;