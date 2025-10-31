import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // 👈 added Navigate
import NotFound from "./pages/NotFound";
import NFL from "./pages/NFL";
import F1 from "./pages/F1";
import NBA from "./pages/NBA";
import UFC from "./pages/UFC";
import Playground from "./pages/Playground";

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
          <Route path="/f1" element={<F1 />} />
          <Route path="/nba" element={<NBA />} />
          <Route path="/ufc" element={<UFC />} />
          <Route path="/playground" element={<Playground />} />

          {/* Catch-all for 404s */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
