export const DetectorLogos = () => {
  const detectors = [
    { name: "Copyleaks", logo: "📄", status: "Premium API" },
    { name: "ZeroGPT", logo: "🤖", status: "Free API" },
    { name: "GPTZero", logo: "🔎", status: "Coming Soon" },
    { name: "Originality.AI", logo: "🛡️", status: "Coming Soon" },
    { name: "Writer.com", logo: "✍️", status: "Coming Soon" },
    { name: "Turnitin", logo: "🔍", status: "Coming Soon" }
  ];

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold text-foreground mb-8">
          Bypass AI Content Detectors
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center justify-items-center">
          {detectors.map((detector, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors relative"
            >
              <div className="text-4xl mb-2">{detector.logo}</div>
              <span className="text-sm font-medium text-muted-foreground text-center">
                {detector.name}
              </span>
              <span className={`text-xs mt-1 px-2 py-1 rounded-full ${
                detector.status === 'Premium API' ? 'bg-success/20 text-success' :
                detector.status === 'Free API' ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {detector.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};