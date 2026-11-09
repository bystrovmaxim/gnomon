// packages/maxitor/maxitor-core/web/app/reset-password/page.tsx
// Resetting a password (mockup 7.1–7.3).
import { ResetFlow } from "@/components/ResetFlow";

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return <ResetFlow initialEmail={query.email ?? ""} />;
}
