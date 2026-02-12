import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ExtensionFeatures } from "@/components/ExtensionFeatures";
import { WritingJourneyPricing } from "@/components/WritingJourneyPricing";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <ExtensionFeatures />
        <WritingJourneyPricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
