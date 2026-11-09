// packages/maxitor/maxitor-core/web/app/sign-in/refused/page.tsx
// A provider refused for the region (mockup 1.8): the other ways in, the law named in plain words.
import { Icon, Logo, ProviderRow, WAYS } from "@/components/marks";
import { signInOptions } from "@/lib/core";

export default async function RefusedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const tried = WAYS[query.provider ?? ""]?.name ?? "This service";
  const options = await signInOptions();
  return (
    <div className="auth">
      <div className="card">
        <Logo />
        <div className="alert bad" role="alert">
          <Icon.globe />
          <div><b>{tried} does not work from Russia.</b> Russian law allows a person in Russia to sign in only by a Russian service or by the site’s own means.</div>
        </div>
        <h2>Sign in another way</h2>
        <div className="sub">If your account was made with {tried}, sign in with the email and password, Yandex ID or Mail.ru ID you linked to it.</div>
        <a className="btn" href="/" style={{ textDecoration: "none" }}><Icon.mail />Sign in with email and password</a>
        <div className="or">or continue with</div>
        <ProviderRow providers={options.providers} />
      </div>
    </div>
  );
}
