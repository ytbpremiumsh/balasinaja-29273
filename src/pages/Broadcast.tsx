import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ExpiredUserGuard } from "@/components/ExpiredUserGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Plus, Trash2, Edit, Users, Radio, Calendar, FileText, CheckCircle, XCircle, Clock, Download, Link, Phone, Copy } from "lucide-react";
import { TemplateLibrary } from "@/components/broadcast/TemplateLibrary";
import { CSVUpload } from "@/components/broadcast/CSVUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Contact {
  id: string;
  phone: string;
  name: string;
}

interface BroadcastStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface BroadcastButton {
  type: "reply" | "call" | "url" | "copy";
  displayText: string;
  phoneNumber?: string;
  url?: string;
  copyText?: string;
}

export default function Broadcast() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [delayMin, setDelayMin] = useState(1);
  const [delayMax, setDelayMax] = useState(3);
  const [usePersonalization, setUsePersonalization] = useState(false);
  const [buttons, setButtons] = useState<BroadcastButton[]>([]);
  
  // Real-time stats
  const [currentBroadcastId, setCurrentBroadcastId] = useState<string | null>(null);
  const [broadcastStats, setBroadcastStats] = useState<BroadcastStats>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0
  });
  
  // Category dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  
  // Manage contacts dialog states
  const [manageContactsDialogOpen, setManageContactsDialogOpen] = useState(false);
  const [selectedCategoryForManage, setSelectedCategoryForManage] = useState<string>("");
  const [categoryContacts, setCategoryContacts] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
    loadContacts();
  }, []);

  // Real-time subscription for broadcast queue updates
  useEffect(() => {
    if (!currentBroadcastId) return;

    const channel = supabase
      .channel('broadcast-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcast_queue',
          filter: `broadcast_log_id=eq.${currentBroadcastId}`
        },
        () => {
          fetchBroadcastStats(currentBroadcastId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBroadcastId]);

  const fetchBroadcastStats = async (broadcastId: string) => {
    const { data, error } = await supabase
      .from("broadcast_queue")
      .select("status")
      .eq("broadcast_log_id", broadcastId);

    if (error) {
      console.error("Error fetching stats:", error);
      return;
    }

    const stats = {
      total: data?.length || 0,
      sent: data?.filter(q => q.status === "sent").length || 0,
      failed: data?.filter(q => q.status === "failed").length || 0,
      pending: data?.filter(q => q.status === "pending" || q.status === "processing").length || 0
    };

    setBroadcastStats(stats);
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading categories",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading contacts",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createCategory = async () => {
    if (!categoryName.trim()) {
      toast({
        title: "Error",
        description: "Nama kategori harus diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("categories").insert({
        user_id: user.id,
        name: categoryName,
        description: categoryDescription,
      });

      if (error) throw error;

      toast({
        title: "Sukses!",
        description: "Kategori berhasil dibuat",
      });

      setCategoryName("");
      setCategoryDescription("");
      setCategoryDialogOpen(false);
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Yakin ingin menghapus kategori ini?")) return;

    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Sukses!",
        description: "Kategori berhasil dihapus",
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadCategoryContacts = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from("contact_categories")
        .select("contact_id")
        .eq("category_id", categoryId);

      if (error) throw error;

      setCategoryContacts(data?.map((cc) => cc.contact_id) || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openManageContactsDialog = (categoryId: string) => {
    setSelectedCategoryForManage(categoryId);
    loadCategoryContacts(categoryId);
    setManageContactsDialogOpen(true);
  };

  const toggleContactInCategory = async (contactId: string, checked: boolean) => {
    try {
      if (checked) {
        const { error } = await supabase.from("contact_categories").insert({
          category_id: selectedCategoryForManage,
          contact_id: contactId,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contact_categories")
          .delete()
          .eq("category_id", selectedCategoryForManage)
          .eq("contact_id", contactId);

        if (error) throw error;
      }

      loadCategoryContacts(selectedCategoryForManage);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string) => {
    setMessage(prev => prev + variable);
  };

  const addBroadcastButton = (type: BroadcastButton["type"]) => {
    if (buttons.length >= 5) return;
    setButtons((prev) => [...prev, { type, displayText: type === "reply" ? "Balas" : type === "call" ? "Telepon" : type === "url" ? "Buka Link" : "Salin" }]);
  };

  const updateBroadcastButton = (index: number, updates: Partial<BroadcastButton>) => {
    setButtons((prev) => prev.map((button, i) => (i === index ? { ...button, ...updates } : button)));
  };

  const removeBroadcastButton = (index: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  };

  const sendBroadcast = async () => {
    if (!selectedCategory) {
      toast({
        title: "Error",
        description: "Pilih kategori terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Pesan tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get contacts in category
      const { data: contactCategories, error: ccError } = await supabase
        .from("contact_categories")
        .select("contacts(*)")
        .eq("category_id", selectedCategory);

      if (ccError) throw ccError;

      // Filter only opt-in contacts
      const recipients = contactCategories
        ?.filter((cc: any) => cc.contacts.opt_in !== false)
        .map((cc: any) => ({
          phone: cc.contacts.phone,
          name: cc.contacts.name,
        })) || [];

      if (recipients.length === 0) {
        toast({
          title: "Error",
          description: "Tidak ada kontak di kategori ini",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Reset stats
      setBroadcastStats({
        total: recipients.length,
        sent: 0,
        failed: 0,
        pending: recipients.length
      });

      // Call edge function to send broadcast
      const { data, error } = await supabase.functions.invoke("send-broadcast", {
        body: {
          recipients,
          message,
          category_id: selectedCategory,
          media_type: mediaType,
          media_url: mediaUrl || undefined,
          scheduled_at: scheduledAt || undefined,
          delay_min: delayMin,
          delay_max: delayMax,
          use_personalization: usePersonalization,
          buttons: buttons.filter((button) => button.displayText.trim()),
        },
      });

      if (error) throw error;

      // Set the broadcast ID for real-time updates
      if (data?.broadcast_id) {
        setCurrentBroadcastId(data.broadcast_id);
        fetchBroadcastStats(data.broadcast_id);
      }

      const isScheduled = data?.scheduled;
      toast({
        title: isScheduled ? "Broadcast Dijadwalkan!" : "Broadcast Terkirim!",
        description: isScheduled 
          ? `Pesan dijadwalkan untuk ${recipients.length} kontak`
          : `Terkirim: ${data?.sent || 0}, Gagal: ${data?.failed || 0}`,
      });

      setMessage("");
      setSelectedCategory("");
      setMediaUrl("");
      setScheduledAt("");
      setButtons([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = broadcastStats.total > 0 
    ? ((broadcastStats.sent + broadcastStats.failed) / broadcastStats.total) * 100 
    : 0;

  return (
    <Layout>
      <ExpiredUserGuard>
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Radio className="w-8 h-8 text-primary" />
              Broadcast
            </h1>
            <p className="text-muted-foreground mt-2">
              Kirim pesan ke banyak kontak sekaligus berdasarkan kategori
            </p>
          </div>

          {/* Real-time Status Cards */}
          {currentBroadcastId && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{broadcastStats.total}</p>
                    </div>
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600">Terkirim</p>
                      <p className="text-2xl font-bold text-green-600">{broadcastStats.sent}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600">Gagal</p>
                      <p className="text-2xl font-bold text-red-600">{broadcastStats.failed}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-yellow-500/10 border-yellow-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-600">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">{broadcastStats.pending}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Progress Bar */}
          {currentBroadcastId && broadcastStats.total > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress Pengiriman</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Category & Upload */}
            <div className="space-y-6">
              {/* Categories Management */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Kategori
                    </span>
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Buat Kategori Baru</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="category-name">Nama Kategori</Label>
                            <Input
                              id="category-name"
                              value={categoryName}
                              onChange={(e) => setCategoryName(e.target.value)}
                              placeholder="Contoh: Pelanggan VIP"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="category-desc">Deskripsi (Opsional)</Label>
                            <Textarea
                              id="category-desc"
                              value={categoryDescription}
                              onChange={(e) => setCategoryDescription(e.target.value)}
                              placeholder="Deskripsi kategori..."
                            />
                          </div>
                          <Button onClick={createCategory} className="w-full">
                            Simpan Kategori
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">
                      Belum ada kategori
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-2 border rounded-lg text-sm"
                        >
                          <span className="font-medium truncate">{category.name}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openManageContactsDialog(category.id)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteCategory(category.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CSV Upload */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Upload CSV
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const csvContent = "phone,name\n62812345678,John Doe\n62898765432,Jane Smith";
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'template_kontak.csv';
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CSVUpload onContactsUploaded={loadContacts} />
                </CardContent>
              </Card>

              {/* Template Library */}
              <TemplateLibrary
                onSelectTemplate={(template) => {
                  setMessage(template.message);
                  setMediaType(template.media_type);
                  setMediaUrl(template.media_url || "");
                }}
              />
            </div>

            {/* Right Column - Broadcast Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-card gradient-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Kirim Broadcast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category-select">Pilih Kategori</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger id="category-select">
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="media-type">Tipe Media</Label>
                      <Select value={mediaType} onValueChange={setMediaType}>
                        <SelectTrigger id="media-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {mediaType !== "text" && (
                    <div className="space-y-2">
                      <Label htmlFor="media-url">URL Media</Label>
                      <Input
                        id="media-url"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pastikan URL dapat diakses publik
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="broadcast-message">Pesan Broadcast</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUsePersonalization(!usePersonalization)}
                        className={usePersonalization ? "text-primary" : ""}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Personalisasi {usePersonalization ? "✓" : ""}
                      </Button>
                    </div>
                    <Textarea
                      id="broadcast-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tulis pesan..."
                      className="min-h-[120px]"
                    />
                    
                    {/* Variable Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <p className="text-xs text-muted-foreground w-full">Klik untuk menambahkan variabel:</p>
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => insertVariable("{{nama}}")}
                      >
                        {"{{nama}}"}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => insertVariable("{{phone}}")}
                      >
                        {"{{phone}}"}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => insertVariable("{{tanggal}}")}
                      >
                        {"{{tanggal}}"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Tombol MPWA (Opsional)</Label>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => addBroadcastButton("reply")} disabled={buttons.length >= 5}>Reply</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBroadcastButton("call")} disabled={buttons.length >= 5}><Phone className="w-3 h-3" /></Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBroadcastButton("url")} disabled={buttons.length >= 5}><Link className="w-3 h-3" /></Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addBroadcastButton("copy")} disabled={buttons.length >= 5}><Copy className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    {buttons.map((button, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_auto] gap-2 items-end">
                        <Select value={button.type} onValueChange={(value) => updateBroadcastButton(index, { type: value as BroadcastButton["type"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reply">Reply</SelectItem>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                            <SelectItem value="copy">Copy</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input value={button.displayText} onChange={(e) => updateBroadcastButton(index, { displayText: e.target.value })} placeholder="Label tombol" maxLength={24} />
                        <Input
                          value={button.type === "call" ? button.phoneNumber || "" : button.type === "url" ? button.url || "" : button.type === "copy" ? button.copyText || "" : ""}
                          onChange={(e) => updateBroadcastButton(index, button.type === "call" ? { phoneNumber: e.target.value.replace(/\D/g, "") } : button.type === "url" ? { url: e.target.value } : button.type === "copy" ? { copyText: e.target.value } : {})}
                          placeholder={button.type === "call" ? "628123456789" : button.type === "url" ? "https://example.com" : button.type === "copy" ? "Kode kupon" : "Tidak perlu diisi"}
                          disabled={button.type === "reply"}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeBroadcastButton(index)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Saat gateway aktif MPWA, tombol dikirim via Send Button API. Maksimal 5 tombol.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-at">Jadwal Kirim (Opsional)</Label>
                      <Input
                        id="scheduled-at"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delay-min">Delay Min (detik)</Label>
                      <Input
                        id="delay-min"
                        type="number"
                        min="1"
                        value={delayMin}
                        onChange={(e) => setDelayMin(parseInt(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delay-max">Delay Max (detik)</Label>
                      <Input
                        id="delay-max"
                        type="number"
                        min="1"
                        value={delayMax}
                        onChange={(e) => setDelayMax(parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Fitur Anti-Block:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ Random delay antara {delayMin}-{delayMax} detik</li>
                      <li>✓ Auto retry jika gagal kirim</li>
                      <li>✓ Queue system untuk pengiriman aman</li>
                    </ul>
                  </div>

                  <Button
                    onClick={sendBroadcast}
                    disabled={loading}
                    className="w-full"
                    size="lg"
                  >
                    {scheduledAt ? (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        {loading ? "Menjadwalkan..." : "Jadwalkan Broadcast"}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {loading ? "Mengirim..." : "Kirim Broadcast"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Manage Contacts Dialog */}
          <Dialog
            open={manageContactsDialogOpen}
            onOpenChange={setManageContactsDialogOpen}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Kelola Kontak Kategori</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {contacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Tidak ada kontak tersedia
                  </p>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{contact.name || "Tanpa Nama"}</p>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      </div>
                      <Checkbox
                        checked={categoryContacts.includes(contact.id)}
                        onCheckedChange={(checked) =>
                          toggleContactInCategory(contact.id, checked as boolean)
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </ExpiredUserGuard>
    </Layout>
  );
}
