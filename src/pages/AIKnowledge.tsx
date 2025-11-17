import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { ExpiredUserGuard } from "@/components/ExpiredUserGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Plus, Trash2, Edit2, X, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Knowledge {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function AIKnowledge() {
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    const { data, error } = await supabase
      .from("ai_knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching knowledge:", error);
    } else {
      setKnowledge(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Update existing knowledge
      const { error } = await supabase
        .from("ai_knowledge_base")
        .update({
          question: question.trim(),
          answer: answer.trim(),
        })
        .eq("id", editingId);

      if (error) {
        toast.error("Gagal mengupdate knowledge: " + error.message);
      } else {
        toast.success("Knowledge berhasil diupdate!");
        resetForm();
        fetchKnowledge();
      }
    } else {
      // Insert new knowledge
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase.from("ai_knowledge_base").insert({
        question: question.trim(),
        answer: answer.trim(),
        user_id: user.id,
      });

      if (error) {
        toast.error("Gagal menambah knowledge: " + error.message);
      } else {
        toast.success("Knowledge berhasil ditambahkan!");
        resetForm();
        fetchKnowledge();
      }
    }
  };

  const handleEdit = (kb: Knowledge) => {
    setEditingId(kb.id);
    setQuestion(kb.question);
    setAnswer(kb.answer);
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus knowledge ini?")) return;

    const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus knowledge");
    } else {
      toast.success("Knowledge berhasil dihapus");
      fetchKnowledge();
    }
  };

  const handleExport = () => {
    const exportData = knowledge.map(({ question, answer }) => ({
      question,
      answer
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-knowledge-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Data berhasil diexport!");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!Array.isArray(importData)) {
        toast.error("Format file tidak valid. Harus berupa array.");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const item of importData) {
        if (!item.question || !item.answer) {
          errorCount++;
          continue;
        }

        const { error } = await supabase.from("ai_knowledge_base").insert({
          question: item.question.trim(),
          answer: item.answer.trim(),
          user_id: user.id,
        });

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} data berhasil diimport!`);
        fetchKnowledge();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} data gagal diimport`);
      }
    } catch (error) {
      toast.error("Gagal membaca file. Pastikan format JSON valid.");
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <Layout>
      <ExpiredUserGuard>
        <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            AI Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-2">
            Data ini digunakan AI sebagai konteks untuk memberikan jawaban yang lebih akurat
          </p>
        </div>

        {/* Export/Import Section */}
        <Card>
          <CardHeader>
            <CardTitle>Export / Import Data</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export JSON
            </Button>
            <div>
              <Input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <Button 
                onClick={() => document.getElementById('import-file')?.click()}
                variant="outline" 
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        <Card className="shadow-card gradient-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingId ? "Edit Knowledge" : "Tambah Knowledge Baru"}
              </div>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="question">Pertanyaan</Label>
                <Textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Contoh pertanyaan yang sering ditanyakan pengguna"
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label htmlFor="answer">Jawaban</Label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Jawaban yang diharapkan dari AI"
                  rows={3}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingId ? (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Update Knowledge
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Simpan Knowledge
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Daftar Knowledge Base ({knowledge.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {knowledge.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada data knowledge base. Tambahkan data pertama Anda di atas!
                </div>
              ) : (
                knowledge.map((kb) => (
                  <div
                    key={kb.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-primary">Q:</span>
                          </div>
                          <p className="text-sm font-medium">{kb.question}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-success">A:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{kb.answer}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(kb)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(kb.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </ExpiredUserGuard>
    </Layout>
  );
}
