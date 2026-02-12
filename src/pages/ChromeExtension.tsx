import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Chrome, Zap, Shield, Clock } from "lucide-react";

const ChromeExtension = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-16 max-w-4xl mx-auto">
            <Chrome className="w-20 h-20 text-primary mx-auto mb-6" />
            <h1 className="text-5xl font-bold text-foreground mb-6">
              Humanize Text Anywhere on the Web
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Right-click any text to instantly humanize it with SapienWrite's Chrome Extension. 
              Works on Google Docs, Gmail, Medium, and every website you use.
            </p>
            <Button size="lg" className="text-lg px-8">
              <Chrome className="w-5 h-5 mr-2" />
              Download Extension
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              1,000 words free. No credit card required.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: <Zap className="w-8 h-8 text-primary" />, title: "Instant Humanization", desc: "Right-click selected text for instant results" },
              { icon: <Shield className="w-8 h-8 text-primary" />, title: "Secure & Private", desc: "Encrypted connection to SapienWrite servers" },
              { icon: <Clock className="w-8 h-8 text-primary" />, title: "Real-Time Sync", desc: "Word balance syncs with your web dashboard" },
              { icon: <Check className="w-8 h-8 text-primary" />, title: "Works Everywhere", desc: "Compatible with all websites and text fields" }
            ].map((feature, i) => (
              <Card key={i}>
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center mb-4">{feature.icon}</div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pricing Comparison */}
          <div className="bg-feature-bg rounded-2xl p-8 mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="border-2 border-green-200">
                <CardContent className="p-6">
                  <Chrome className="w-10 h-10 text-green-500 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Free</h3>
                  <div className="text-3xl font-bold text-primary mb-4">Free</div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />1,000 words/month</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />All 6 tone personalities</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />Basic AI humanization</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-green-500 mr-2" />Works on Gmail, LinkedIn, Docs & more</li>
                  </ul>
                  <Button className="w-full" variant="outline" onClick={() => window.location.href = '/auth'}>Start Free</Button>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-purple-200 bg-purple-50/50">
                <CardContent className="p-6">
                  <div className="text-xs font-bold text-purple-600 mb-2">MOST POPULAR</div>
                  <h3 className="text-2xl font-bold mb-2">Ultra</h3>
                  <div className="text-3xl font-bold text-primary mb-4">$39.95<span className="text-lg text-muted-foreground">/month</span></div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center"><Check className="w-4 h-4 text-purple-500 mr-2" />20,000 words/month</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-purple-500 mr-2" />Premium dual-engine (Gemini + GPT)</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-purple-500 mr-2" />Priority processing</li>
                    <li className="flex items-center"><Check className="w-4 h-4 text-purple-500 mr-2" />Works on Gmail, LinkedIn, Docs & more</li>
                  </ul>
                  <Button className="w-full" onClick={() => window.location.href = '/auth'}>Upgrade to Ultra</Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">How to Install</h2>
            <div className="space-y-4">
              {[
                "Download the extension from Chrome Web Store",
                "Click 'Add to Chrome' to install",
                "Log in with your SapienWrite account",
                "Start humanizing text with a right-click!"
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-card rounded-lg border">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <p className="text-lg pt-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChromeExtension;
