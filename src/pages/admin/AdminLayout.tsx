import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LayoutDashboard, Coffee, Layers, CreditCard, ShoppingBag, LogOut, Menu, X, Users, PhoneCall } from 'lucide-react';
import styles from './AdminLayout.module.css';


export const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin');
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    // Swipe gesture detection
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        // Swipe from right edge to left = open sidebar
        if (isLeftSwipe && touchStart > window.innerWidth - 50 && !isSidebarOpen) {
            setIsSidebarOpen(true);
        }

        // Swipe from left to right = close sidebar
        if (isRightSwipe && isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    };

    // Get current page title based on route
    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes('/dashboard')) return 'Dashboard';
        if (path.includes('/orders')) return 'Orders';
        if (path.includes('/menus')) return 'Menu Items';
        if (path.includes('/batches')) return 'Batches';
        if (path.includes('/waitlist')) return 'Waitlist';
        if (path.includes('/settings')) return 'Payment';
        if (path.includes('/contact')) return 'Admin Contact';
        return 'Admin';
    };

    const navSections = [
        {
            title: 'Overview',
            items: [
                { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            ]
        },
        {
            title: 'Management',
            items: [
                { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
                { path: '/admin/menus', icon: Coffee, label: 'Menu Items' },
                { path: '/admin/batches', icon: Layers, label: 'Batches' },
                { path: '/admin/waitlist', icon: Users, label: 'Waitlist' },
            ]
        },
        {
            title: 'Settings',
            items: [
                { path: '/admin/settings', icon: CreditCard, label: 'Payment' },
                { path: '/admin/contact', icon: PhoneCall, label: 'Admin Contact' },
            ]
        }
    ];

    return (
        <div
            className={styles.container}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Mobile Toggle Button */}
            <button className={styles.toggleBtn} onClick={toggleSidebar}>
                <Menu size={20} />
                <span className={styles.pageTitle}>{getPageTitle()}</span>
            </button>

            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div className={styles.overlay} onClick={closeSidebar} />
            )}

            <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
                <div className={styles.logo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>TutyJuicy</h2>
                        <span className={styles.badge}>Admin</span>
                    </div>
                    {/* Close button only shows on mobile via CSS */}
                    <button className={styles.closeBtn} onClick={closeSidebar}>
                        <X size={20} />
                    </button>
                </div>

                <nav className={styles.nav}>
                    {navSections.map((section) => (
                        <div key={section.title} className={styles.navSection}>
                            <p className={styles.navSectionTitle}>{section.title}</p>
                            {section.items.map((item) => (
                                <React.Fragment key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `${styles.navItem} ${isActive ? styles.active : ''}`
                                        }
                                        onClick={closeSidebar}
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                </React.Fragment>
                            ))}
                        </div>
                    ))}
                </nav>

                <button onClick={handleLogout} className={styles.logoutBtn}>
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </aside>

            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    );
};
