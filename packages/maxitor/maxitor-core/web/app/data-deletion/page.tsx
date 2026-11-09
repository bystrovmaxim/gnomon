// packages/maxitor/maxitor-core/web/app/data-deletion/page.tsx
// How to delete everything Maxitor keeps about a person, open to everyone (mockup 6.2).
import { Paper } from "@/components/Paper";

export const metadata = { title: "Delete my data · Maxitor" };

export default function DataDeletionPage() {
  return (
    <Paper title="Delete my data">
      <p>You can ask Maxitor to delete your account and everything it keeps about you.</p>
      <ol className="steps">
        <li><div>Write to <span className="addr">privacy@aoa.run</span> <b>from the email of your account</b>, with the subject “Delete my Maxitor account”. If you sign in only with Google, GitHub, Facebook, Yandex ID or Mail.ru ID, write from the email that service gave Maxitor.</div></li>
        <li><div>We delete your account, all its ways in and your place in every organization within <b>30 days</b>, and write back when it is done.</div></li>
      </ol>
      <h3>What stays</h3>
      <p>What you made in an organization belongs to the organization and stays there, without your name. If you are an organization’s only administrator, pass the role to someone first, or say in the letter that the organization should be deleted too.</p>
      <h3>Signed in with Google, GitHub or Facebook?</h3>
      <p>You can also take Maxitor’s access away in that service’s settings. That stops new sign-ins but does not delete what Maxitor keeps — for that, write to us as above.</p>
    </Paper>
  );
}
