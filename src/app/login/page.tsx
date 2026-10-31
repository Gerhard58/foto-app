import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Anmelden</h1>
      <p>
        Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du dich ohne Passwort anmeldest.
      </p>
      {error && <p className="msg-err">Der Anmeldelink war ungültig oder abgelaufen. Bitte fordere einen neuen an.</p>}
      <LoginForm next={next.startsWith("/") ? next : "/"} />
    </div>
  );
}
