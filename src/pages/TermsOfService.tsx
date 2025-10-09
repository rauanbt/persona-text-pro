import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-center mb-8">Terms of Service</h1>
            <div className="bg-card text-card-foreground rounded-lg border p-8 shadow-sm space-y-6">
              <p className="text-sm text-muted-foreground">Last updated: January 29, 2025</p>
              
              <div className="prose prose-gray max-w-none">
                <p>
                  Welcome to SapienWrite! We operate the website sapienwrite.com, as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services"). Our website provides AI-powered text humanization services. By using our Website, you agree to these Terms of Service. If you disagree with any part, please refrain from using the Website.
                </p>
                
                <p>
                  The Services are intended for users who are at least 13 years of age. All users who are minors in the jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have your parent or guardian read and agree to these Legal Terms prior to using the Services.
                </p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">1. Use License</h2>
                <p>You are granted a limited license to use SapienWrite for personal and commercial purposes. This license does not include rights to modify or distribute the Website's content without our prior written consent.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">2. Ownership and Generated Content</h2>
                <p>Text humanized using SapienWrite belongs to the user who created them. SapienWrite claims no ownership over user-generated content. However, by using our service, you grant us a limited license to process your content for the purpose of providing our AI humanization services.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">3. User Data Collection</h2>
                <p>We collect personal and non-personal data to improve our services. Data use is governed by our Privacy Policy, available at our Privacy Policy page.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">4. Acceptable Use</h2>
                <p>You agree not to use SapienWrite to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Generate harmful, illegal, or inappropriate content</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on intellectual property rights of others</li>
                  <li>Attempt to circumvent any usage limitations or security measures</li>
                  <li>Use the service for any fraudulent or deceptive purposes</li>
                </ul>

                <h2 className="text-2xl font-semibold mb-4 mt-8">5. Subscription and Payment Terms</h2>
                <p>Our paid subscription plans provide access to premium features and increased usage limits. Subscription details:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Subscriptions are billed monthly or annually as selected</li>
                  <li>Usage limits reset at the beginning of each billing cycle</li>
                  <li>We reserve the right to modify pricing with 30 days notice</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.1 No Refunds Policy</h3>
                <p className="mb-3">
                  <strong>All subscription purchases are final and non-refundable.</strong> Due to the nature of our AI-powered humanization service, 
                  we incur immediate computational and server costs when processing your content. These costs cannot be recovered, which is why we 
                  cannot offer refunds once a subscription is activated.
                </p>
                <p className="mb-3">
                  <strong>Free Trial:</strong> Before purchasing, we strongly encourage you to test our platform using the complimentary 750-word trial. 
                  This allows you to fully experience our service quality and ensure it meets your needs before making a financial commitment.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Cancellation Policy</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>You may cancel your subscription at any time via the Stripe Customer Portal</li>
                  <li>No cancellation fees apply</li>
                  <li>Upon cancellation, you retain full access until your current billing period ends</li>
                  <li>Monthly plans: Access continues until month-end</li>
                  <li>Annual plans: Access continues for the full 12-month period</li>
                  <li>Unused word credits expire at period end and do not carry over</li>
                  <li>You may reactivate your subscription at any time</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.3 Subscription Abuse Prevention</h3>
                <p className="mb-2">We reserve the right to suspend or terminate accounts that demonstrate patterns of abuse, including but not limited to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Creating multiple accounts to exploit free trial offerings</li>
                  <li>Excessive refund requests or chargebacks</li>
                  <li>Violating our acceptable use policy</li>
                </ul>

                <h2 className="text-2xl font-semibold mb-4 mt-8">6. Service Availability</h2>
                <p>While we strive to maintain high availability, we do not guarantee that our service will be uninterrupted or error-free. We reserve the right to modify, suspend, or discontinue any part of our service with reasonable notice.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">7. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law, SapienWrite shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">8. Governing Law</h2>
                <p>These Terms shall be governed by the laws of the State of California, United States of America, without regard to conflict of law provisions.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">9. Changes to Terms</h2>
                <p>SapienWrite reserves the right to modify these Terms at any time. Users will be notified of changes by email or through the service. Continued use of the Website constitutes acceptance of modified Terms.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">10. Account Termination</h2>
                <p>We reserve the right to terminate or suspend accounts that violate these terms or engage in harmful activities. Users may terminate their accounts at any time through their account settings.</p>

                <h2 className="text-2xl font-semibold mb-4 mt-8">11. Contact Information</h2>
                <p>For questions about these Terms, please contact us:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Through our contact form</li>
                  <li>At our address: 800 High School Way, #140, Mountain View, CA, 94041</li>
                </ul>
                
                <p className="mt-8">By using SapienWrite, you signify your acceptance of these Terms of Service.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;