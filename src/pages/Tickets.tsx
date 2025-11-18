import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export default function Tickets() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Error",
        description: "Gagal memuat tiket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Validasi Error",
        description: "Subjek dan pesan harus diisi",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("tickets").insert({
        user_id: session.user.id,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        status: "open",
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Tiket berhasil dikirim",
      });

      setSubject("");
      setMessage("");
      setPriority("normal");
      loadTickets();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: "Gagal mengirim tiket",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      open: { variant: "default", icon: Clock },
      replied: { variant: "secondary", icon: MessageSquare },
      closed: { variant: "outline", icon: CheckCircle },
    };
    const config = variants[status] || variants.open;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status === "open" ? "Terbuka" : status === "replied" ? "Dibalas" : "Selesai"}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-100 text-blue-800",
      normal: "bg-gray-100 text-gray-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={colors[priority] || colors.normal}>
        {priority === "low" ? "Rendah" : priority === "normal" ? "Normal" : priority === "high" ? "Tinggi" : "Urgent"}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Tiket Support
          </h1>
          <p className="text-muted-foreground">
            Kirim laporan, kritik, atau saran kepada tim kami
          </p>
        </div>

        {/* Form Buat Tiket Baru */}
        <Card>
          <CardHeader>
            <CardTitle>Buat Tiket Baru</CardTitle>
            <CardDescription>Sampaikan pertanyaan atau masukan Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subjek</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Tuliskan subjek tiket Anda"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioritas</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Rendah</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Tinggi</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Pesan</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Jelaskan masalah atau pertanyaan Anda secara detail"
                  rows={6}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Kirim Tiket
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Daftar Tiket */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Riwayat Tiket Anda</h2>
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Belum ada tiket. Buat tiket pertama Anda di atas.
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Pesan Anda:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {ticket.message}
                    </p>
                  </div>

                  {ticket.admin_reply && (
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium">Balasan Admin:</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{ticket.admin_reply}</p>
                      {ticket.replied_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Dibalas pada: {new Date(ticket.replied_at).toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
