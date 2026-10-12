import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Space_Grotesk, Syne } from "next/font/google";
import "./globals.css";

// Prose voice: Space Grotesk (D-047 two-voice rule; D-049 owner flip from
// Newsreader, 2026-10-12). Every sentence that talks to the player wears it.
// The framework default (Geist Sans) is banned from the arcade: nobody ever
// chose it, and it read as exactly that.
const prose = Space_Grotesk({
  variable: "--font-prose",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Display face: Syne. Owner pick, D-017 (2026-10-10).
const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Zarcade", template: "%s · Zarcade" },
  description:
    "Zarcade is a set of small games that teach how Zcash keeps payments private. You learn by playing, not by reading.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-motion="more"
      suppressHydrationWarning
      className={`${prose.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      {/* D-051: the saved motion choice lands on <html> before the first
          paint, so server and browser never disagree and React has nothing
          to refuse to patch. Reads the saved choice, else the computer's
          own setting. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("zarcade-motion");var less=p==="less"||(p!=="more"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);var h=document.documentElement;h.setAttribute("data-motion",less?"less":"more");if(p==="less"||p==="more"){h.setAttribute("data-pref",p)}else{h.removeAttribute("data-pref")}}catch(e){document.documentElement.setAttribute("data-motion","more")}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* D-051, relocated by D-061: the motion toggle's pressed state lands
            during parsing, before paint, so a saved choice shows correctly on
            a fresh load. It lives here (server layout, end of body) instead of
            inside the toggle component: a script in a client component is
            re-created on every client navigation, and React warns that it will
            never execute there. Every page's toggle is in its server-rendered
            HTML, so by the time the parser reaches this line the buttons exist.
            React accepts the corrected DOM via suppressHydrationWarning on the
            buttons (see motion-pref.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("zarcade-motion");["more","less"].forEach(function(k){document.querySelectorAll('.gm-motionBtn[data-opt="'+k+'"]').forEach(function(b){b.setAttribute("aria-pressed",String(p===k))})})}catch(e){}})();`,
          }}
        />
      </body>
    </html>
  );
}
