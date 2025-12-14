import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Users, Save, Edit, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

interface Template {
  id: string;
  name: string;
  template_key: string;
  message_template: string;
  description: string | null;
  is_active: boolean;
}

export default function WhatsApp() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
    fetchTemplates();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone, status')
      .order('name');

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    setProfiles(data || []);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return;
    }

    setTemplates(data || []);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) {
      setSelectedPhone(profile.phone || "");
    }
  };

  const handleSendNotification = async () => {
    if (!selectedPhone || !message) {
      toast({
        title: "Error",
        description: "Pilih user dan masukkan pesan",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phone: selectedPhone,
          message: message,
          userId: selectedUserId
        }
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Notifikasi WhatsApp berhasil dikirim"
      });

      await supabase
        .from('notifications')
        .insert({
          user_id: selectedUserId,
          title: 'Pesan dari Admin',
          message: message,
          type: 'whatsapp'
        });

      setMessage("");
      setSelectedUserId("");
      setSelectedPhone("");
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengirim notifikasi WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
            Notifikasi WhatsApp
          </h1>
          <p className="text-muted-foreground mt-2">
            Kirim notifikasi dan kelola template pesan WhatsApp
          </p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Kirim Notifikasi
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Kirim Notifikasi
                  </CardTitle>
                  <CardDescription>
                    Pilih user dan kirim pesan WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user">Pilih User</Label>
                    <Select value={selectedUserId} onValueChange={handleUserSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.user_id} value={profile.user_id}>
                            {profile.name || profile.email} - {profile.phone || 'No WhatsApp belum diisi'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">No WhatsApp</Label>
                    <Input
                      id="phone"
                      value={selectedPhone}
                      onChange={(e) => setSelectedPhone(e.target.value)}
                      placeholder="628123456789"
                      disabled={!selectedUserId}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Pesan</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tulis pesan notifikasi..."
                      rows={5}
                    />
                  </div>

                  <Button
                    onClick={handleSendNotification}
                    disabled={loading || !selectedPhone || !message}
                    className="w-full"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {loading ? "Mengirim..." : "Kirim Notifikasi"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Daftar User
                  </CardTitle>
                  <CardDescription>
                    User yang terdaftar dengan No WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>No WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.filter(p => p.phone).map((profile) => (
                          <TableRow key={profile.user_id}>
                            <TableCell className="font-medium">
                              {profile.name || profile.email}
                            </TableCell>
                            <TableCell>{profile.phone}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-1 rounded ${
                                profile.status === 'active' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {profile.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {profiles.filter(p => p.phone).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              Belum ada user dengan No WhatsApp
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
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
          </TabsContent>
        </Tabs>

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