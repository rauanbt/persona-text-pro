import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-center mb-8">Privacy Policy</h1>
            <div className="bg-card text-card-foreground rounded-lg border p-8 shadow-sm space-y-6">
              <p className="text-sm text-muted-foreground">Last updated: January 29, 2025</p>
              
              <div className="prose prose-gray max-w-none">
                <p>
                  This Privacy Policy describes how SapienWrite and its affiliates ("SapienWrite", "we", "our" or "us") collect, share, and use information in the context of our applications, websites, APIs, and other services (collectively, the "Services"). This Privacy Policy (the "Privacy Policy") excludes and does not apply to information or data that our customers may process when using our Services.
                </p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Information We Collect</h2>
                
                <h3 className="text-xl font-semibold mb-3">Personal Data</h3>
                <p>While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you. Personally identifiable information may include, but is not limited to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Email address</li>
                  <li>Name</li>
                  <li>Usage Data</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3">Usage Data</h3>
                <p>Usage Data is collected automatically when using the Service. Usage Data may include information such as your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</p>

                <h3 className="text-xl font-semibold mb-3">Payment Information</h3>
                <p>Any financial account information added to your account is directed to our third party payment processor (Stripe) and is stored by them. We do have access to subscriber information through our third party payments provider and may retain data about our subscribers through our third party payments processor.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">How We Use Your Information</h2>
                <p>We use your personal data to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Provide and improve our Service</li>
                  <li>Process your transactions</li>
                  <li>Send you important updates about your account</li>
                  <li>Provide customer support</li>
                  <li>Analyze usage patterns to improve our services</li>
                </ul>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Cookies and Tracking Technologies</h2>
                <p>We use cookies and similar tracking technologies to track activity on our Service and store certain information. We use both Session and Persistent Cookies for essential functionality, user preferences, and analytics.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Data Security</h2>
                <p>The security of your personal data is important to us. We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Third-Party Services</h2>
                <p>Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Data Retention</h2>
                <p>We retain your personal information only for as long as necessary to provide you with our Service and for legitimate business purposes such as maintaining performance, making data-driven business decisions, complying with our legal obligations, and resolving disputes.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Your Rights</h2>
                <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The right to access your personal information</li>
                  <li>The right to correct inaccurate information</li>
                  <li>The right to delete your personal information</li>
                  <li>The right to restrict or object to processing</li>
                  <li>The right to data portability</li>
                </ul>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Changes to This Privacy Policy</h2>
                <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, you can contact us:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Through our contact form</li>
                  <li>At our address: 800 High School Way, #140, Mountain View, CA, 94041</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;