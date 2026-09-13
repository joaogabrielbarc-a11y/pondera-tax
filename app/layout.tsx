import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pondera Tax — Planejamento de IRPF CLT",
  description:
    "Projeção, auditoria de retenção e otimização do IRPF com processamento 100% local.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
