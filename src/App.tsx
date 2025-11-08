import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // 👈 added Navigate
import NFL from "./pages/NFL";
import NBA from "./pages/NBA";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* 👇 Redirect root path to /nfl */}
          <Route path="/" element={<Navigate to="/nfl" replace />} />
          
          {/* Main app routes */}
          <Route path="/nfl" element={<NFL />} />
          <Route path="/nba" element={<NBA />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
