import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "E-library", template: "%s · E-library" },
  description: "A calmer place to read, collect, and remember.",
  icons: { icon: "/e-library-logo.png", apple: "/e-library-logo.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
