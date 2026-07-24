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

export default function PrivacyPolicy({ onBack } = {}) {
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
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Last updated: {lastUpdated}</p>
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

          <P>Sloty ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use the Sloty mobile application and related services.</P>

          <Section title="1. Information We Collect">
            <P>We collect the following types of information:</P>
            <ul>
              <Li><strong>Account Information:</strong> Your name, email address, mobile number, and city when you register.</Li>
              <Li><strong>Google Sign-In:</strong> If you sign in with Google, we receive your name, email, and profile picture from Google.</Li>
              <Li><strong>Booking Data:</strong> Details of appointments you book, including the service, date, time, and store.</Li>
              <Li><strong>Payment Data:</strong> If you pay online, our payment gateway processes your transaction and shares limited details with us (amount, payment status, a transaction reference) so we can confirm your booking. We do not receive or store your card, UPI ID, or bank details directly — these are handled entirely by our payment gateway.</Li>
              <Li><strong>Location:</strong> Your approximate location (city/area) to show nearby stores. Precise GPS is only accessed when you tap "Nearest First" or "Map View", and only with your permission.</Li>
              <Li><strong>Device Information:</strong> Device type and push notification token (for booking reminders).</Li>
              <Li><strong>Usage Data:</strong> How you interact with the app, to improve our service.</Li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <Li>To create and manage your account</Li>
              <Li>To process and confirm slot bookings</Li>
              <Li>To send booking confirmations, OTPs, and reminders via SMS, email, and push notifications</Li>
              <Li>To show stores near your location</Li>
              <Li>To power the AI booking assistant (your messages are processed to understand your request and are not stored beyond the session)</Li>
              <Li>To manage your Sloty Wallet and referral credits</Li>
              <Li>To improve our app and troubleshoot issues</Li>
            </ul>
          </Section>

          <Section title="3. Information Sharing">
            <P>We do not sell your personal information. We share it only in the following cases:</P>
            <ul>
              <Li><strong>With store owners:</strong> Your name and phone number are shared with the store you book with, so they can confirm your appointment.</Li>
              <Li><strong>Service providers:</strong> We use trusted third-party services including MSG91 (SMS), Razorpay (payment processing), WhatsApp Business (booking reminders and confirmations, where enabled), Firebase (push notifications), Google (Maps, OAuth), and MongoDB Atlas (database). These providers process data only as necessary to deliver their services.</Li>
              <Li><strong>Legal requirements:</strong> We may disclose information if required by Indian law or a valid legal process.</Li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <P>We retain your account data for as long as your account is active. Booking records are retained for 2 years for dispute resolution. You may request deletion of your account and associated data by contacting us at privacy@sloty.in.</P>
          </Section>

          <Section title="5. Data Security">
            <P>We use industry-standard security measures including encrypted HTTPS connections, JWT-based authentication, and hashed passwords. OTPs expire within 5 minutes and are never stored in plain text.</P>
          </Section>

          <Section title="6. Your Rights">
            <P>You have the right to:</P>
            <ul>
              <Li>Access the personal data we hold about you</Li>
              <Li>Correct inaccurate information via the Settings screen</Li>
              <Li>Request deletion of your account and data</Li>
              <Li>Withdraw consent for push notifications at any time via your device settings</Li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            <P>Sloty is not intended for users under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.</P>
          </Section>

          <Section title="8. Changes to This Policy">
            <P>We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of Sloty after changes constitutes acceptance of the updated policy.</P>
          </Section>

          <Section title="9. Contact Us">
            <P>For privacy-related questions or requests, contact us at:</P>
            <P><strong>Email:</strong> privacy@sloty.in<br />
            <strong>Address:</strong> Sloty Technologies, Hyderabad, Telangana, India</P>
          </Section>

        </div>
      </div>
    </div>
  );
}