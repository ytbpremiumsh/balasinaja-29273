import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldX } from "lucide-react";
import WebChatDashboard from "./WebChatDashboard";

export default function EmbedDashboard() {
  const { embedToken } = useParams<{ embedToken: string }>();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    validateToken();
  }, [embedToken]);

  const validateToken = async () => {
    if (!embedToken) {
      setStatus("invalid");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("dashboard_embed_tokens" as any)
        .select("user_id, is_active, expires_at")
        .eq("token", embedToken)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setStatus("invalid");
        return;
      }

      const tokenData = data as any;

      // Check expiration
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setStatus("invalid");
        return;
      }

      setUserId(tokenData.user_id);
      setStatus("valid");
    } catch {
      setStatus("invalid");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Memvalidasi akses...</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <ShieldX className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Akses Ditolak</h1>
          <p className="text-muted-foreground">
            Token embed tidak valid, sudah kedaluwarsa, atau telah dinonaktifkan oleh pemilik dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Pass userId as prop so the embedded dashboard knows which user's data to show
  return <WebChatDashboard embedUserId={userId} isEmbedded />;
}
