import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Inbox, Bot, Users, Sparkles, Brain, Shield, UserCog, Package, ScrollText, Bell, Radio, BellDot, ChevronDown, Settings2, LayoutDashboard, Ticket, FileText, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import { useIsMobile } from "@/hooks/use-mobile";

const userNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: Sparkles },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Autoreplies", href: "/autoreplies", icon: MessageSquare },
  { name: "Contacts", href: "/contacts", icon: Users },
];

const aiNavigation = [
  { name: "AI Knowledge", href: "/ai-knowledge", icon: Bot },
  { name: "AI Behavior", href: "/ai-behavior", icon: Brain },
];

const broadcastNavigation = [
  { name: "Broadcast", href: "/broadcast", icon: Radio },
  { name: "Laporan Broadcast", href: "/broadcast-report", icon: ScrollText },
  { name: "Web Chat", href: "/web-chat", icon: MessageCircle },
  { name: "Chat Dashboard", href: "/web-chat/dashboard", icon: Inbox },
];

const adminNavigation = [
  { name: "Dashboard Admin", href: "/admin", icon: Shield },
  { name: "Manajemen User", href: "/admin/users", icon: UserCog },
  { name: "Manajemen Paket", href: "/admin/packages", icon: Package },
  { name: "Verifikasi Pembayaran", href: "/admin/payments", icon: Bell },
  { name: "Notifikasi WhatsApp", href: "/admin/whatsapp", icon: MessageSquare },
  { name: "Manajemen Tiket", href: "/admin/tickets", icon: Ticket },
  { name: "Landing Page", href: "/admin/landing-page", icon: FileText },
  { name: "Log Aktivitas", href: "/admin/logs", icon: ScrollText },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState<'admin' | 'user'>('admin');
  const [navigation, setNavigation] = useState(userNavigation);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        const hasAdminRole = !!roles;
        setIsAdmin(hasAdminRole);
        
        // Load saved mode preference
        const savedMode = localStorage.getItem('adminMode') as 'admin' | 'user';
        if (hasAdminRole && savedMode) {
          setAdminMode(savedMode);
        }
        
        // Set navigation based on role
        if (hasAdminRole) {
          fetchPendingPayments();
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
      }
    };

    checkAdminRole();
    fetchUnreadNotifications();
  }, []);

  // Update navigation when admin mode changes
  useEffect(() => {
    if (isAdmin) {
      if (adminMode === 'admin') {
        setNavigation(adminNavigation);
      } else {
        setNavigation([...userNavigation, ...broadcastNavigation]);
      }
    } else {
      setNavigation([...userNavigation, ...broadcastNavigation]);
    }
  }, [isAdmin, adminMode]);

  useEffect(() => {
    const channels = [];
    
    if (isAdmin) {
      // Setup realtime subscription for payment updates
      const paymentChannel = supabase
        .channel('payment_notifications')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'payment_proofs' },
          () => {
            fetchPendingPayments();
          }
        )
        .subscribe();
      channels.push(paymentChannel);
    }

    // Setup realtime subscription for user notifications
    const notificationChannel = supabase
      .channel('user_notifications')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchUnreadNotifications();
        }
      )
      .subscribe();
    channels.push(notificationChannel);

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAdmin]);

  const fetchPendingPayments = async () => {
    const { count } = await supabase
      .from('payment_proofs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingPayments(count || 0);
  };

  const fetchUnreadNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    
    setUnreadNotifications(count || 0);
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-primary">
                <MessageSquare className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                BalasinAja
              </span>
            </Link>
            
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {adminMode === 'admin' ? 'Mode Admin' : 'Mode User'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => {
                    setAdminMode('admin');
                    localStorage.setItem('adminMode', 'admin');
                  }}>
                    <Shield className="w-4 h-4 mr-2" />
                    Dashboard Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setAdminMode('user');
                    localStorage.setItem('adminMode', 'user');
                  }}>
                    <Users className="w-4 h-4 mr-2" />
                    Dashboard User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isMobile && (
              <>
                <Link 
                  to="/subscription"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname === "/subscription"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Package className="w-4 h-4" />
                  Langganan
                </Link>
                <Link 
                  to="/api-configuration"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    location.pathname === "/api-configuration"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Settings2 className="w-4 h-4" />
                  Konfigurasi API
                </Link>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/notifications")}
              className="flex items-center gap-2 relative"
            >
              <BellDot className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {unreadNotifications}
                </Badge>
              )}
            </Button>
            <UserAvatar />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide items-center">
            {navigation.map((item: any) => {
              const isActive = location.pathname === item.href;
              const showPaymentBadge = item.href === "/admin/payments" && pendingPayments > 0;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap relative flex-shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                  {showPaymentBadge && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                      {pendingPayments}
                    </Badge>
                  )}
                </Link>
              );
            })}
            {/* AI Dropdown - only show for non-admin mode */}
            {(!isAdmin || adminMode === 'user') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                    aiNavigation.some(ai => location.pathname === ai.href)
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <Bot className="w-4 h-4" />
                    AI
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover">
                  {aiNavigation.map((item) => (
                    <DropdownMenuItem key={item.name} onClick={() => navigate(item.href)} className={cn(
                      location.pathname === item.href && "bg-muted"
                    )}>
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          BalasinAja Dashboard © {new Date().getFullYear()} - WhatsApp AI Autoreply System
        </div>
      </footer>
    </div>
  );
};
