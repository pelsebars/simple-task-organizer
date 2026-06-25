import "./globals.css";

export const metadata = {
  title: "Simple Task Organizer",
  description: "Goal graph task organizer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
