import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Eye, Plus, Trash2 } from "lucide-react";

interface LandingContent {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  items: any;
  is_active: boolean;
  sort_order: number;
}

const sectionLabels: Record<string, string> = {
  hero: "Hero Section",
  stats: "Statistik",
  features: "Fitur",
  pricing: "Harga",
  cta: "Call to Action",
};

const LandingPageManagement = () => {
  const [sections, setSections] = useState<LandingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from('landing_page_content')
      .select('*')
      .order('sort_order');
    
    if (error) {
      toast.error("Gagal memuat konten");
    } else {
      setSections(data || []);
    }
    setLoading(false);
  };

  const updateSection = (id: string, field: string, value: any) => {
    setSections(prev => prev.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ));
  };

  const updateItem = (sectionId: string, itemIndex: number, field: string, value: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId && section.items) {
        const newItems = [...section.items];
        newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
        return { ...section, items: newItems };
      }
      return section;
    }));
  };

  const addItem = (sectionId: string, sectionKey: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const newItem = sectionKey === 'stats' 
          ? { value: "0", label: "Label Baru" }
          : { icon: "MessageSquare", title: "Fitur Baru", description: "Deskripsi fitur" };
        return { ...section, items: [...(section.items || []), newItem] };
      }
      return section;
    }));
  };

  const removeItem = (sectionId: string, itemIndex: number) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId && section.items) {
        const newItems = section.items.filter((_, i) => i !== itemIndex);
        return { ...section, items: newItems };
      }
      return section;
    }));
  };

  const saveSection = async (section: LandingContent) => {
    setSaving(true);
    const { error } = await supabase
      .from('landing_page_content')
      .update({
        title: section.title,
        subtitle: section.subtitle,
        description: section.description,
        image_url: section.image_url,
        button_text: section.button_text,
        button_url: section.button_url,
        items: section.items,
        is_active: section.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', section.id);
    
    if (error) {
      toast.error("Gagal menyimpan perubahan");
    } else {
      toast.success("Perubahan berhasil disimpan");
    }
    setSaving(false);
  };

  const saveAllSections = async () => {
    setSaving(true);
    for (const section of sections) {
      await supabase
        .from('landing_page_content')
        .update({
          title: section.title,
          subtitle: section.subtitle,
          description: section.description,
          image_url: section.image_url,
          button_text: section.button_text,
          button_url: section.button_url,
          items: section.items,
          is_active: section.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', section.id);
    }
    toast.success("Semua perubahan berhasil disimpan");
    setSaving(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Kelola Landing Page</h1>
            <p className="text-muted-foreground">Edit konten halaman utama BalasinAja</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/" target="_blank" className="gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </a>
            </Button>
            <Button onClick={saveAllSections} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Menyimpan..." : "Simpan Semua"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="hero" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-2">
            {sections.map((section) => (
              <TabsTrigger key={section.section_key} value={section.section_key}>
                {sectionLabels[section.section_key] || section.section_key}
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section.section_key} value={section.section_key} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{sectionLabels[section.section_key]}</CardTitle>
                      <CardDescription>Edit konten untuk section ini</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${section.id}`}>Aktif</Label>
                      <Switch
                        id={`active-${section.id}`}
                        checked={section.is_active}
                        onCheckedChange={(checked) => updateSection(section.id, 'is_active', checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Judul</Label>
                      <Input
                        value={section.title || ''}
                        onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                        placeholder="Judul section"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtitle</Label>
                      <Input
                        value={section.subtitle || ''}
                        onChange={(e) => updateSection(section.id, 'subtitle', e.target.value)}
                        placeholder="Subtitle section"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={section.description || ''}
                      onChange={(e) => updateSection(section.id, 'description', e.target.value)}
                      placeholder="Deskripsi section"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL Gambar</Label>
                    <Input
                      value={section.image_url || ''}
                      onChange={(e) => updateSection(section.id, 'image_url', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    {section.image_url && (
                      <img 
                        src={section.image_url} 
                        alt="Preview" 
                        className="w-full max-w-md rounded-lg mt-2"
                      />
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Teks Tombol</Label>
                      <Input
                        value={section.button_text || ''}
                        onChange={(e) => updateSection(section.id, 'button_text', e.target.value)}
                        placeholder="Teks tombol"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL Tombol</Label>
                      <Input
                        value={section.button_url || ''}
                        onChange={(e) => updateSection(section.id, 'button_url', e.target.value)}
                        placeholder="/auth"
                      />
                    </div>
                  </div>

                  {/* Items (for stats and features) */}
                  {(section.section_key === 'stats' || section.section_key === 'features') && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">
                          {section.section_key === 'stats' ? 'Statistik Items' : 'Fitur Items'}
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addItem(section.id, section.section_key)}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Tambah Item
                        </Button>
                      </div>
                      
                      <div className="grid gap-4">
                        {section.items?.map((item, index) => (
                          <Card key={index} className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 grid gap-4 md:grid-cols-3">
                                {section.section_key === 'stats' ? (
                                  <>
                                    <div className="space-y-2">
                                      <Label>Nilai</Label>
                                      <Input
                                        value={item.value || ''}
                                        onChange={(e) => updateItem(section.id, index, 'value', e.target.value)}
                                        placeholder="10,000+"
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Label</Label>
                                      <Input
                                        value={item.label || ''}
                                        onChange={(e) => updateItem(section.id, index, 'label', e.target.value)}
                                        placeholder="Pesan Terkirim"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="space-y-2">
                                      <Label>Icon</Label>
                                      <Input
                                        value={item.icon || ''}
                                        onChange={(e) => updateItem(section.id, index, 'icon', e.target.value)}
                                        placeholder="MessageSquare"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Options: MessageSquare, Send, Brain, Users, BarChart3, Shield
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Judul</Label>
                                      <Input
                                        value={item.title || ''}
                                        onChange={(e) => updateItem(section.id, index, 'title', e.target.value)}
                                        placeholder="Auto Reply"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Deskripsi</Label>
                                      <Input
                                        value={item.description || ''}
                                        onChange={(e) => updateItem(section.id, index, 'description', e.target.value)}
                                        placeholder="Balas pesan otomatis"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(section.id, index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={() => saveSection(section)} disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      Simpan Section Ini
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
};

export default LandingPageManagement;