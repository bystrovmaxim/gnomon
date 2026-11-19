import { AdminFrame } from "@/components/administration/AdminFrame";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <AdminFrame code={code} />;
}
