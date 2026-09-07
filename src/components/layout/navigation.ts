/** Navigation model (spec §5). Shared by the sidebar and the mobile bar. */

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Shown in the compact mobile bar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'grid', primary: true },
  { href: '/infrastructure', label: 'Infrastructure', icon: 'server', primary: true },
  { href: '/projects', label: 'Projects', icon: 'box' },
  { href: '/deployments', label: 'Deployments', icon: 'rocket' },
  { href: '/git', label: 'Git', icon: 'branch' },
  { href: '/alerts', label: 'Alerts', icon: 'bell', primary: true },
  { href: '/focus', label: 'Focus', icon: 'timer', primary: true },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];
