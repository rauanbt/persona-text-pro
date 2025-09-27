export const DetectorLogos = () => {
  const detectors = [
    { name: "Copyleaks", logo: "📄" },
    { name: "ZeroGPT", logo: "🤖" },
    { name: "GPTZero", logo: "🔎" },
    { name: "Originality.AI", logo: "🛡️" }
  ];

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold text-foreground mb-8">
          Bypass AI Content Detectors
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-items-center max-w-2xl mx-auto">
          {detectors.map((detector, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="text-4xl mb-2">{detector.logo}</div>
              <span className="text-sm font-medium text-muted-foreground text-center">
                {detector.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};