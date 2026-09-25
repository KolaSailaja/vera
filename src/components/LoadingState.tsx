import React from 'react';

interface Props {
  message?: string;
}

export function LoadingState({ message = 'Loading environmental data trust records...' }: Props) {
  return (
    <div className="card empty-state" style={{ margin: '2rem 0' }}>
      <div className="spinner" style={{ width: 32, height: 32, marginBottom: '1rem' }} />
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</div>
    </div>
  );
}
