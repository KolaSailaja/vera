'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  ShieldCheck,
  GitCompare,
  ClipboardList,
} from 'lucide-react';

const SIDEBAR_NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/observations', label: 'Observations', icon: Radio },
  { href: '/evidence', label: 'Data Quality', icon: ShieldCheck },
  { href: '/comparison', label: 'Satellite Comparison', icon: GitCompare },
  { href: '/decisions', label: 'Decision Log', icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <ul className="sidebar-menu">
        {SIDEBAR_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 'auto',
          padding: '0.85rem',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.75rem',
          color: 'var(--text-light)',
          background: '#f8fafc',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
          Station: JKUAT_MAIN
        </div>
        <div>Coordinates: -1.1018°, 37.0144°</div>
      </div>
    </aside>
  );
}
