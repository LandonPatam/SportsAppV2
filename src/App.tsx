import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NextSportRedirect } from "@/components/NextSportRedirect";
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
            <Route path="/" element={<NextSportRedirect />} />
            
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
