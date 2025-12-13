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
import { Loader2, MessageSquare, CheckCircle, Clock, Send, Lock } from "lucide-react";

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
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
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

      const { data: newTicket, error } = await supabase.from("tickets").insert({
        user_id: session.user.id,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        status: "open",
      }).select().single();

      if (error) throw error;

      // Add initial message to conversation
      if (newTicket) {
        await supabase.from("ticket_messages").insert({
          ticket_id: newTicket.id,
          sender_type: "user",
          sender_id: session.user.id,
          message: message.trim(),
        });
      }

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

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) {
      toast({
        title: "Validasi Error",
        description: "Pesan harus diisi",
        variant: "destructive",
      });
      return;
    }

    setReplySubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_type: "user",
        sender_id: session.user.id,
        message: replyMessage.trim(),
      });

      if (error) throw error;

      // Update ticket status to open if it was replied
      if (selectedTicket.status === "replied") {
        await supabase.from("tickets").update({ status: "open" }).eq("id", selectedTicket.id);
        setSelectedTicket({ ...selectedTicket, status: "open" });
      }

      toast({
        title: "Berhasil",
        description: "Balasan berhasil dikirim",
      });

      setReplyMessage("");
      loadTicketMessages(selectedTicket.id);
      loadTickets();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: "Error",
        description: "Gagal mengirim balasan",
        variant: "destructive",
      });
    } finally {
      setReplySubmitting(false);
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
        <div className="grid gap-6 md:grid-cols-2">
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
                <Card
                  key={ticket.id}
                  className={`cursor-pointer hover:border-primary transition ${
                    selectedTicket?.id === ticket.id ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
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
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.message}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Detail & Percakapan */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Detail & Percakapan</h2>
            {!selectedTicket ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Pilih tiket untuk melihat detail dan percakapan
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
                    {/* Conversation Messages */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {/* Initial message */}
                      <div className="bg-primary/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">Anda</span>
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
                              {msg.sender_type === "user" ? "Anda" : "Admin"}
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
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Tulis balasan Anda..."
                          rows={3}
                        />
                        <Button onClick={handleSendReply} disabled={replySubmitting} className="w-full">
                          {replySubmitting ? (
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
                          <p className="text-sm">Tiket ini sudah ditutup dan tidak dapat dibalas lagi.</p>
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
