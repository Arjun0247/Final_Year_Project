import type { Metadata } from "next";
import { Outfit, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import BackgroundVideo from "./components/BackgroundVideo";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rapid Bio-Diagnosis",
  description: "AI-powered biometric analysis for instant blood group identification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${robotoMono.variable} antialiased font-sans`}>
        <AuthProvider>
          <BackgroundVideo />
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

