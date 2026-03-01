import { Inter } from "next/font/google";
import "./globals.css";
import "./responsive.css";
import { AuthProvider } from "@/lib/AuthContext";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Axon — AI-Powered Learning",
  description: "Personalized NCERT learning powered by AI. Master Class 10 Science with an intelligent tutor that adapts to you.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
