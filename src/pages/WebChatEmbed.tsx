import { useEffect, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { ExpiredUserGuard } from "@/components/ExpiredUserGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Code, Loader2, MessageCircle, Upload, Trash2, Crown, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function WebChatEmbed() {
  const [loading, setLoading] = useState(true);
  const [webhookToken, setWebhookToken] = useState("");
  const [userPlan, setUserPlan] = useState("");
  const [botAvatar, setBotAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const [widgetText, setWidgetText] = useState("Hubungi Kami 💬");
  const [widgetTextEnabled, setWidgetTextEnabled] = useState(true);
  const [savingWidget, setSavingWidget] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const baseUrl = window.location.origin;
  const isPremium = userPlan && userPlan !== "trial";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [profileRes, avatarRes, widgetTextRes, widgetEnabledRes] = await Promise.all([
        supabase.from("profiles").select("webhook_token, plan").eq("user_id", session.user.id).single(),
        supabase.from("settings").select("value").eq("user_id", session.user.id).eq("key", "chat_bot_avatar").maybeSingle(),
        supabase.from("settings").select("value").eq("user_id", session.user.id).eq("key", "chat_widget_text").maybeSingle(),
        supabase.from("settings").select("value").eq("user_id", session.user.id).eq("key", "chat_widget_text_enabled").maybeSingle(),
      ]);

      if (profileRes.data) {
        setWebhookToken(profileRes.data.webhook_token || "");
        setUserPlan(profileRes.data.plan || "trial");
      }
      if (avatarRes.data) setBotAvatar(avatarRes.data.value || "");
      if (widgetTextRes.data) setWidgetText(widgetTextRes.data.value || "Hubungi Kami 💬");
      if (widgetEnabledRes.data) setWidgetTextEnabled(widgetEnabledRes.data.value === "true");
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Hanya file gambar yang diperbolehkan", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const filePath = `${session.user.id}/bot-avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-avatars")
        .getPublicUrl(filePath);

      // Add cache buster
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Save to settings
      const { data: existing } = await supabase
        .from("settings")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("key", "chat_bot_avatar")
        .maybeSingle();

      if (existing) {
        await supabase.from("settings").update({ value: avatarUrl }).eq("id", existing.id);
      } else {
        await supabase.from("settings").insert({ user_id: session.user.id, key: "chat_bot_avatar", value: avatarUrl });
      }

      setBotAvatar(avatarUrl);
      toast({ title: "Berhasil", description: "Avatar bot berhasil diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from("settings").delete().eq("user_id", session.user.id).eq("key", "chat_bot_avatar");
      setBotAvatar("");
      toast({ title: "Berhasil", description: "Avatar bot dihapus" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const saveWidgetSettings = async () => {
    setSavingWidget(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const settings = [
        { key: "chat_widget_text", value: widgetText },
        { key: "chat_widget_text_enabled", value: String(widgetTextEnabled) },
      ];

      for (const s of settings) {
        const { data: existing } = await supabase
          .from("settings").select("id").eq("user_id", session.user.id).eq("key", s.key).maybeSingle();
        if (existing) {
          await supabase.from("settings").update({ value: s.value }).eq("id", existing.id);
        } else {
          await supabase.from("settings").insert({ user_id: session.user.id, key: s.key, value: s.value });
        }
      }
      toast({ title: "Berhasil", description: "Pengaturan widget disimpan" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingWidget(false);
    }
  };

  const chatUrl = `${baseUrl}/chat/${webhookToken}`;
  
  const iframeCode = `<iframe 
  src="${chatUrl}" 
  width="400" 
  height="600" 
  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
  allow="clipboard-write"
></iframe>`;

  const floatingWidgetCode = `<!-- BalasinAja Chat Widget -->
<script>
(function() {
  var btn = document.createElement('div');
  btn.id = 'balasinaja-chat-btn';
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:linear-gradient(135deg,#2563eb,#3b82f6);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;box-shadow:0 4px 20px rgba(37,99,235,0.4);z-index:9999;transition:transform 0.2s';
  btn.onmouseenter = function(){ this.style.transform='scale(1.1)' };
  btn.onmouseleave = function(){ this.style.transform='scale(1)' };
${widgetTextEnabled ? `
  var tooltip = document.createElement('div');
  tooltip.id = 'balasinaja-tooltip';
  tooltip.innerHTML = '${widgetText.replace(/'/g, "\\'")}';
  tooltip.style.cssText = 'position:fixed;bottom:30px;right:90px;background:#fff;color:#1e293b;padding:8px 16px;border-radius:20px;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;white-space:nowrap;animation:bsa-bounce 2s ease-in-out infinite';
  var style = document.createElement('style');
  style.textContent = '@keyframes bsa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}';
  document.head.appendChild(style);
  document.body.appendChild(tooltip);
` : ''}
  var frame = document.createElement('div');
  frame.id = 'balasinaja-chat-frame';
  frame.style.cssText = 'position:fixed;bottom:90px;right:20px;width:380px;height:550px;z-index:9998;display:none;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2)';
  frame.innerHTML = '<iframe src="${chatUrl}" style="width:100%;height:100%;border:none"></iframe>';

  var open = false;
  btn.onclick = function() {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    ${widgetTextEnabled ? "var tt = document.getElementById('balasinaja-tooltip'); if(tt) tt.style.display = open ? 'none' : 'block';" : ''}
    btn.innerHTML = open 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>';
  };

  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();
</script>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin!", description: `${label} berhasil disalin ke clipboard` });
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
      <ExpiredUserGuard>
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <MessageCircle className="w-8 h-8 text-primary" />
                Web Chat
              </h1>
              <p className="text-muted-foreground mt-1">
                Embed chat widget ke website Anda untuk menerima pesan dari pengunjung
              </p>
            </div>
            {isPremium && (
              <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                <Crown className="w-3 h-3 mr-1" /> Premium
              </Badge>
            )}
          </div>

          {!isPremium ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-12 text-center space-y-4">
                <Crown className="w-16 h-16 mx-auto text-amber-500" />
                <h2 className="text-xl font-bold text-amber-800">Fitur Premium</h2>
                <p className="text-amber-700 max-w-md mx-auto">
                  Web Chat hanya tersedia untuk pengguna premium. Upgrade paket Anda untuk mengaktifkan fitur chat widget yang bisa di-embed ke website.
                </p>
                <Button onClick={() => window.location.href = "/subscription"} className="bg-amber-500 hover:bg-amber-600">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade ke Premium
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Bot Avatar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Avatar Bot
                  </CardTitle>
                  <CardDescription>
                    Upload gambar profil untuk bot chat Anda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {botAvatar ? (
                      <img src={botAvatar} alt="Bot Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                        <MessageCircle className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {botAvatar ? "Ganti Avatar" : "Upload Avatar"}
                      </Button>
                      {botAvatar && (
                        <Button variant="outline" onClick={removeAvatar} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Widget Text Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Teks Floating Widget
                  </CardTitle>
                  <CardDescription>
                    Atur teks tooltip yang muncul di samping tombol chat melayang
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="widget-text-toggle">Tampilkan teks tooltip</Label>
                    <Switch
                      id="widget-text-toggle"
                      checked={widgetTextEnabled}
                      onCheckedChange={setWidgetTextEnabled}
                    />
                  </div>
                  {widgetTextEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="widget-text">Teks Tooltip</Label>
                      <Input
                        id="widget-text"
                        value={widgetText}
                        onChange={(e) => setWidgetText(e.target.value)}
                        placeholder="Hubungi Kami 💬"
                      />
                    </div>
                  )}
                  <Button onClick={saveWidgetSettings} disabled={savingWidget}>
                    {savingWidget ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Simpan Pengaturan
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" />
                    URL Chat Langsung
                  </CardTitle>
                  <CardDescription>
                    Bagikan URL ini agar pengunjung bisa langsung chat dengan AI Anda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={chatUrl} readOnly className="font-mono text-sm" />
                    <Button variant="outline" onClick={() => copyToClipboard(chatUrl, "URL")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={() => window.open(chatUrl, '_blank')}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Embed Codes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Kode Embed
                  </CardTitle>
                  <CardDescription>
                    Pilih cara embed yang sesuai untuk website Anda
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="iframe">
                    <TabsList>
                      <TabsTrigger value="iframe">Iframe</TabsTrigger>
                      <TabsTrigger value="floating">Floating Widget</TabsTrigger>
                    </TabsList>
                    <TabsContent value="iframe" className="space-y-3">
                      <Label>Kode Iframe</Label>
                      <p className="text-sm text-muted-foreground">
                        Tempelkan kode ini di halaman website Anda untuk menampilkan chat box
                      </p>
                      <Textarea value={iframeCode} readOnly rows={6} className="font-mono text-xs" />
                      <Button variant="outline" onClick={() => copyToClipboard(iframeCode, "Kode iframe")}>
                        <Copy className="w-4 h-4 mr-2" /> Salin Kode Iframe
                      </Button>
                    </TabsContent>
                    <TabsContent value="floating" className="space-y-3">
                      <Label>Kode Floating Widget</Label>
                      <p className="text-sm text-muted-foreground">
                        Tempelkan kode ini sebelum tag &lt;/body&gt; di website Anda untuk menampilkan tombol chat melayang
                      </p>
                      <Textarea value={floatingWidgetCode} readOnly rows={8} className="font-mono text-xs" />
                      <Button variant="outline" onClick={() => copyToClipboard(floatingWidgetCode, "Kode widget")}>
                        <Copy className="w-4 h-4 mr-2" /> Salin Kode Widget
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>Tampilan chat widget pada website Anda</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <iframe
                      src={chatUrl}
                      width="380"
                      height="550"
                      style={{ border: "none", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ExpiredUserGuard>
    </Layout>
  );
}
