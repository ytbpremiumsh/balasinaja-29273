import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Inbox, Bot, Users, TrendingUp, BarChart3, Calendar } from "lucide-react";
import { Layout } from "@/components/Layout";
import { User } from "@supabase/supabase-js";
import { SubscriptionInfo } from "@/components/SubscriptionInfo";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/BalasinAja.png";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [aiReplyEnabled, setAiReplyEnabled] = useState(true);
  const [webhookToken, setWebhookToken] = useState("");
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalMessages: 0,
    triggeredReplies: 0,
    aiReplies: 0,
    totalContacts: 0,
    totalTriggers: 0,
    totalKnowledge: 0,
    responseRate: 0,
  });
  const [dailyStats, setDailyStats] = useState<Array<{
    date: string;
    total: number;
    trigger: number;
    ai: number;
  }>>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAiReplyStatus();
        loadWebhookToken(session.user.id);
      }
    });
  }, []);

  const loadWebhookToken = async (userId: string) => {
    try {
      const { data: token } = await (supabase as any).rpc("get_my_webhook_token");
      
      if (token) {
        setWebhookToken(token);
      }
    } catch (error) {
      console.error("Error loading webhook token:", error);
    }
  };

  const loadAiReplyStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "ai_reply_enabled")
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAiReplyEnabled(data?.value === 'true');
    } catch (error) {
      console.error("Error loading AI reply status:", error);
    }
  };

  const toggleAiReply = async (enabled: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("settings")
        .upsert({
          user_id: session.user.id,
          key: "ai_reply_enabled",
          value: enabled ? 'true' : 'false',
        }, {
          onConflict: 'user_id,key'
        });

      if (error) throw error;

      setAiReplyEnabled(enabled);
      toast({
        title: "Berhasil",
        description: `AI reply ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`,
      });
    } catch (error) {
      console.error("Error toggling AI reply:", error);
      toast({
        title: "Error",
        description: "Gagal mengubah status AI reply",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDailyStats();

    // Auto-refresh every 5 seconds
    const refreshInterval = setInterval(() => {
      fetchStats();
    }, 5000);

    // Setup realtime subscriptions for all tables
    const inboxChannel = supabase
      .channel('dashboard-inbox-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox' }, () => fetchStats())
      .subscribe();

    const contactsChannel = supabase
      .channel('dashboard-contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchStats())
      .subscribe();

    const triggersChannel = supabase
      .channel('dashboard-triggers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'autoreplies' }, () => fetchStats())
      .subscribe();

    const knowledgeChannel = supabase
      .channel('dashboard-knowledge-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_knowledge_base' }, () => fetchStats())
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(inboxChannel);
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(triggersChannel);
      supabase.removeChannel(knowledgeChannel);
    };
  }, []);

  const fetchStats = async () => {
    const [inbox, contacts, triggers, knowledge] = await Promise.all([
      supabase.from("inbox").select("status", { count: "exact" }),
      supabase.from("contacts").select("*", { count: "exact" }),
      supabase.from("autoreplies").select("*", { count: "exact" }),
      supabase.from("ai_knowledge_base").select("*", { count: "exact" }),
    ]);

    const triggeredReplies =
      inbox.data?.filter((m) => m.status === "replied_trigger").length || 0;
    const aiReplies =
      inbox.data?.filter((m) => m.status === "replied_ai").length || 0;
    
    const totalReplies = triggeredReplies + aiReplies;
    const responseRate = inbox.count ? Math.round((totalReplies / inbox.count) * 100) : 0;

    setStats({
      totalMessages: inbox.count || 0,
      triggeredReplies,
      aiReplies,
      totalContacts: contacts.count || 0,
      totalTriggers: triggers.count || 0,
      totalKnowledge: knowledge.count || 0,
      responseRate,
    });
  };

  const fetchDailyStats = async () => {
    try {
      const days = 7;
      const dailyData: Array<{ date: string; total: number; trigger: number; ai: number }> = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { data: messages } = await supabase
          .from("inbox")
          .select("status")
          .gte("created_at", start)
          .lte("created_at", end);

        const total = messages?.length || 0;
        const trigger = messages?.filter(m => m.status === "replied_trigger").length || 0;
        const ai = messages?.filter(m => m.status === "replied_ai").length || 0;

        dailyData.push({
          date: format(date, "dd MMM", { locale: localeId }),
          total,
          trigger,
          ai
        });
      }

      setDailyStats(dailyData);
    } catch (error) {
      console.error("Error fetching daily stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Pesan",
      value: stats.totalMessages,
      icon: Inbox,
      description: "Pesan masuk diterima",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Trigger Replies",
      value: stats.triggeredReplies,
      icon: MessageSquare,
      description: "Balasan via trigger",
      gradient: "from-green-500 to-green-600",
    },
    {
      title: "AI Replies",
      value: stats.aiReplies,
      icon: Bot,
      description: "Balasan via AI",
      gradient: "from-purple-500 to-purple-600",
    },
    {
      title: "Total Kontak",
      value: stats.totalContacts,
      icon: Users,
      description: "Kontak tersimpan",
      gradient: "from-orange-500 to-orange-600",
    },
    {
      title: "Triggers",
      value: stats.totalTriggers,
      icon: TrendingUp,
      description: "Trigger aktif",
      gradient: "from-indigo-500 to-indigo-600",
    },
    {
      title: "Knowledge Base",
      value: stats.totalKnowledge,
      icon: Bot,
      description: "Data AI tersimpan",
      gradient: "from-pink-500 to-pink-600",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Selamat datang di BalasinAja - Sistem autoreply WhatsApp AI
            </p>
          </div>
        </div>

        {/* Subscription Info Card */}
        <SubscriptionInfo />

        {/* AI Reply Toggle Card */}
        <Card className="shadow-card border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl p-3 bg-gradient-to-br from-purple-500 to-purple-600">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <Label htmlFor="ai-reply-toggle" className="text-base font-semibold cursor-pointer">
                    AI Reply Status
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {aiReplyEnabled ? 'AI aktif membalas pesan' : 'AI dinonaktifkan'}
                  </p>
                </div>
              </div>
              <Switch
                id="ai-reply-toggle"
                checked={aiReplyEnabled}
                onCheckedChange={toggleAiReply}
              />
            </div>
          </CardContent>
        </Card>

        {/* Response Rate Card - Full Width */}
        <Card className="gradient-card shadow-card border-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl p-4 bg-gradient-to-br from-cyan-500 to-blue-600">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                  <p className="text-5xl font-bold mt-1">{stats.responseRate}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tingkat balasan pesan</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.triggeredReplies + stats.aiReplies} dari {stats.totalMessages} pesan dibalas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="gradient-card shadow-card hover:shadow-hover transition-all duration-300 border-0"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Daily Statistics Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Statistik Pesan 7 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Chart Area */}
              <div className="relative h-64 border-l-2 border-b-2 border-muted-foreground/20 pl-4 pb-4">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
                  {[...Array(6)].map((_, i) => {
                    const maxValue = Math.max(...dailyStats.map(d => d.total), 1);
                    const value = Math.round((maxValue * (5 - i)) / 5);
                    return (
                      <div key={i} className="text-right pr-2">
                        {value}
                      </div>
                    );
                  })}
                </div>

                {/* Chart canvas */}
                <div className="ml-8 h-full relative">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[...Array(6)].map((_, i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 20}
                        x2="100"
                        y2={i * 20}
                        stroke="currentColor"
                        className="text-muted-foreground/10"
                        strokeWidth="0.2"
                      />
                    ))}

                    {/* Lines */}
                    {dailyStats.length > 1 && (() => {
                      const maxValue = Math.max(...dailyStats.map(d => d.total), 1);
                      const points = dailyStats.map((day, i) => ({
                        x: (i / (dailyStats.length - 1)) * 100,
                        yTotal: 100 - (day.total / maxValue) * 100,
                        yTrigger: 100 - (day.trigger / maxValue) * 100,
                        yAi: 100 - (day.ai / maxValue) * 100,
                      }));

                      return (
                        <>
                          {/* Total line */}
                          <polyline
                            points={points.map(p => `${p.x},${p.yTotal}`).join(' ')}
                            fill="none"
                            stroke="rgb(59, 130, 246)"
                            strokeWidth="0.5"
                            className="transition-all duration-300"
                          />
                          {/* Trigger line */}
                          <polyline
                            points={points.map(p => `${p.x},${p.yTrigger}`).join(' ')}
                            fill="none"
                            stroke="rgb(34, 197, 94)"
                            strokeWidth="0.5"
                            className="transition-all duration-300"
                          />
                          {/* AI line */}
                          <polyline
                            points={points.map(p => `${p.x},${p.yAi}`).join(' ')}
                            fill="none"
                            stroke="rgb(168, 85, 247)"
                            strokeWidth="0.5"
                            className="transition-all duration-300"
                          />
                        </>
                      );
                    })()}
                  </svg>

                  {/* Dots overlay */}
                  <div className="absolute inset-0">
                    {dailyStats.map((day, i) => {
                      const maxValue = Math.max(...dailyStats.map(d => d.total), 1);
                      const xPos = (i / (dailyStats.length - 1)) * 100;
                      const yTotal = 100 - (day.total / maxValue) * 100;
                      const yTrigger = 100 - (day.trigger / maxValue) * 100;
                      const yAi = 100 - (day.ai / maxValue) * 100;

                      return (
                        <div key={i} className="absolute" style={{ left: `${xPos}%`, top: 0, bottom: 0 }}>
                          {/* Total dot */}
                          {day.total > 0 && (
                            <div
                              className="absolute w-3 h-3 -ml-1.5 bg-blue-500 rounded-full border-2 border-background shadow-lg hover:scale-125 transition-transform cursor-pointer"
                              style={{ top: `${yTotal}%`, marginTop: '-6px' }}
                              title={`Total: ${day.total}`}
                            />
                          )}
                          {/* Trigger dot */}
                          {day.trigger > 0 && (
                            <div
                              className="absolute w-3 h-3 -ml-1.5 bg-green-500 rounded-full border-2 border-background shadow-lg hover:scale-125 transition-transform cursor-pointer"
                              style={{ top: `${yTrigger}%`, marginTop: '-6px' }}
                              title={`Trigger: ${day.trigger}`}
                            />
                          )}
                          {/* AI dot */}
                          {day.ai > 0 && (
                            <div
                              className="absolute w-3 h-3 -ml-1.5 bg-purple-500 rounded-full border-2 border-background shadow-lg hover:scale-125 transition-transform cursor-pointer"
                              style={{ top: `${yAi}%`, marginTop: '-6px' }}
                              title={`AI: ${day.ai}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="ml-8 mt-2 flex justify-between text-xs text-muted-foreground">
                  {dailyStats.map((day, i) => (
                    <div key={i} className="text-center" style={{ width: `${100 / dailyStats.length}%` }}>
                      {day.date}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-6 justify-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-background shadow"></div>
                  <span>Total Pesan</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-background shadow"></div>
                  <span>Trigger Reply</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-background shadow"></div>
                  <span>AI Reply</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Webhook Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">OneSender Webhook:</p>
              <code className="text-xs bg-background rounded px-3 py-2 block overflow-x-auto break-all">
                {webhookToken 
                  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/balasinaja?token=${webhookToken}`
                  : "Loading..."}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Gunakan URL ini di dashboard WA Gateway Anda. Sistem akan otomatis memproses pesan dengan token autentikasi yang aman.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
