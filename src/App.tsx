import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Autoreplies from "./pages/Autoreplies";
import AIKnowledge from "./pages/AIKnowledge";
import AIBehavior from "./pages/AIBehavior";
import Contacts from "./pages/Contacts";
import Broadcast from "./pages/Broadcast";
import BroadcastReport from "./pages/BroadcastReport";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import PaymentSuccess from "./pages/PaymentSuccess";
import APIConfiguration from "./pages/APIConfiguration";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import PackageManagement from "./pages/admin/PackageManagement";
import PaymentVerification from "./pages/admin/PaymentVerification";
import WhatsApp from "./pages/admin/WhatsApp";
import ActivityLogs from "./pages/admin/ActivityLogs";
import TicketManagement from "./pages/admin/TicketManagement";
import LandingPageManagement from "./pages/admin/LandingPageManagement";
import Tickets from "./pages/Tickets";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
          <Route path="/autoreplies" element={<ProtectedRoute><Autoreplies /></ProtectedRoute>} />
          <Route path="/ai-knowledge" element={<ProtectedRoute><AIKnowledge /></ProtectedRoute>} />
          <Route path="/ai-behavior" element={<ProtectedRoute><AIBehavior /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/broadcast" element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
          <Route path="/broadcast-report" element={<ProtectedRoute><BroadcastReport /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/api-configuration" element={<ProtectedRoute><APIConfiguration /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
          <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><UserManagement /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/packages" element={<ProtectedRoute><AdminRoute><PackageManagement /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute><AdminRoute><PaymentVerification /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/whatsapp" element={<ProtectedRoute><AdminRoute><WhatsApp /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/tickets" element={<ProtectedRoute><AdminRoute><TicketManagement /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute><AdminRoute><ActivityLogs /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/landing-page" element={<ProtectedRoute><AdminRoute><LandingPageManagement /></AdminRoute></ProtectedRoute>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
