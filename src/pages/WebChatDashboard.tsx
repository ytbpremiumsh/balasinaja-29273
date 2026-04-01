import { useEffect, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, User, Bot, ArrowLeft, Phone, Loader2, Image, Trash2, Zap, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface ChatContact {
  visitor_phone: string;
  visitor_name: string | null;
  last_message: string;
  last_sender: string;
  last_time: string;
  session_ids: string[];
  unread: boolean;
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

interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
}

interface WebChatDashboardProps {
  embedUserId?: string | null;
  embedToken?: string | null;
  isEmbedded?: boolean;
}

export default function WebChatDashboard({ embedUserId, embedToken, isEmbedded }: WebChatDashboardProps = {}) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [readTimestamps, setReadTimestamps] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('webchat_read_ts') || '{}');
    } catch { return {}; }
  });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-chat-proxy`;

  const callProxy = async (action: string, extra: Record<string, any> = {}) => {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ embedToken, action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Proxy error');
    return json;
  };

  useEffect(() => {
    fetchContacts();
    fetchKnowledge();
    
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

  const fetchKnowledge = async () => {
    if (embedToken) {
      const json = await callProxy('fetch_knowledge');
      setKnowledgeItems(json.data || []);
      return;
    }
    const { data } = await supabase
      .from('ai_knowledge_base')
      .select('id, question, answer')
      .order('created_at', { ascending: false });
    setKnowledgeItems(data || []);
  };

  const getUserId = async (): Promise<string | null> => {
    if (embedUserId) return embedUserId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  };

  const fetchContacts = async () => {
    try {
      let data: any[] | null = null;

      if (embedToken) {
        const json = await callProxy('fetch_contacts');
        data = json.data;
      } else {
        const userId = await getUserId();
        if (!userId) return;
        const res = await supabase
          .from('web_chats')
          .select('session_id, sender, message, message_type, created_at, visitor_name, visitor_phone')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (res.error) throw res.error;
        data = res.data;
      }

      const phoneMap = new Map<string, ChatContact>();
      data?.forEach((msg) => {
        const phone = msg.visitor_phone || 'unknown';
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, {
            visitor_phone: phone,
            visitor_name: msg.visitor_name,
            last_message: msg.message,
            last_sender: msg.sender,
            last_time: msg.created_at,
            session_ids: [msg.session_id],
            unread: false,
          });
        } else {
          const c = phoneMap.get(phone)!;
          if (!c.visitor_name && msg.visitor_name) c.visitor_name = msg.visitor_name;
          if (!c.session_ids.includes(msg.session_id)) c.session_ids.push(msg.session_id);
        }
      });

      const contactList = Array.from(phoneMap.values());
      contactList.forEach((c) => {
        const lastRead = readTimestamps[c.visitor_phone];
        if (!lastRead || new Date(c.last_time) > new Date(lastRead)) {
          if (c.last_sender !== 'admin') c.unread = true;
        }
      });

      contactList.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
      setContacts(contactList);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (phone: string) => {
    if (embedToken) {
      const json = await callProxy('fetch_messages', { phone });
      setMessages(json.data || []);
      return;
    }
    const userId = await getUserId();
    if (!userId) return;

    const { data } = await supabase
      .from('web_chats')
      .select('id, sender, message, message_type, created_at, visitor_name, session_id')
      .eq('user_id', userId)
      .eq('visitor_phone', phone)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  const openContact = (phone: string) => {
    setSelectedPhone(phone);
    fetchMessages(phone);
    const updated = { ...readTimestamps, [phone]: new Date().toISOString() };
    setReadTimestamps(updated);
    localStorage.setItem('webchat_read_ts', JSON.stringify(updated));
    setContacts(prev => prev.map(c => c.visitor_phone === phone ? { ...c, unread: false } : c));
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
      const sessionId = getLatestSessionId() || crypto.randomUUID();

      if (embedToken) {
        await callProxy('send_reply', {
          message: text,
          messageType,
          sessionId,
          visitorPhone: selectedPhone,
        });
      } else {
        const userId = await getUserId();
        if (!userId) throw new Error("Not authenticated");

        const { error } = await supabase.from('web_chats').insert({
          user_id: userId,
          session_id: sessionId,
          sender: 'admin',
          message: text,
          message_type: messageType,
          visitor_phone: selectedPhone,
        });
        if (error) throw error;
      }

      if (!messageText) setReplyText("");
      setShowQuickReplies(false);
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
      const userId = await getUserId();
      if (!userId) throw new Error("Not authenticated");

      const ext = file.name.split('.').pop();
      const filePath = `${userId}/${Date.now()}.${ext}`;

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

  const useQuickReply = (answer: string) => {
    setReplyText(answer);
    setShowQuickReplies(false);
  };

  const sendQuickReply = (answer: string) => {
    sendReply(answer);
  };

  const filteredKnowledge = knowledgeItems.filter((k) => {
    if (!knowledgeSearch.trim()) return true;
    const s = knowledgeSearch.toLowerCase();
    return k.question.toLowerCase().includes(s) || k.answer.toLowerCase().includes(s);
  });

  const selectedContactInfo = contacts.find(c => c.visitor_phone === selectedPhone);

  const formatMessageText = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    const regex = /(\*\*(.+?)\*\*)|(https?:\/\/[^\s<]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      if (match[1]) {
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        const url = match[3];
        parts.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">
            {url.length > 50 ? url.slice(0, 50) + '…' : url}
          </a>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

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
              <p className="text-[10px] font-semibold opacity-75 mb-0.5">Admin Ayo Pintar</p>
            )}
            {isImage ? (
              <a href={msg.message} target="_blank" rel="noopener noreferrer">
                <img src={msg.message} alt="Attachment" className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90" />
              </a>
            ) : (
              <p className="whitespace-pre-wrap">{formatMessageText(msg.message)}</p>
            )}
            <p className={`text-[10px] mt-1 opacity-60`}>
              {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const content = (
    <div className={`space-y-4 ${isEmbedded ? 'p-4' : ''}`}>
      <div className="flex items-center gap-3">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Web Chat Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
        {/* Contact List */}
        <Card className={`lg:col-span-1 flex flex-col overflow-hidden ${selectedPhone ? "hidden lg:flex" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Percakapan ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
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
                      <div className="relative w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                        {c.unread && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${c.unread ? "font-bold" : "font-medium"}`}>
                            {c.visitor_name || "Visitor"}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                            {new Date(c.last_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c.visitor_phone}
                        </p>
                        <p className={`text-xs truncate mt-0.5 ${c.unread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                          {c.last_sender === 'admin' ? '✓ Anda: ' : c.last_sender === 'ai' ? 'Admin Ayo Pintar: ' : ''}
                          {c.last_message}
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
        <Card className={`lg:col-span-2 flex flex-col overflow-hidden ${!selectedPhone ? "hidden lg:flex" : ""}`}>
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

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {messages.map((msg, idx) => {
                  const msgDate = new Date(msg.created_at).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                  const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : null;
                  const showDateSeparator = idx === 0 || msgDate !== prevDate;
                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                            {msgDate}
                          </div>
                        </div>
                      )}
                      {renderMessage(msg)}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies from Knowledge Base */}
              {showQuickReplies && (
                <div className="border-t border-border bg-muted/30 max-h-[200px] overflow-y-auto">
                  <div className="px-4 py-2 sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">Balasan Pintas dari Knowledge Base</span>
                    </div>
                    <Input
                      value={knowledgeSearch}
                      onChange={(e) => setKnowledgeSearch(e.target.value)}
                      placeholder="Cari knowledge..."
                      className="mt-2 h-8 text-xs"
                    />
                  </div>
                  {filteredKnowledge.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                      {knowledgeItems.length === 0 ? "Belum ada data Knowledge Base" : "Tidak ditemukan"}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredKnowledge.map((k) => (
                        <div key={k.id} className="px-4 py-2 hover:bg-muted/50 transition-colors">
                          <p className="text-xs font-medium text-foreground truncate">Q: {k.question}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">A: {k.answer}</p>
                          <div className="flex gap-2 mt-1.5">
                            <button
                              onClick={() => useQuickReply(k.answer)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              Gunakan
                            </button>
                            <button
                              onClick={() => sendQuickReply(k.answer)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            >
                              Kirim Langsung
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  <Button
                    variant={showQuickReplies ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="flex-shrink-0"
                    title="Balasan Pintas"
                  >
                    <Zap className="w-4 h-4" />
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
  );

  if (isEmbedded) return content;
  return <Layout>{content}</Layout>;
}
