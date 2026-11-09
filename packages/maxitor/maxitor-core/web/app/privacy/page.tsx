// packages/maxitor/maxitor-core/web/app/privacy/page.tsx
// The privacy policy, open to everyone (mockup 6.1); its version is the one the consent records.
import { Paper } from "@/components/Paper";

export const metadata = { title: "Privacy · Maxitor" };

export default function PrivacyPage() {
  return (
    <Paper title="Privacy" version={process.env.MAXITOR_POLICY_VERSION ?? "1"}>
      <p>Maxitor keeps only what it needs to let you sign in and work in your organizations.</p>
      <h3>What we keep</h3>
      <ul>
        <li>Your name and email.</li>
        <li>For each way you sign in — your email and password, Yandex ID, Mail.ru ID, Google, GitHub or Facebook: the service, the id it gives you, the email it gives, and the country, IP address and time when you added it. A password is kept only as a hash.</li>
        <li>The organizations you work in and your role there.</li>
        <li>When you accepted this policy, which version, and from which IP address.</li>
        <li>For ten minutes, a one-time code you asked for — only as a hash, never the code itself.</li>
      </ul>
      <h3>Why</h3>
      <ul>
        <li>To sign you in and keep you signed in.</li>
        <li>To show you the organizations you work in, and nobody else’s.</li>
        <li>To follow Russian law on how a person in Russia may sign in: that is what the country by IP is for.</li>
      </ul>
      <h3>Where and who else</h3>
      <p>Your data lives in Maxitor’s database on a server in Russia. Letters with codes are sent through Yandex Cloud Postbox. When you sign in with a service, it sees that you sign in to Maxitor. We do not sell your data and do not show it to anyone else.</p>
      <h3 id="cookies">Cookies</h3>
      <p>Maxitor sets one cookie, <code>__Host-maxitor_session</code>, that keeps you signed in; it is deleted when you sign out. While you sign in, two short cookies hold the step you are on and are deleted when it ends. Your answer to the cookie banner is kept in your browser. There are no analytics, advertising or third-party cookies.</p>
      <h3>How long</h3>
      <p>As long as your account exists. A code is deleted once used or after ten minutes.</p>
      <h3>Your data, your choice</h3>
      <p>You can see and unlink your ways in under “Sign-in methods”. To delete everything, follow <a className="lnk" href="/data-deletion">Delete my data</a>. Questions: <span className="addr">privacy@aoa.run</span>.</p>
    </Paper>
  );
}
