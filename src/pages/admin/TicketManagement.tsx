import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle, Clock, Send } from "lucide-react";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export default function TicketManagement() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) {
      toast({
        title: "Validasi Error",
        description: "Balasan harus diisi",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData: any = {
        admin_reply: reply.trim(),
        replied_by: session.user.id,
        replied_at: new Date().toISOString(),
      };

      if (newStatus) {
        updateData.status = newStatus;
      } else if (selectedTicket.status === "open") {
        updateData.status = "replied";
      }

      const { error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Balasan berhasil dikirim",
      });

      setReply("");
      setNewStatus("");
      setSelectedTicket(null);
      loadTickets();
    } catch (error) {
      console.error("Error replying to ticket:", error);
      toast({
        title: "Error",
        description: "Gagal mengirim balasan",
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
            Manajemen Tiket Support
          </h1>
          <p className="text-muted-foreground">
            Kelola dan balas tiket dari pengguna
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Daftar Tiket */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Semua Tiket</h2>
            {tickets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Belum ada tiket masuk
                </CardContent>
              </Card>
            ) : (
              tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer hover:border-primary transition ${
                    selectedTicket?.id === ticket.id ? "border-primary" : ""
                  }`}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setReply(ticket.admin_reply || "");
                    setNewStatus("");
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-base">{ticket.subject}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.message}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Detail & Balasan */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Detail Tiket</h2>
            {!selectedTicket ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Pilih tiket untuk melihat detail dan membalas
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle>{selectedTicket.subject}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(selectedTicket.status)}
                          {getPriorityBadge(selectedTicket.priority)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Pesan User:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedTicket.message}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dibuat: {new Date(selectedTicket.created_at).toLocaleString("id-ID")}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Balas Tiket</CardTitle>
                    <CardDescription>
                      {selectedTicket.admin_reply
                        ? "Update balasan Anda"
                        : "Kirim balasan ke pengguna"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Tulis balasan untuk pengguna..."
                        rows={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status Tiket</label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status (opsional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Terbuka</SelectItem>
                          <SelectItem value="replied">Dibalas</SelectItem>
                          <SelectItem value="closed">Selesai</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleReply} disabled={submitting}>
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {selectedTicket.admin_reply ? "Update Balasan" : "Kirim Balasan"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
