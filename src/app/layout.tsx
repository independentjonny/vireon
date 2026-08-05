import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIREON - Autonomous Financial OS",
  description: "AI-powered personal financial intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="vireon-decision-action-fallback"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const storageKey = "vireon-ai-decision-status-v1";
                const read = () => {
                  try {
                    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
                    return value && typeof value === "object" ? value : {};
                  } catch {
                    return {};
                  }
                };
                const normalize = (state) => typeof state === "string" ? { status: state } : state || { status: "New" };
                const write = (id, update) => {
                  if (!id) return;
                  const all = read();
                  all[id] = update(normalize(all[id]));
                  localStorage.setItem(storageKey, JSON.stringify(all));
                };
                document.addEventListener("click", (event) => {
                  const action = event.target && event.target.closest ? event.target.closest("[data-decision-action]") : null;
                  if (action) {
                    write(action.getAttribute("data-decision-action"), (current) => ({
                      ...current,
                      status: current.status === "Actioned" ? "Actioned" : "Reviewed",
                      clickedAt: current.clickedAt || new Date().toISOString(),
                    }));
                  }
                  const status = event.target && event.target.closest ? event.target.closest("[data-decision-status-id]") : null;
                  if (status) {
                    const nextStatus = status.getAttribute("data-decision-status") || "Reviewed";
                    write(status.getAttribute("data-decision-status-id"), (current) => {
                      const now = new Date().toISOString();
                      return nextStatus === "Actioned"
                        ? { ...current, status: "Actioned", clickedAt: current.clickedAt || now, actionedAt: now }
                        : { ...current, status: nextStatus };
                    });
                  }
                }, true);
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
