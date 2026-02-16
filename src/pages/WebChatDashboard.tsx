import { useEffect, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, User, Bot, ArrowLeft, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ChatSession {
  session_id: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  last_message: string;
  last_time: string;
  unread: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  created_at: string;
  visitor_name: string | null;
}

export default function WebChatDashboard() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
    
    // Realtime subscription for new messages
    const channel = supabase
      .channel('web_chats_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'web_chats' }, () => {
        fetchSessions();
        if (selectedSession) fetchMessages(selectedSession);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('web_chats')
        .select('session_id, sender, message, created_at, visitor_name, visitor_phone')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by session_id
      const sessionMap = new Map<string, ChatSession>();
      data?.forEach((msg) => {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            session_id: msg.session_id,
            visitor_name: msg.visitor_name,
            visitor_phone: msg.visitor_phone,
            last_message: msg.message,
            last_time: msg.created_at,
            unread: 0,
          });
        }
        const s = sessionMap.get(msg.session_id)!;
        if (!s.visitor_name && msg.visitor_name) s.visitor_name = msg.visitor_name;
        if (!s.visitor_phone && msg.visitor_phone) s.visitor_phone = msg.visitor_phone;
      });

      setSessions(Array.from(sessionMap.values()));
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('web_chats')
      .select('id, sender, message, created_at, visitor_name')
      .eq('user_id', session.user.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  const openSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    fetchMessages(sessionId);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedSession || sending) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from('web_chats').insert({
        user_id: session.user.id,
        session_id: selectedSession,
        sender: 'admin',
        message: replyText.trim(),
      });

      if (error) throw error;
      setReplyText("");
      fetchMessages(selectedSession);
    } catch (err: any) {
      toast.error("Gagal mengirim balasan: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const selectedSessionInfo = sessions.find(s => s.session_id === selectedSession);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Web Chat Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>
          {/* Session List */}
          <Card className={`lg:col-span-1 ${selectedSession ? "hidden lg:block" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Percakapan Aktif</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada percakapan</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sessions.map((s) => (
                    <button
                      key={s.session_id}
                      onClick={() => openSession(s.session_id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        selectedSession === s.session_id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {s.visitor_name || "Visitor"}
                            </p>
                            {s.visitor_phone && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                <Phone className="w-2.5 h-2.5 mr-0.5" />
                                {s.visitor_phone}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{s.last_message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(s.last_time).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className={`lg:col-span-2 flex flex-col ${!selectedSession ? "hidden lg:flex" : ""}`}>
            {selectedSession ? (
              <>
                {/* Chat Header */}
                <div className="border-b border-border px-4 py-3 flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedSession(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedSessionInfo?.visitor_name || "Visitor"}</p>
                    {selectedSessionInfo?.visitor_phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedSessionInfo.visitor_phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: "55vh" }}>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === "visitor" ? "justify-start" : "justify-end"}`}>
                      <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === "visitor" ? "" : "flex-row-reverse"}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.sender === "visitor" ? "bg-primary/10" : msg.sender === "admin" ? "bg-emerald-100" : "bg-muted"
                        }`}>
                          {msg.sender === "visitor" ? (
                            <User className="w-3 h-3 text-primary" />
                          ) : msg.sender === "admin" ? (
                            <User className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Bot className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
                          msg.sender === "visitor"
                            ? "bg-muted rounded-bl-md"
                            : msg.sender === "admin"
                              ? "bg-emerald-600 text-white rounded-br-md"
                              : "bg-primary text-primary-foreground rounded-br-md"
                        }`}>
                          {msg.sender === "admin" && (
                            <p className="text-[10px] font-semibold opacity-75 mb-0.5">Anda (Admin)</p>
                          )}
                          {msg.sender === "ai" && (
                            <p className="text-[10px] font-semibold opacity-75 mb-0.5">AI Bot</p>
                          )}
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-[10px] mt-1 opacity-60`}>
                            {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                <div className="border-t border-border px-4 py-3">
                  <div className="flex gap-2">
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik balasan manual..."
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
                    />
                    <Button onClick={sendReply} disabled={!replyText.trim() || sending} size="icon">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Pilih percakapan untuk melihat chat</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
