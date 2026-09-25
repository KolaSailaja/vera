import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'VERA - Environmental Data-Trust Application',
  description: 'Evidence-based weather station observation trust & satellite rainfall comparison system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <div className="main-wrapper">{children}</div>
        </div>
      </body>
    </html>
  );
}
