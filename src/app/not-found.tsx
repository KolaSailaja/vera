import React from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
        <FileQuestion size={48} color="var(--accent-cyan)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          The requested navigation path does not exist in the environmental trust application shell.
        </p>
        <Link href="/" className="btn btn-primary">
          Return to Overview
        </Link>
      </div>
    </div>
  );
}
