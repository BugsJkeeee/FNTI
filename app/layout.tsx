import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Задачи команды",
  description: "Менеджер задач с ИИ-распределением",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
