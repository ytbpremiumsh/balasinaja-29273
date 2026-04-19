import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Radio } from "lucide-react";

export default function WAGateway() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rowId, setRowId] = useState<string | null>(null);
  const [activeGateway, setActiveGateway] = useState<"onesender" | "mpwa">("onesender");
  const [mpwaApiKey, setMpwaApiKey] = useState("");
  const [mpwaApiUrl, setMpwaApiUrl] = useState("https://app.ayopintar.com");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("wa_gateway_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRowId(data.id);
        setActiveGateway((data.active_gateway as "onesender" | "mpwa") || "onesender");
        setMpwaApiKey(data.mpwa_api_key || "");
        setMpwaApiUrl(data.mpwa_api_url || "https://app.ayopintar.com");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Gagal memuat pengaturan gateway", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        active_gateway: activeGateway,
        mpwa_api_key: mpwaApiKey,
        mpwa_api_url: mpwaApiUrl,
      };
      let error;
      if (rowId) {
        ({ error } = await supabase.from("wa_gateway_settings").update(payload).eq("id", rowId));
      } else {
        const { data, error: insErr } = await supabase
          .from("wa_gateway_settings")
          .insert(payload)
          .select("id")
          .single();
        error = insErr;
        if (data) setRowId(data.id);
      }
      if (error) throw error;
      toast({ title: "Berhasil", description: "Pengaturan WA Gateway tersimpan" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Gagal menyimpan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radio className="w-7 h-7" />
            WA Gateway Global
          </h1>
          <p className="text-muted-foreground">
            Pilih gateway WhatsApp aktif untuk seluruh user. Pengguna hanya perlu memasukkan nomor HP & scan QR (untuk MPWA) atau mengisi API OneSender.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pilih Gateway Aktif</CardTitle>
            <CardDescription>Hanya satu gateway yang aktif pada satu waktu, berlaku untuk semua user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Gateway Aktif</Label>
              <Select value={activeGateway} onValueChange={(v) => setActiveGateway(v as "onesender" | "mpwa")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onesender">OneSender (per-user API)</SelectItem>
                  <SelectItem value="mpwa">MPWA BalasinAja (Powered by Ayo Pintar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi MPWA BalasinAja</CardTitle>
            <CardDescription>
              API Key dan endpoint MPWA diisi global oleh admin. User tidak akan melihat API key ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>MPWA API URL</Label>
              <Input
                value={mpwaApiUrl}
                onChange={(e) => setMpwaApiUrl(e.target.value)}
                placeholder="https://app.ayopintar.com"
              />
            </div>
            <div className="space-y-2">
              <Label>MPWA API Key</Label>
              <Input
                type="password"
                value={mpwaApiKey}
                onChange={(e) => setMpwaApiKey(e.target.value)}
                placeholder="Masukkan API Key MPWA"
              />
              <p className="text-xs text-muted-foreground">
                Dapatkan API key dari dashboard Ayo Pintar / MPWA Anda.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4 mr-2" />Simpan</>}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
