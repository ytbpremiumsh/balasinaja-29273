import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ExpiredUserGuard } from "@/components/ExpiredUserGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Code, Loader2, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WebChatEmbed() {
  const [loading, setLoading] = useState(true);
  const [webhookToken, setWebhookToken] = useState("");
  const { toast } = useToast();

  const baseUrl = window.location.origin;

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("webhook_token")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      setWebhookToken(data?.webhook_token || "");
    } catch (error) {
      console.error("Error loading token:", error);
    } finally {
      setLoading(false);
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

  var frame = document.createElement('div');
  frame.id = 'balasinaja-chat-frame';
  frame.style.cssText = 'position:fixed;bottom:90px;right:20px;width:380px;height:550px;z-index:9998;display:none;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2)';
  frame.innerHTML = '<iframe src="${chatUrl}" style="width:100%;height:100%;border:none"></iframe>';

  var open = false;
  btn.onclick = function() {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
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
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageCircle className="w-8 h-8 text-primary" />
              Web Chat
            </h1>
            <p className="text-muted-foreground mt-1">
              Embed chat widget ke website Anda untuk menerima pesan dari pengunjung
            </p>
          </div>

          {/* Direct URL */}
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
        </div>
      </ExpiredUserGuard>
    </Layout>
  );
}
