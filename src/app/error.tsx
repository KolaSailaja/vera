'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem' }}>
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--status-faulty)' }}>
          <AlertTriangle size={24} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Application Runtime Error</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error.message || 'An unexpected error occurred while processing environmental data.'}
        </p>
        <button onClick={() => reset()} className="btn btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}
