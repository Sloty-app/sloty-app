import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { C } from "../constants";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 10 }}>{title}</h2>
    <div style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.8 }}>{children}</div>
  </div>
);

const P = ({ children }) => <p style={{ marginBottom: 10 }}>{children}</p>;
const Li = ({ children }) => <li style={{ marginBottom: 6, marginLeft: 16 }}>{children}</li>;

export default function TermsOfService({ onBack } = {}) {
  const navigate = useNavigate();
  // If rendered as an in-app overlay (e.g. from Settings), the caller
  // provides its own close function so this stays within the same
  // overlay-based navigation system as the rest of the app, instead of
  // triggering a full route change. Falls back to real browser
  // navigation for the standalone route (e.g. reached via Splash while
  // logged out, or a direct URL).
  const handleBack = onBack || (() => navigate(-1));
  const lastUpdated = "22 July 2026";

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F8", fontFamily: "'Nunito',sans-serif" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(100deg,${C.pri},#DB2777)`, padding: "52px 20px 28px" }}>
        <button onClick={handleBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 16 }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Last updated: {lastUpdated}</p>
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

          <P>Welcome to Sloty. By downloading, accessing, or using our application, you agree to be bound by these Terms of Service. Please read them carefully before using the platform.</P>

          <Section title="1. About Sloty">
            <P>Sloty is a slot-booking platform that connects customers with local service businesses (salons, clinics, mechanics, etc.) in India. We provide the technology platform; the actual services are provided by independent store owners ("Service Providers").</P>
          </Section>

          <Section title="2. Eligibility">
            <P>You must be at least 13 years of age to use Sloty. By using the platform, you confirm that:</P>
            <ul>
              <Li>You are at least 13 years old</Li>
              <Li>You are using a valid Indian mobile number</Li>
              <Li>The information you provide is accurate and complete</Li>
            </ul>
          </Section>

          <Section title="3. Bookings & Appointments">
            <ul>
              <Li>When you book a slot through Sloty, you receive a confirmed appointment at the selected store for the selected time.</Li>
              <Li>Your booking is verified in-person using a 4-digit OTP shown in the app. Share this OTP with the store staff to begin your service.</Li>
              <Li>Sloty is not responsible if a store is closed, unavailable, or provides inadequate service. Such disputes must be resolved directly with the store.</Li>
              <Li>Stores reserve the right to refuse service for valid reasons including safety concerns or prior no-shows.</Li>
            </ul>
          </Section>

          <Section title="4. Cancellations, Rescheduling & No-Shows">
            <ul>
              <Li>You may cancel a booking through the app before your appointment time.</Li>
              <Li>You may also reschedule a confirmed booking to a different date or time at the same store, instead of cancelling and booking again.</Li>
              <Li>If you cancel a booking paid for online, the amount paid is credited to your Sloty Wallet — Sloty does not currently issue refunds back to your original payment method.</Li>
              <Li>Repeated no-shows (booking and not showing up) may result in temporary restrictions on your account.</Li>
              <Li>If a store cancels your appointment, you will be notified via the app and any wallet credits used will be refunded.</Li>
            </ul>
          </Section>

          <Section title="5. Sloty Wallet & Referral Credits">
            <ul>
              <Li>Sloty Wallet credits may be earned through the referral program, promotional offers, or issued as refunds for cancelled bookings paid for online.</Li>
              <Li>The referral program is currently paused and may be re-enabled at Sloty's discretion; no referral credits are issued while it is inactive. Your ability to share a referral code and refer others is not affected — only the wallet credit normally earned for doing so.</Li>
              <Li>Credits have no cash value and cannot be transferred, withdrawn, or exchanged for cash.</Li>
              <Li>Credits expire 12 months from the date of issue.</Li>
              <Li>Sloty reserves the right to revoke credits if fraud or abuse of the referral system is detected.</Li>
              <Li>When active, referral credits (₹50 per successful referral) are awarded only when a genuinely new user signs up and completes their first valid booking.</Li>
            </ul>
          </Section>

          <Section title="6. Payments & Pricing">
            <ul>
              <Li>Sloty supports paying the store directly at the time of service (cash or UPI, as accepted by that store), and — for stores where this option is enabled — paying online in advance through the app via UPI.</Li>
              <Li>Online payments are processed through a third-party payment gateway. Sloty temporarily holds these funds on behalf of the store owner until they are settled, and does not itself act as a bank or store your card/UPI details.</Li>
              <Li>Some services may be listed with variable pricing ("On Inspection") where the final cost depends on factors that can only be determined in person, such as vehicle type or parts required. These services can only be booked with payment made directly at the store, and the price shown at booking (if any) is an estimate, not a fixed quote.</Li>
              <Li>Sloty is not a party to the payment for services rendered and is not responsible for pricing disputes between you and a store, beyond facilitating any applicable online refund to your Sloty Wallet as described in Section 4.</Li>
            </ul>
          </Section>

          <Section title="7. User Conduct">
            <P>You agree not to:</P>
            <ul>
              <Li>Provide false information when registering or booking</Li>
              <Li>Abuse, harass, or threaten store owners or Sloty staff</Li>
              <Li>Attempt to manipulate the referral system or wallet credits</Li>
              <Li>Use the platform for any unlawful purpose</Li>
              <Li>Attempt to reverse-engineer or disrupt the platform</Li>
            </ul>
          </Section>

          <Section title="8. Store Owners">
            <P>Service Providers who register on Sloty agree to:</P>
            <ul>
              <Li>Provide accurate information about their services, pricing, and availability</Li>
              <Li>Honor confirmed bookings made through the platform</Li>
              <Li>Maintain professional conduct with customers</Li>
              <Li>Not charge prices higher than those listed on Sloty, except for services explicitly marked as variable/inspection-based pricing, where the final price is agreed directly with the customer in person</Li>
            </ul>
          </Section>

          <Section title="9. Intellectual Property">
            <P>All content on Sloty including the app design, logo, and software is owned by Sloty Technologies and protected under Indian copyright law. You may not copy, reproduce, or distribute any part of the platform without written permission.</P>
          </Section>

          <Section title="10. Limitation of Liability">
            <P>Sloty provides a booking platform and is not liable for the quality of services provided by store owners, personal injury, property damage, or any indirect losses arising from use of the platform. Our total liability to you shall not exceed the value of credits in your Sloty Wallet at the time of the claim.</P>
          </Section>

          <Section title="11. Governing Law">
            <P>These Terms are governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana, India.</P>
          </Section>

          <Section title="12. Changes to Terms">
            <P>We may update these Terms from time to time. Continued use of Sloty after changes are posted constitutes your acceptance of the new Terms. We will notify you of material changes via the app.</P>
          </Section>

          <Section title="13. Contact Us">
            <P>For questions about these Terms:</P>
            <P><strong>Email:</strong> legal@sloty.in<br />
            <strong>Address:</strong> Sloty Technologies, Hyderabad, Telangana, India</P>
          </Section>

        </div>
      </div>
    </div>
  );
}