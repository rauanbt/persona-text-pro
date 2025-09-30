import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection"; 
import { CaveEvolutionStory } from "@/components/CaveEvolutionStory";
import { UseCasesDemo } from "@/components/UseCasesDemo";
import { SapienWriteDifference } from "@/components/SapienWriteDifference";
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
        <SapienWriteDifference />
        <WritingJourneyPricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
