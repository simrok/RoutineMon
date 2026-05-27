import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "RoutineMon",
  description: "같이 루틴 키울래? 루틴몬",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/quiple/galmuri/dist/galmuri.css"
        />
      </head>
      <body className={`${pressStart2P.variable} font-galmuri`}>
        {children}
      </body>
    </html>
  );
}