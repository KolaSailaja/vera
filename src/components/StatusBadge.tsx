import React from 'react';

type TrustCategory = 'TRUSTWORTHY' | 'FAULTY' | 'DISAGREEMENT' | 'INSUFFICIENT_DATA';

interface Props {
  status: TrustCategory | string;
}

export function StatusBadge({ status }: Props) {
  const normStatus = (status || '').toUpperCase();

  switch (normStatus) {
    case 'TRUSTWORTHY':
      return <span className="badge badge-trustworthy">✓ Trustworthy</span>;
    case 'FAULTY':
      return <span className="badge badge-faulty">⚠ Faulty Sensor</span>;
    case 'DISAGREEMENT':
      return <span className="badge badge-disagreement">⚡ Disagreement</span>;
    case 'INSUFFICIENT_DATA':
      return <span className="badge badge-insufficient">? Insufficient Data</span>;
    default:
      return <span className="badge badge-insufficient">{status}</span>;
  }
}
