import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Users } from "lucide-react";

interface Profile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

export default function WhatsAppNotifications() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone, status')
      .order('name');

    if (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data user",
        variant: "destructive"
      });
      return;
    }

    setProfiles(data || []);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) {
      setSelectedPhone(profile.phone || "");
    }
  };

  const handleSendNotification = async () => {
    if (!selectedPhone || !message) {
      toast({
        title: "Error",
        description: "Pilih user dan masukkan pesan",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phone: selectedPhone,
          message: message,
          userId: selectedUserId
        }
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Notifikasi WhatsApp berhasil dikirim"
      });

      // Create notification record
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedUserId,
          title: 'Pesan dari Admin',
          message: message,
          type: 'whatsapp'
        });

      setMessage("");
      setSelectedUserId("");
      setSelectedPhone("");
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengirim notifikasi WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifikasi WhatsApp</h1>
            <p className="text-muted-foreground">Kirim notifikasi WhatsApp ke user</p>
          </div>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Send Notification Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Kirim Notifikasi
            </CardTitle>
            <CardDescription>
              Pilih user dan kirim pesan WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Pilih User</Label>
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.name || profile.email} - {profile.phone || 'No WhatsApp belum diisi'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No WhatsApp</Label>
              <Input
                id="phone"
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                placeholder="628123456789"
                disabled={!selectedUserId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Pesan</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis pesan notifikasi..."
                rows={5}
              />
            </div>

            <Button
              onClick={handleSendNotification}
              disabled={loading || !selectedPhone || !message}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {loading ? "Mengirim..." : "Kirim Notifikasi"}
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Information */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Information</CardTitle>
            <CardDescription>
              Gunakan URL webhook ini untuk konfigurasi OneSender
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Setiap user memiliki webhook token unik yang digunakan untuk autentikasi pesan masuk.
            </p>
            <div className="rounded-lg bg-muted p-3">
              <code className="text-xs break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/balasinaja?token={'{'}<span className="text-primary">WEBHOOK_TOKEN</span>{'}'}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Setiap user dapat melihat token webhook mereka di halaman Konfigurasi API. Token ini bersifat unik dan rahasia untuk keamanan.
            </p>
          </CardContent>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Daftar User
            </CardTitle>
            <CardDescription>
              User yang terdaftar dengan No WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>No WhatsApp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.filter(p => p.phone).map((profile) => (
                    <TableRow key={profile.user_id}>
                      <TableCell className="font-medium">
                        {profile.name || profile.email}
                      </TableCell>
                      <TableCell>{profile.phone}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${
                          profile.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {profile.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {profiles.filter(p => p.phone).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Belum ada user dengan No WhatsApp
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </Layout>
  );
}