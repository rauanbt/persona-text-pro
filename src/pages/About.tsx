import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-center mb-8">About SapienWrite</h1>
            <div className="bg-card text-card-foreground rounded-lg border p-8 shadow-sm">
              <p className="text-lg text-muted-foreground text-center">
                Coming Soon...
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;