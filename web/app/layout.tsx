import type { Metadata } from "next";
import Link from "next/link";
import { Oswald, Alfa_Slab_One } from "next/font/google";
import "./globals.css";
import AuthNav from "./components/AuthNav";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-head" });
const alfa = Alfa_Slab_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "480 Hitting Co. · Reservations",
  description:
    "Reserve cage time at 480 Hitting Co. in Mesa, Arizona. Members book up to 3 weeks out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${oswald.variable} ${alfa.variable}`}>
        <header className="site-header">
          <Link href="/" className="brand">
            480 <span>Hitting Co.</span>
          </Link>
          <nav className="site-nav">
            <Link href="/book">Book Time</Link>
            <Link href="/membership">Membership</Link>
            <AuthNav />
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span>© 2026 480 Hitting Co. · Mesa, AZ</span>
          <span>
            {/* At launch, point to https://480hitting.co */}
            <a href="http://localhost:4810">Main Site</a>
            {" · "}
            <Link href="/admin">Staff</Link>
          </span>
        </footer>
      </body>
    </html>
  );
}
