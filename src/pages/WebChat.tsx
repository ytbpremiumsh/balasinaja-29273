import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Send, Bot, User, Loader2, Image, LogOut } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  message_type?: string;
  created_at: string;
}

interface VisitorInfo {
  name: string;
  phone: string;
}

export default function WebChat() {
  const { token } = useParams<{ token: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [businessName, setBusinessName] = useState("Chat Support");
  const [botAvatar, setBotAvatar] = useState("");
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(() => {
    // Use localStorage for persistent session across browser restarts
    const stored = localStorage.getItem(`webchat_visitor_${token}`);
    return stored ? JSON.parse(stored) : null;
  });
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem(`webchat_session_${token}`);
    return stored || '';
  });
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetchInfo();
  }, [token]);

  useEffect(() => {
    if (isPremium === true && visitorInfo) fetchHistory();
  }, [isPremium, visitorInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isPremium || !visitorInfo) return;
    pollRef.current = setInterval(() => fetchHistory(), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isPremium, visitorInfo]);

  const callApi = async (body: any) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/web-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token }),
    });
    return res.json();
  };

  const fetchInfo = async () => {
    try {
      const data = await callApi({ action: "info" });
      if (data.business_name) setBusinessName(data.business_name);
      if (data.bot_avatar) setBotAvatar(data.bot_avatar);
      setIsPremium(data.is_premium !== false);
    } catch {
      setIsPremium(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await callApi({ action: "history", session_id: sessionId });
      if (data.messages) setMessages(data.messages);
    } catch {}
  };

  const handleStartChat = () => {
    if (!formName.trim() || !formPhone.trim()) return;
    const phone = formPhone.trim().replace(/[^0-9+]/g, "");
    if (phone.length < 8) return;
    const info = { name: formName.trim(), phone };
    setVisitorInfo(info);
    localStorage.setItem(`webchat_visitor_${token}`, JSON.stringify(info));
  };

  const handleLogout = () => {
    localStorage.removeItem(`webchat_visitor_${token}`);
    localStorage.removeItem(`webchat_session_${token}`);
    setVisitorInfo(null);
    setMessages([]);
    setFormName("");
    setFormPhone("");
  };

  const sendMessage = async (messageText?: string, messageType: string = 'text') => {
    const text = messageText || input.trim();
    if (!text || sending || !visitorInfo) return;
    if (!messageText) setInput("");
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "visitor",
      message: text,
      message_type: messageType,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const data = await callApi({
        action: "send",
        session_id: sessionId,
        message: text,
        message_type: messageType,
        visitor_name: visitorInfo.name,
        visitor_phone: visitorInfo.phone,
      });
      if (data.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          message: data.reply,
          message_type: 'text',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch {} finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `visitors/${sessionId}/${Date.now()}.${ext}`;
      
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/web-chat-attachments/${filePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: file,
      });

      if (!res.ok) throw new Error('Upload failed');

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/web-chat-attachments/${filePath}`;
      await sendMessage(publicUrl, 'image');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const BotAvatarEl = ({ size = "w-6 h-6" }: { size?: string }) => {
    if (botAvatar) {
      return <img src={botAvatar} alt="Bot" className={`${size} rounded-full object-cover`} />;
    }
    const iconSize = size === "w-10 h-10" ? "w-5 h-5" : "w-3 h-3";
    return (
      <div className={`${size} rounded-full bg-slate-200 flex items-center justify-center`}>
        <Bot className={`${iconSize} text-slate-600`} />
      </div>
    );
  };

  const formatText = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(https?:\/\/[^\s<]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
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

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.message_type === 'image') {
      return (
        <a href={msg.message} target="_blank" rel="noopener noreferrer">
          <img src={msg.message} alt="Attachment" className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90" />
        </a>
      );
    }
    return <p className="whitespace-pre-wrap leading-relaxed">{formatText(msg.message)}</p>;
  };

  if (isPremium === false) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <Bot className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-700">Chat Tidak Tersedia</h2>
        <p className="text-sm text-slate-500 mt-2">Fitur web chat ini belum diaktifkan oleh pemilik.</p>
      </div>
    );
  }

  if (isPremium === null) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Visitor registration form
  if (!visitorInfo) {
    return (
      <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
          {botAvatar ? (
            <img src={botAvatar} alt="Bot" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-sm">{businessName}</h1>
            <p className="text-xs text-blue-100">Online • Powered by BalasinAja</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
            <div className="text-center mb-6">
              {botAvatar ? (
                <img src={botAvatar} alt="Bot" className="w-16 h-16 mx-auto mb-3 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-blue-500" />
                </div>
              )}
              <h2 className="font-semibold text-slate-800">Selamat Datang! 👋</h2>
              <p className="text-sm text-slate-500 mt-1">Silakan isi data Anda untuk memulai percakapan</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Lengkap *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Masukkan nama Anda" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" onKeyDown={(e) => e.key === "Enter" && handleStartChat()} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor HP / WhatsApp *</label>
                <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" onKeyDown={(e) => e.key === "Enter" && handleStartChat()} />
              </div>
              <button onClick={handleStartChat} disabled={!formName.trim() || !formPhone.trim()} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                Mulai Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        {botAvatar ? (
          <img src={botAvatar} alt="Bot" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-semibold text-sm">{businessName}</h1>
          <p className="text-xs text-blue-100">Online • Powered by BalasinAja</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {botAvatar ? (
              <img src={botAvatar} alt="Bot" className="w-12 h-12 mx-auto mb-3 rounded-full object-cover" />
            ) : (
              <Bot className="w-12 h-12 mx-auto mb-3 text-blue-300" />
            )}
            <p className="font-medium text-slate-500">Halo, {visitorInfo.name}! 👋</p>
            <p>Silakan kirim pesan untuk memulai percakapan</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "visitor" ? "justify-end" : "justify-start"}`}>
            <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === "visitor" ? "flex-row-reverse" : ""}`}>
              {msg.sender === "visitor" ? (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-white" />
                </div>
              ) : (
                <div className="flex-shrink-0"><BotAvatarEl /></div>
              )}
              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.sender === "visitor"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : msg.sender === "admin"
                    ? "bg-emerald-50 text-slate-800 rounded-bl-md shadow-sm border border-emerald-200"
                    : "bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100"
              }`}>
                {msg.sender === "admin" && (
                  <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">Admin</p>
                )}
                {msg.sender === "ai" && (
                  <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Admin Ayo Pintar</p>
                )}
                {renderMessageContent(msg)}
                <p className={`text-[10px] mt-1 ${msg.sender === "visitor" ? "text-blue-200" : "text-slate-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        ))}
        {(sending || uploading) && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <BotAvatarEl />
              <div className="bg-white border border-slate-100 shadow-sm px-4 py-2 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: 100 }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Powered by <span className="font-semibold">BalasinAja</span>
        </p>
      </div>
    </div>
  );
}
