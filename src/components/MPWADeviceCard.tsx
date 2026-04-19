import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, CheckCircle2, RefreshCw } from "lucide-react";

interface MPWADeviceCardProps {
  scope?: "user" | "admin";
  title?: string;
  description?: string;
}

export const MPWADeviceCard = ({
  scope = "user",
  title,
  description,
}: MPWADeviceCardProps = {}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deviceNumber, setDeviceNumber] = useState("");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    loadDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const loadDevice = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (scope === "admin") {
        const { data } = await supabase
          .from("wa_gateway_settings")
          .select("mpwa_admin_device_number, mpwa_admin_device_connected")
          .limit(1)
          .maybeSingle();
        if (data) {
          setDeviceNumber(data.mpwa_admin_device_number || "");
          setConnected(!!data.mpwa_admin_device_connected);
        }
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("mpwa_device_number, mpwa_device_connected")
          .eq("user_id", session.user.id)
          .single();
        if (data) {
          setDeviceNumber(data.mpwa_device_number || "");
          setConnected(!!data.mpwa_device_connected);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async () => {
    if (!/^\d{8,20}$/.test(deviceNumber)) {
      toast({
        title: "Nomor tidak valid",
        description: "Masukkan nomor HP angka saja, contoh 628123456789",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    setQrcode(null);
    setStatusMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("mpwa-generate-qr", {
        body: { device: deviceNumber, scope },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const res = data as { qrcode: string | null; message: string; connected: boolean };
      setQrcode(res.qrcode);
      setStatusMsg(res.message || "");
      setConnected(res.connected);
      if (res.connected) {
        toast({ title: "Sudah terhubung", description: "Device WhatsApp Anda sudah aktif" });
      } else if (res.qrcode) {
        toast({ title: "Scan QR", description: "Buka WhatsApp → Linked Devices → Scan QR" });
      } else {
        toast({
          title: "QR tidak tersedia",
          description: res.message || "Coba lagi dalam beberapa detik",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Gagal generate QR",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          {title || (scope === "admin" ? "Device MPWA Admin (Sender Sistem)" : "MPWA WhatsApp Device")}
        </CardTitle>
        <CardDescription>
          {description ||
            (scope === "admin"
              ? "Device global yang dipakai sistem untuk mengirim notifikasi (welcome, payment, dll)."
              : "Sistem menggunakan MPWA BalasinAja (Powered by Ayo Pintar). Cukup masukkan nomor HP Anda dan scan QR — tidak perlu API key.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nomor HP WhatsApp (sender)</Label>
          <Input
            value={deviceNumber}
            onChange={(e) => setDeviceNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="628123456789"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            Contoh: 628123456789 (gunakan kode negara, tanpa + atau spasi).
          </p>
        </div>

        {connected && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Device terhubung dan siap mengirim pesan.
          </div>
        )}

        <Button onClick={generateQR} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              {connected ? "Cek Status / Hubungkan Ulang" : "Generate QR"}
            </>
          )}
        </Button>

        {qrcode && (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4">
            <img
              src={qrcode}
              alt="QR Code MPWA"
              className="w-64 h-64 object-contain bg-white rounded"
            />
            <p className="text-sm text-muted-foreground text-center">
              Buka WhatsApp di HP Anda → ⋮ → <b>Linked Devices</b> → <b>Link a Device</b> → scan QR di atas.
              Setelah scan, klik tombol <b>Cek Status</b> untuk konfirmasi koneksi.
            </p>
          </div>
        )}

        {statusMsg && !qrcode && (
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
        )}
      </CardContent>
    </Card>
  );
};
