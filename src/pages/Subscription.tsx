import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Clock } from "lucide-react";
import qrisImage from "@/assets/qris.png";
import ewalletImage from "@/assets/e-wallet.png";
import transferImage from "@/assets/transfer-bank.png";

type PackageType = {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  description: string | null;
};

export default function Subscription() {
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("duration_days", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Gagal mengambil data paket",
        variant: "destructive",
      });
    } else {
      setPackages(data || []);
    }
  };

  const handleMayarPayment = async () => {
    if (!selectedPackage) {
      toast({
        title: "Error",
        description: "Pilih paket terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tidak terautentikasi");

      const { data, error } = await supabase.functions.invoke('mayar-checkout', {
        body: { package_id: selectedPackage }
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("Checkout URL tidak ditemukan");
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Perpanjangan Langganan</h1>
          <p className="text-muted-foreground">Pilih paket dan lakukan pembayaran</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Package Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Paket Langganan
              </CardTitle>
              <CardDescription>Pilih paket yang sesuai dengan kebutuhan Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPackage === pkg.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{pkg.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pkg.duration_days} hari
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatPrice(pkg.price)}</p>
                    </div>
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payment Section */}
          <div className="space-y-6">
            {selectedPkg && (
              <Card>
                <CardHeader>
                  <CardTitle>Rincian Pembayaran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Paket</span>
                    <span className="font-semibold">{selectedPkg.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Durasi</span>
                    <span className="font-semibold">{selectedPkg.duration_days} hari</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-primary/5 px-4 rounded-lg">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-lg text-primary">{formatPrice(selectedPkg.price)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Metode Pembayaran</CardTitle>
                <CardDescription>Pilih metode pembayaran yang Anda inginkan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-4 border rounded-lg bg-muted/30">
                    <img src={qrisImage} alt="QRIS" className="h-12 mb-2 object-contain" />
                    <span className="text-sm font-semibold">QRIS</span>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-lg bg-muted/30">
                    <img src={ewalletImage} alt="E-Wallet" className="h-12 mb-2 object-contain" />
                    <span className="text-sm font-semibold">E-Wallet</span>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-lg bg-muted/30">
                    <img src={transferImage} alt="Transfer" className="h-12 mb-2 object-contain" />
                    <span className="text-sm font-semibold">Transfer</span>
                  </div>
                </div>

                <Button
                  onClick={handleMayarPayment}
                  disabled={!selectedPackage || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Memproses..." : "Bayar Sekarang"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Pembayaran dilakukan melalui Mayar dengan berbagai metode pembayaran yang tersedia
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
