import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, User, Phone, Lock, ArrowLeft } from "lucide-react";
import logo from "@/assets/BalasinAja.png";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check if user is admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (roles) {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Check if user is admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (roles) {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name || !whatsappNumber) {
          toast({
            title: "Error",
            description: "Nama dan No WhatsApp harus diisi",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: name,
              phone: whatsappNumber
            }
          }
        });
        if (error) throw error;
        
        // Show success dialog
        setShowSuccessDialog(true);
        
        // Send welcome notification in background (don't wait for it)
        if (signUpData.user?.id) {
          supabase.functions.invoke('send-welcome-notification', {
            body: { userId: signUpData.user.id }
          }).catch(err => console.error('Failed to send welcome notification:', err));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Check if user is admin
        if (data.session) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.session.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          toast({
            title: "Login berhasil!",
            description: "Selamat datang kembali.",
          });
          
          if (roles) {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background p-4">
      <Card className="w-full max-w-md shadow-elegant relative">
        <CardHeader className="space-y-2 text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="absolute left-4 top-4"
          >
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
          </Button>
          <div className="mx-auto mb-4 pt-4">
            <img src={logo} alt="BalasinAja" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Buat Akun Baru" : "Login ke BalasinAja"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Daftar untuk mengakses BalasinAja Dashboard" 
              : "Masukkan kredensial Anda untuk melanjutkan"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nama Lengkap
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Nama Anda"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    No WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="628123456789"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Processing..." : isSignUp ? "Daftar" : "Login"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline"
              disabled={loading}
            >
              {isSignUp 
                ? "Sudah punya akun? Login di sini" 
                : "Belum punya akun? Daftar di sini"
              }
            </button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrasi Berhasil! 🎉</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Akun Anda telah berhasil dibuat.</p>
              <p className="font-medium">Silakan login kembali menggunakan kredensial yang telah Anda daftarkan untuk melanjutkan.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
              onClick={() => {
                setShowSuccessDialog(false);
                setIsSignUp(false);
                setName("");
                setWhatsappNumber("");
                setPassword("");
              }}
            >
              OK, Login Sekarang
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
