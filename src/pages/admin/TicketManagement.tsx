import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle, Clock, Send, Lock, Unlock } from "lucide-react";

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string;
  message: string;
  created_at: string;
}

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
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

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

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTicketMessages(data || []);
    } catch (error) {
      console.error("Error loading ticket messages:", error);
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

      // Insert message to conversation
      const { error: msgError } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_type: "admin",
        sender_id: session.user.id,
        message: reply.trim(),
      });

      if (msgError) throw msgError;

      // Update ticket status and admin_reply for backwards compatibility
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          admin_reply: reply.trim(),
          replied_by: session.user.id,
          replied_at: new Date().toISOString(),
          status: "replied",
        })
        .eq("id", selectedTicket.id);

      if (updateError) throw updateError;

      toast({
        title: "Berhasil",
        description: "Balasan berhasil dikirim",
      });

      setReply("");
      setSelectedTicket({ ...selectedTicket, status: "replied", admin_reply: reply.trim() });
      loadTicketMessages(selectedTicket.id);
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

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: "closed" })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Tiket berhasil ditutup",
      });

      setSelectedTicket({ ...selectedTicket, status: "closed" });
      loadTickets();
    } catch (error) {
      console.error("Error closing ticket:", error);
      toast({
        title: "Error",
        description: "Gagal menutup tiket",
        variant: "destructive",
      });
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: "open" })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Tiket berhasil dibuka kembali",
      });

      setSelectedTicket({ ...selectedTicket, status: "open" });
      loadTickets();
    } catch (error) {
      console.error("Error reopening ticket:", error);
      toast({
        title: "Error",
        description: "Gagal membuka kembali tiket",
        variant: "destructive",
      });
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
                    setReply("");
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
            <h2 className="text-xl font-semibold">Detail & Percakapan</h2>
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
                      {selectedTicket.status === "closed" ? (
                        <Button variant="outline" size="sm" onClick={handleReopenTicket}>
                          <Unlock className="w-4 h-4 mr-1" />
                          Buka Kembali
                        </Button>
                      ) : (
                        <Button variant="destructive" size="sm" onClick={handleCloseTicket}>
                          <Lock className="w-4 h-4 mr-1" />
                          Tutup Tiket
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Conversation Messages */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {/* Initial message */}
                      <div className="bg-primary/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">User</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(selectedTicket.created_at).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                      </div>

                      {/* Legacy admin reply */}
                      {selectedTicket.admin_reply && ticketMessages.length === 0 && (
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-secondary-foreground">Admin</span>
                            {selectedTicket.replied_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(selectedTicket.replied_at).toLocaleString("id-ID")}
                              </span>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_reply}</p>
                        </div>
                      )}

                      {/* Conversation messages */}
                      {ticketMessages.slice(1).map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg p-3 ${
                            msg.sender_type === "user" ? "bg-primary/10" : "bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${
                              msg.sender_type === "user" ? "text-primary" : "text-secondary-foreground"
                            }`}>
                              {msg.sender_type === "user" ? "User" : "Admin"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Form */}
                    {selectedTicket.status !== "closed" ? (
                      <div className="border-t pt-4 space-y-3">
                        <Textarea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Tulis balasan untuk pengguna..."
                          rows={4}
                        />
                        <Button onClick={handleReply} disabled={submitting} className="w-full">
                          {submitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Kirim Balasan
                        </Button>
                      </div>
                    ) : (
                      <div className="border-t pt-4">
                        <div className="bg-muted rounded-lg p-4 flex items-center gap-3 text-muted-foreground">
                          <Lock className="w-5 h-5" />
                          <p className="text-sm">Tiket ini sudah ditutup. Klik "Buka Kembali" untuk melanjutkan percakapan.</p>
                        </div>
                      </div>
                    )}
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
