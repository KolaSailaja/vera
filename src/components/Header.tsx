'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Radio, Shield } from 'lucide-react';

interface HeaderProps {
  title?: string;
  sourceMode?: string;
  lastUpdated?: string;
  isLiveAvailable?: boolean;
}

export function Header({ title, sourceMode, lastUpdated, isLiveAvailable }: HeaderProps) {
  const pathname = usePathname();

  const primaryNav = [
    { href: '/', label: 'Overview' },
    { href: '/evidence', label: 'Data Quality' },
    { href: '/comparison', label: 'Rainfall Comparison' },
    { href: '/decisions', label: 'Decisions' },
  ];

  const getSourceDisplay = () => {
    if (sourceMode === 'LIVE_CONDUIT') {
      return isLiveAvailable !== false ? 'LIVE CONDUIT' : 'LIVE CONDUIT (UNREACHABLE)';
    }
    if (sourceMode === 'DEMO_SAMPLE_DATA') {
      return 'DEMO / SAMPLE DATA';
    }
    if (sourceMode === 'IMPORTED_CONDUIT_DATA') {
      return 'IMPORTED FILE DATA';
    }
    return sourceMode || 'CACHED TELEMETRY';
  };

  return (
    <header className="top-header">
      <div className="brand-section">
        <img
          src="/logo.png"
          alt="VERA Logo"
          className="brand-logo"
        />
        <span className="brand-name">VERA</span>
        <span className="brand-divider">|</span>
        <span className="brand-subtitle">Verified Environmental Reality & Analytics</span>
      </div>

      <nav className="header-nav">
        {primaryNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`header-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-status-panel">
        <span className="header-status-indicator">
          <Radio size={12} color={isLiveAvailable ? 'var(--accent-teal)' : '#f59e0b'} />
          <span>{getSourceDisplay()}</span>
        </span>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          <Clock size={12} />
          <span>{lastUpdated ? `Sync: ${lastUpdated}` : 'UTC Sync'}</span>
        </span>
      </div>
    </header>
  );
}

