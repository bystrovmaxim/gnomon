// packages/maxitor/maxitor-core/web/app/sign-in/new-account/page.tsx
// The consent step (mockup 1.11): a new person ticks the box before the account exists; a signed-in account
// whose policy is older accepts the current one here too.
import { redirect } from "next/navigation";

import { consentPerson } from "@/app/actions";
import { ConsentCard } from "@/components/ConsentCard";
import { me, ownPath } from "@/lib/core";

export default async function NewAccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const next = ownPath(query.next);
  if (query.again) {
    const account = await me();
    if (!account) redirect("/");
    if (account.policy_current) redirect(next ?? "/w");
    return <ConsentCard again email={account.email} name={account.name} provider={null} next={next} />;
  }
  const person = await consentPerson();
  if (!person) redirect("/");
  return <ConsentCard again={false} email={person.email} name={person.name} provider={person.provider} next={next} />;
}
