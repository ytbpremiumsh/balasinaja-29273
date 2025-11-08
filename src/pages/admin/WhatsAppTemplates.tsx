import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Save, Plus, Edit, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Template {
  id: string;
  name: string;
  template_key: string;
  message_template: string;
  description: string | null;
  is_active: boolean;
}

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Gagal memuat template",
        variant: "destructive"
      });
      return;
    }

    setTemplates(data || []);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({
          name: editingTemplate.name,
          message_template: editingTemplate.message_template,
          description: editingTemplate.description,
          is_active: editingTemplate.is_active
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Template berhasil diupdate"
      });

      setShowDialog(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (template: Template) => {
    const { error } = await supabase
      .from('whatsapp_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id);

    if (error) {
      toast({
        title: "Error",
        description: "Gagal mengubah status template",
        variant: "destructive"
      });
      return;
    }

    fetchTemplates();
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate({ ...template });
    setShowDialog(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" />
            Template WhatsApp
          </h1>
          <p className="text-muted-foreground mt-2">
            Kelola template pesan WhatsApp otomatis untuk notifikasi sistem
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Template</CardTitle>
            <CardDescription>
              Template menggunakan placeholder: {"{NAME}"}, {"{PACKAGE_NAME}"}, {"{EXPIRE_DATE}"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Template</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {template.template_key}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {template.description}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Gunakan placeholder {"{NAME}"}, {"{PACKAGE_NAME}"}, {"{EXPIRE_DATE}"} untuk data dinamis
              </DialogDescription>
            </DialogHeader>

            {editingTemplate && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Template</Label>
                  <Input
                    id="name"
                    value={editingTemplate.name}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Input
                    id="description"
                    value={editingTemplate.description || ""}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Pesan Template</Label>
                  <Textarea
                    id="message"
                    rows={10}
                    value={editingTemplate.message_template}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        message_template: e.target.value,
                      })
                    }
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={editingTemplate.is_active}
                    onCheckedChange={(checked) =>
                      setEditingTemplate({ ...editingTemplate, is_active: checked })
                    }
                  />
                  <Label htmlFor="active">Template Aktif</Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Batal
              </Button>
              <Button onClick={handleSaveTemplate} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Simpan Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
