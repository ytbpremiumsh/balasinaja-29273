import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings, Copy, Check, Bot } from "lucide-react";

export default function APIConfiguration() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const [onesenderApiUrl, setOnesenderApiUrl] = useState("");
  const [onesenderApiKey, setOnesenderApiKey] = useState("");
  const [aiVendor, setAiVendor] = useState("openrouter");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [aiReplyEnabled, setAiReplyEnabled] = useState(true);
  const [webhookToken, setWebhookToken] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      loadSettings();
    });
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;

      const map: Record<string, string> = {};
      data.forEach((item) => (map[item.key] = item.value));

      setOnesenderApiUrl(map.onesender_api_url || "");
      setOnesenderApiKey(map.onesender_api_key || "");
      setAiVendor(map.ai_vendor || "openrouter");
      setAiApiKey(map.ai_api_key || "");
      setAiModel(map.ai_model || "");
      setSystemPrompt(map.system_prompt || "");
      setAiReplyEnabled(map.ai_reply_enabled === "true");

      // Load webhook token from profiles
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("webhook_token")
          .eq("user_id", session.user.id)
          .single();
        
        if (profile?.webhook_token) {
          setWebhookToken(profile.webhook_token);
        }
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      toast({
        title: "Error",
        description: "Gagal memuat pengaturan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const settingsToUpdate = [
        { key: "onesender_api_url", value: onesenderApiUrl },
        { key: "onesender_api_key", value: onesenderApiKey },
        { key: "ai_vendor", value: aiVendor },
        { key: "ai_api_key", value: aiApiKey },
        { key: "ai_model", value: aiModel },
        { key: "system_prompt", value: systemPrompt },
        { key: "ai_reply_enabled", value: aiReplyEnabled ? "true" : "false" },
      ];

      for (const s of settingsToUpdate) {
        const { error } = await supabase
          .from("settings")
          .upsert(
            {
              user_id: session.user.id,
              key: s.key,
              value: s.value,
            },
            { onConflict: "user_id,key" }
          );

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Pengaturan API berhasil disimpan",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = webhookToken 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/balasinaja?token=${webhookToken}`
    : "Loading...";

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="space-y-8">
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7" />
            Konfigurasi API
          </h1>
          <p className="text-muted-foreground">
            Kelola integrasi WhatsApp Gateway dan AI Anda
          </p>
        </div>

        {/* WEBHOOK URL */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Anda</CardTitle>
            <CardDescription>
              Setiap user memiliki URL webhook unik untuk menerima pesan dari OneSender / WA Gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-4 flex items-center gap-2">
              <code className="text-xs bg-background rounded px-3 py-2 flex-1 overflow-x-auto break-all">
                {webhookUrl}
              </code>
              <Button variant="outline" size="icon" onClick={copyWebhook} disabled={!webhookToken}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm font-medium text-yellow-800 mb-1">⚠️ Update Required di OneSender</p>
              <p className="text-xs text-yellow-700">
                URL webhook telah diperbarui untuk keamanan. Silakan copy URL baru di atas dan update di dashboard OneSender Anda.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Gunakan URL ini di dashboard OneSender Anda. Sistem akan otomatis memproses pesan dengan token autentikasi yang aman.
            </p>
          </CardContent>
        </Card>

        {/* ONESENDER CONFIG */}
        <Card>
          <CardHeader>
            <CardTitle>OneSender API</CardTitle>
            <CardDescription>Masukkan kredensial API dari OneSender</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>OneSender API URL</Label>
              <Input
                value={onesenderApiUrl}
                onChange={(e) => setOnesenderApiUrl(e.target.value)}
                placeholder="https://api.onesender.id"
              />
            </div>
            <div className="space-y-2">
              <Label>OneSender API Key</Label>
              <Input
                type="password"
                value={onesenderApiKey}
                onChange={(e) => setOnesenderApiKey(e.target.value)}
                placeholder="Masukkan API key"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI CONFIG */}
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>Konfigurasi vendor & model AI yang digunakan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            
            {/* TOGGLE DALAM CARD */}
            <div
              className={`p-4 rounded-lg border flex items-center justify-between transition ${
                aiReplyEnabled ? "border-green-500 bg-green-50" : "border-muted bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Bot className={`w-6 h-6 ${aiReplyEnabled ? "text-green-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="font-medium">Balasan Otomatis AI</p>
                  <p className="text-sm text-muted-foreground">
                    Status:{" "}
                    <span className={`font-semibold ${aiReplyEnabled ? "text-green-600" : "text-red-500"}`}>
                      {aiReplyEnabled ? "Aktif" : "Nonaktif"}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant={aiReplyEnabled ? "destructive" : "default"}
                onClick={() => setAiReplyEnabled(!aiReplyEnabled)}
              >
                {aiReplyEnabled ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>AI Vendor</Label>
              <Select value={aiVendor} onValueChange={setAiVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>AI API Key</Label>
              <Input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="Masukkan API key AI"
              />
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="cth: gpt-4-turbo"
              />
            </div>

            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Tulis prompt dasar untuk AI"
              />
            </div>
          </CardContent>
        </Card>

        {/* SAVE BUTTON */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </Layout>
  );
}
