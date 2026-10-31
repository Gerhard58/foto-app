import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getViewer } from "@/lib/auth";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Fotowettbewerb",
  description: "Fotos einreichen, bewerten und kommentieren",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1f2937" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isAdmin } = await getViewer();
  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">Fotowettbewerb</Link>
          <nav>
            {isAdmin && <Link href="/admin">Admin</Link>}
            {user ? (
              <form action={signOut}>
                <span className="muted small">{user.email}</span>{" "}
                <button className="link">Abmelden</button>
              </form>
            ) : (
              <Link href="/login">Anmelden</Link>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
