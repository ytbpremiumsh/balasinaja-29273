import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CSVUploadProps {
  onContactsUploaded: () => void;
}

export function CSVUpload({ onContactsUploaded }: CSVUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const validatePhone = (phone: string): string | null => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 10 || cleaned.length > 20) return null;
    if (!/^[0-9+]+$/.test(cleaned)) return null;
    return cleaned;
  };

  const sanitizeName = (name: string): string => {
    return name.replace(/[<>{}]/g, '').trim().slice(0, 100);
  };

  const parseCSV = (text: string): { contacts: Array<{ phone: string; name?: string; tags?: string[] }>; errors: string[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    const contacts: Array<{ phone: string; name?: string; tags?: string[] }> = [];
    const errors: string[] = [];

    const startIndex = lines[0].toLowerCase().includes('phone') || lines[0].toLowerCase().includes('nama') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/['"]/g, ''));
      
      if (parts[0]) {
        const validPhone = validatePhone(parts[0]);
        if (!validPhone) {
          errors.push(`Baris ${i + 1}: Nomor telepon tidak valid "${parts[0]}"`);
          continue;
        }

        const contact: { phone: string; name?: string; tags?: string[] } = {
          phone: validPhone,
        };
        
        if (parts[1]) contact.name = sanitizeName(parts[1]);
        if (parts[2]) contact.tags = parts[2].split(';').map(t => t.trim().slice(0, 50)).filter(Boolean);
        
        contacts.push(contact);
      }
    }

    return { contacts, errors };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({
        title: "Error",
        description: "Hanya file CSV yang didukung",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const { contacts, errors } = parseCSV(text);

      if (errors.length > 0) {
        toast({
          title: `${errors.length} baris tidak valid`,
          description: errors.slice(0, 3).join('; '),
          variant: "destructive",
        });
      }

      if (contacts.length === 0) {
        throw new Error("Tidak ada kontak yang valid dalam file");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Remove duplicates based on phone
      const uniquePhones = new Set<string>();
      const uniqueContacts = contacts.filter(contact => {
        if (uniquePhones.has(contact.phone)) {
          return false;
        }
        uniquePhones.add(contact.phone);
        return true;
      });

      // Insert contacts with opt_in true by default
      const { data, error } = await supabase.from("contacts").insert(
        uniqueContacts.map(contact => ({
          user_id: user.id,
          phone: contact.phone,
          name: contact.name || null,
          tags: contact.tags || [],
          opt_in: true,
        }))
      ).select();

      if (error) throw error;

      toast({
        title: "Sukses!",
        description: `${data.length} kontak berhasil diupload (${contacts.length - data.length} duplikat dihapus)`,
      });

      onContactsUploaded();
      e.target.value = ''; // Reset input
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Upload Kontak CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-upload">Upload File CSV</Label>
          <Input
            id="csv-upload"
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">
            Format: phone, name, tags (opsional)<br />
            Contoh: 628123456789, John Doe, vip;pelanggan
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <p className="font-medium mb-2">Format CSV:</p>
          <code className="block bg-background p-2 rounded text-xs">
            628123456789,John Doe,vip;pelanggan<br />
            628987654321,Jane Smith,member
          </code>
        </div>
      </CardContent>
    </Card>
  );
}