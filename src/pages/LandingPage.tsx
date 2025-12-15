import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Send, Brain, Users, BarChart3, Shield, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface LandingContent {
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  items: any[] | null;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price: number | null;
}

const iconMap: Record<string, any> = {
  MessageSquare,
  Send,
  Brain,
  Users,
  BarChart3,
  Shield,
};

const LandingPage = () => {
  const [content, setContent] = useState<Record<string, LandingContent>>({});
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetchContent();
    fetchPackages();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
  };

  const fetchContent = async () => {
    const { data } = await supabase
      .from('landing_page_content')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (data) {
      const contentMap: Record<string, LandingContent> = {};
      data.forEach((item: any) => {
        contentMap[item.section_key] = item;
      });
      setContent(contentMap);
    }
  };

  const fetchPackages = async () => {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('price');
    
    if (data) {
      setPackages(data);
    }
  };

  const hero = content['hero'];
  const stats = content['stats'];
  const features = content['features'];
  const pricing = content['pricing'];
  const cta = content['cta'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-primary">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              BalasinAja
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Button asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Masuk</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Daftar Gratis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {hero && (
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6">
              <MessageSquare className="w-4 h-4" />
              {hero.subtitle}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {hero.title}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {hero.description}
            </p>
            {hero.image_url && (
              <img 
                src={hero.image_url} 
                alt="Hero" 
                className="w-full max-w-3xl mx-auto rounded-xl shadow-2xl mb-8"
              />
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="gap-2">
                <Link to={hero.button_url || '/auth'}>
                  {hero.button_text}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Lihat Fitur</a>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      {stats && stats.items && (
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {(stats.items as any[]).map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {features && (
        <section id="features" className="py-20 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{features.title}</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {features.description}
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.items && (features.items as any[]).map((feature, index) => {
                const IconComponent = iconMap[feature.icon] || MessageSquare;
                return (
                  <Card key={index} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      {pricing && (
        <section id="pricing" className="py-20 px-4 bg-muted/50">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{pricing.title}</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {pricing.description}
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {packages.map((pkg, index) => (
                <Card key={pkg.id} className={`relative ${index === 1 ? 'border-primary shadow-lg scale-105' : ''}`}>
                  {index === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Populer
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        Rp {(pkg.price || 0).toLocaleString('id-ID')}
                      </span>
                      <span className="text-muted-foreground">/{pkg.duration_days} hari</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {pkg.description && (
                      <p className="text-muted-foreground text-center mb-6">{pkg.description}</p>
                    )}
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <span>Auto Reply AI</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <span>Broadcast Unlimited</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <span>Knowledge Base</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <span>Manajemen Kontak</span>
                      </li>
                    </ul>
                    <Button className="w-full" variant={index === 1 ? 'default' : 'outline'} asChild>
                      <Link to="/auth">Pilih Paket</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {cta && (
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <Card className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
              <CardContent className="py-16 text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">{cta.title}</h2>
                <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                  {cta.description}
                </p>
                <Button size="lg" variant="secondary" asChild className="gap-2">
                  <Link to={cta.button_url || '/auth'}>
                    {cta.button_text}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary">
                <MessageSquare className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">BalasinAja</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Fitur</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Harga</a>
              <Link to="/auth" className="hover:text-foreground transition-colors">Masuk</Link>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BalasinAja. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;