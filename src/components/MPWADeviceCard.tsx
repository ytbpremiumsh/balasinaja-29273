import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, CheckCircle2, RefreshCw, Timer } from "lucide-react";

interface MPWADeviceCardProps {
  scope?: "user" | "admin";
  title?: string;
  description?: string;
}

const QR_LIFETIME_SECONDS = 30; // auto-refresh QR every 30s
const POLL_INTERVAL_MS = 4000; // check connection every 4s

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
  const [secondsLeft, setSecondsLeft] = useState(0);

  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const generatingRef = useRef(false);
  const qrcodeRef = useRef<string | null>(null);

  useEffect(() => {
    qrcodeRef.current = qrcode;
  }, [qrcode]);

  useEffect(() => {
    loadDevice();
    return () => {
      stopPolling();
      stopCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  const stopCountdown = () => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

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

  const callGenerate = async (silent = false) => {
    if (generatingRef.current) return null;
    generatingRef.current = true;
    if (!silent) setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpwa-generate-qr", {
        body: { device: deviceNumber, scope },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { qrcode: string | null; message: string; connected: boolean };
    } catch (err: any) {
      if (!silent) {
        toast({
          title: "Error",
          description: err?.message || "Gagal generate QR",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      generatingRef.current = false;
      if (!silent) setGenerating(false);
    }
  };

  const refreshQR = async () => {
    const res = await callGenerate(true);
    if (!res) return;
    if (res.connected) {
      setConnected(true);
      setQrcode(null);
      stopPolling();
      stopCountdown();
      toast({
        title: "✅ Berhasil terhubung!",
        description: "Device WhatsApp Anda sudah aktif.",
      });
      return;
    }
    if (res.qrcode) setQrcode(res.qrcode);
  };

  const startCountdown = () => {
    stopCountdown();
    setSecondsLeft(QR_LIFETIME_SECONDS);
    countdownRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          refreshQR();
          return QR_LIFETIME_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const res = await callGenerate(true);
      if (!res) return;
      if (res.connected) {
        setConnected(true);
        setQrcode(null);
        setStatusMsg(res.message || "Device terhubung");
        stopPolling();
        stopCountdown();
        toast({
          title: "✅ Berhasil terhubung!",
          description: "Device WhatsApp Anda sudah aktif dan siap mengirim pesan.",
        });
      } else if (res.qrcode && res.qrcode !== qrcodeRef.current) {
        setQrcode(res.qrcode);
      }
    }, POLL_INTERVAL_MS);
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
    setQrcode(null);
    setStatusMsg("");
    setConnected(false);
    stopPolling();
    stopCountdown();

    const res = await callGenerate(false);
    if (!res) return;

    setStatusMsg(res.message || "");
    setConnected(res.connected);

    if (res.connected) {
      toast({ title: "✅ Sudah terhubung", description: "Device WhatsApp Anda sudah aktif." });
      return;
    }
    if (res.qrcode) {
      setQrcode(res.qrcode);
      toast({ title: "Scan QR", description: "Buka WhatsApp → Linked Devices → Scan QR" });
      startCountdown();
      startPolling();
    } else {
      toast({
        title: "QR tidak tersedia",
        description: res.message || "Coba lagi dalam beberapa detik",
        variant: "destructive",
      });
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
            disabled={connected}
          />
          <p className="text-xs text-muted-foreground">
            Contoh: 628123456789 (gunakan kode negara, tanpa + atau spasi).
          </p>
        </div>

        {connected && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-green-500 bg-green-50 p-4 text-green-800">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">Device berhasil terhubung!</p>
              <p className="text-sm">WhatsApp Anda sudah aktif dan siap mengirim pesan otomatis.</p>
            </div>
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
              {connected ? "Hubungkan Ulang" : "Generate QR"}
            </>
          )}
        </Button>

        {qrcode && !connected && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <img
              src={qrcode}
              alt="QR Code MPWA"
              className="w-64 h-64 object-contain bg-white rounded"
            />
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Timer className="w-4 h-4" />
              QR diperbarui dalam <span className="tabular-nums">{secondsLeft}</span> detik
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Menunggu scan... (deteksi koneksi otomatis)
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Buka WhatsApp di HP Anda → ⋮ → <b>Linked Devices</b> → <b>Link a Device</b> → scan QR di atas.
            </p>
          </div>
        )}

        {statusMsg && !qrcode && !connected && (
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
        )}
      </CardContent>
    </Card>
  );
};
