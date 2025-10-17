import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection"; 
import { CaveEvolutionStory } from "@/components/CaveEvolutionStory";
import { UseCasesDemo } from "@/components/UseCasesDemo";
import { ChromeExtensionDemo } from "@/components/ChromeExtensionDemo";
import { WritingJourneyPricing } from "@/components/WritingJourneyPricing";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <CaveEvolutionStory />
        <UseCasesDemo />
        <ChromeExtensionDemo />
        <WritingJourneyPricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
