import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Send, Bot, User, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  created_at: string;
}

export default function WebChat() {
  const { token } = useParams<{ token: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [businessName, setBusinessName] = useState("Chat Support");
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem(`webchat_session_${token}`);
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(`webchat_session_${token}`, id);
    return id;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    fetchInfo();
    fetchHistory();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const data = await callApi({ action: "history", session_id: sessionId });
      if (data.messages) setMessages(data.messages);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic add
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "visitor",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const data = await callApi({ action: "send", session_id: sessionId, message: text });
      if (data.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          message: data.reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch {
      // Keep the visitor message even on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">{businessName}</h1>
          <p className="text-xs text-blue-100">Online • Powered by BalasinAja</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Bot className="w-12 h-12 mx-auto mb-3 text-blue-300" />
            <p className="font-medium text-slate-500">Halo! 👋</p>
            <p>Silakan kirim pesan untuk memulai percakapan</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "visitor" ? "justify-end" : "justify-start"}`}>
            <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === "visitor" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.sender === "visitor" ? "bg-blue-600" : "bg-slate-200"
              }`}>
                {msg.sender === "visitor" ? (
                  <User className="w-3 h-3 text-white" />
                ) : (
                  <Bot className="w-3 h-3 text-slate-600" />
                )}
              </div>
              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.sender === "visitor"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100"
              }`}>
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${
                  msg.sender === "visitor" ? "text-blue-200" : "text-slate-400"
                }`}>
                  {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                <Bot className="w-3 h-3 text-slate-600" />
              </div>
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
            onClick={sendMessage}
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
