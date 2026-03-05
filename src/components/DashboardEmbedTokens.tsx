import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Key, Loader2, Plus, Trash2, Shield } from "lucide-react";

interface EmbedToken {
  id: string;
  token: string;
  label: string | null;
  duration: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const DURATION_OPTIONS = [
  { value: "1_day", label: "1 Hari" },
  { value: "1_month", label: "1 Bulan" },
  { value: "6_months", label: "6 Bulan" },
  { value: "12_months", label: "12 Bulan" },
  { value: "forever", label: "Selamanya" },
];

function calcExpiry(duration: string): string | null {
  const now = new Date();
  switch (duration) {
    case "1_day": return new Date(now.getTime() + 86400000).toISOString();
    case "1_month": return new Date(now.setMonth(now.getMonth() + 1)).toISOString();
    case "6_months": return new Date(now.setMonth(now.getMonth() + 6)).toISOString();
    case "12_months": return new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
    default: return null;
  }
}

export default function DashboardEmbedTokens() {
  const [tokens, setTokens] = useState<EmbedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDuration, setNewDuration] = useState("forever");
  const { toast } = useToast();
  const baseUrl = window.location.origin;

  useEffect(() => { fetchTokens(); }, []);

  const fetchTokens = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("dashboard_embed_tokens" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setTokens((data as any) || []);
    setLoading(false);
  };

  const createToken = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const expiresAt = calcExpiry(newDuration);
      const { error } = await supabase.from("dashboard_embed_tokens" as any).insert({
        user_id: session.user.id,
        label: newLabel || null,
        duration: newDuration,
        expires_at: expiresAt,
      } as any);

      if (error) throw error;
      setNewLabel("");
      setNewDuration("forever");
      await fetchTokens();
      toast({ title: "Berhasil", description: "Token embed baru berhasil dibuat" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleToken = async (id: string, currentActive: boolean) => {
    await supabase.from("dashboard_embed_tokens" as any).update({ is_active: !currentActive } as any).eq("id", id);
    await fetchTokens();
    toast({ title: currentActive ? "Token dinonaktifkan" : "Token diaktifkan" });
  };

  const deleteToken = async (id: string) => {
    await supabase.from("dashboard_embed_tokens" as any).delete().eq("id", id);
    await fetchTokens();
    toast({ title: "Token dihapus" });
  };

  const copyUrl = (token: string) => {
    const url = `${baseUrl}/embed/dashboard/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Disalin!", description: "URL embed berhasil disalin" });
  };

  const copyIframe = (token: string) => {
    const url = `${baseUrl}/embed/dashboard/${token}`;
    const code = `<iframe src="${url}" width="100%" height="700" style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1)"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Disalin!", description: "Kode iframe berhasil disalin" });
  };

  const isExpired = (t: EmbedToken) => t.expires_at && new Date(t.expires_at) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Embed Dashboard Token
        </CardTitle>
        <CardDescription>
          Buat token untuk embed Web Chat Dashboard ke website eksternal. Token mengontrol akses & bisa dinonaktifkan kapan saja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new token */}
        <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Buat Token Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Label (opsional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Website Utama" />
            </div>
            <div className="space-y-1">
              <Label>Masa Aktif</Label>
              <Select value={newDuration} onValueChange={setNewDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={createToken} disabled={creating} className="w-full">
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                Buat Token
              </Button>
            </div>
          </div>
        </div>

        {/* Token list */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : tokens.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Belum ada token embed. Buat token pertama Anda di atas.</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((t) => (
              <div key={t.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{t.label || "Token tanpa label"}</span>
                    {t.is_active && !isExpired(t) ? (
                      <Badge variant="default" className="bg-green-600">Aktif</Badge>
                    ) : isExpired(t) ? (
                      <Badge variant="destructive">Kedaluwarsa</Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                    <Badge variant="outline">
                      {DURATION_OPTIONS.find(o => o.value === t.duration)?.label || t.duration}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleToken(t.id, t.is_active)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteToken(t.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Dibuat: {new Date(t.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  {t.expires_at && <p>Kedaluwarsa: {new Date(t.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => copyUrl(t.token)}>
                    <Copy className="w-3 h-3 mr-1" /> Salin URL
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyIframe(t.token)}>
                    <Copy className="w-3 h-3 mr-1" /> Salin Iframe
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
