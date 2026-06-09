'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Your Feed', path: '/' },
    { name: 'Explore', path: '/explore' },
    { name: 'Intelligence', path: '/intelligence' },
    { name: 'Must Read', path: '/must-read' },
    { name: 'Newspaper Wing', path: '/newspaper' },
  ];

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        News
      </Link>

      <div className={styles.navLinks}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`${styles.link} ${isActive ? styles.active : ''}`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
