import { useEffect, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, User, Bot, ArrowLeft, Phone, Loader2, Image, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChatContact {
  visitor_phone: string;
  visitor_name: string | null;
  last_message: string;
  last_time: string;
  session_ids: string[];
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  message_type: string;
  created_at: string;
  visitor_name: string | null;
  session_id: string;
}

export default function WebChatDashboard() {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContacts();
    
    const channel = supabase
      .channel('web_chats_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'web_chats' }, () => {
        fetchContacts();
        if (selectedPhone) fetchMessages(selectedPhone);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContacts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('web_chats')
        .select('session_id, sender, message, message_type, created_at, visitor_name, visitor_phone')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by visitor_phone
      const phoneMap = new Map<string, ChatContact>();
      data?.forEach((msg) => {
        const phone = msg.visitor_phone || 'unknown';
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, {
            visitor_phone: phone,
            visitor_name: msg.visitor_name,
            last_message: msg.message,
            last_time: msg.created_at,
            session_ids: [msg.session_id],
          });
        } else {
          const c = phoneMap.get(phone)!;
          if (!c.visitor_name && msg.visitor_name) c.visitor_name = msg.visitor_name;
          if (!c.session_ids.includes(msg.session_id)) c.session_ids.push(msg.session_id);
        }
      });

      setContacts(Array.from(phoneMap.values()));
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (phone: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('web_chats')
      .select('id, sender, message, message_type, created_at, visitor_name, session_id')
      .eq('user_id', session.user.id)
      .eq('visitor_phone', phone)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  const openContact = (phone: string) => {
    setSelectedPhone(phone);
    fetchMessages(phone);
  };

  const getLatestSessionId = (): string | null => {
    if (messages.length === 0) return null;
    return messages[messages.length - 1].session_id;
  };

  const sendReply = async (messageText?: string, messageType: string = 'text') => {
    const text = messageText || replyText.trim();
    if (!text || !selectedPhone || sending) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const sessionId = getLatestSessionId() || crypto.randomUUID();

      const { error } = await supabase.from('web_chats').insert({
        user_id: session.user.id,
        session_id: sessionId,
        sender: 'admin',
        message: text,
        message_type: messageType,
        visitor_phone: selectedPhone,
      });

      if (error) throw error;
      if (!messageText) setReplyText("");
      fetchMessages(selectedPhone);
    } catch (err: any) {
      toast.error("Gagal mengirim balasan: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diperbolehkan");
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split('.').pop();
      const filePath = `${session.user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('web-chat-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('web-chat-attachments')
        .getPublicUrl(filePath);

      await sendReply(publicUrl, 'image');
    } catch (err: any) {
      toast.error("Gagal upload gambar: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedContactInfo = contacts.find(c => c.visitor_phone === selectedPhone);

  const renderMessage = (msg: ChatMessage) => {
    const isImage = msg.message_type === 'image';
    return (
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
            {isImage ? (
              <a href={msg.message} target="_blank" rel="noopener noreferrer">
                <img src={msg.message} alt="Attachment" className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90" />
              </a>
            ) : (
              <p className="whitespace-pre-wrap">{msg.message}</p>
            )}
            <p className={`text-[10px] mt-1 opacity-60`}>
              {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Web Chat Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>
          {/* Contact List */}
          <Card className={`lg:col-span-1 ${selectedPhone ? "hidden lg:block" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Percakapan ({contacts.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada percakapan</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {contacts.map((c) => (
                    <button
                      key={c.visitor_phone}
                      onClick={() => openContact(c.visitor_phone)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        selectedPhone === c.visitor_phone ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {c.visitor_name || "Visitor"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.visitor_phone}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(c.last_time).toLocaleString("id-ID")}
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
          <Card className={`lg:col-span-2 flex flex-col ${!selectedPhone ? "hidden lg:flex" : ""}`}>
            {selectedPhone ? (
              <>
                <div className="border-b border-border px-4 py-3 flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedPhone(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedContactInfo?.visitor_name || "Visitor"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedPhone}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: "55vh" }}>
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border px-4 py-3">
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-shrink-0"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                    </Button>
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik balasan manual..."
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
                    />
                    <Button onClick={() => sendReply()} disabled={!replyText.trim() || sending} size="icon">
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
