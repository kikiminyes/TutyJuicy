import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { OrderLookupModal } from './OrderLookupModal';
import styles from './CustomerHeader.module.css';

export const CustomerHeader: React.FC = () => {
    const [showLookup, setShowLookup] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show brand text when scrolled more than 100px
            setIsScrolled(window.scrollY > 100);
        };

        // Check initial position
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : styles.headerTop}`}>
                <Link to="/" className={styles.logo}>
                    <span className={styles.logoIcon}>🍊</span>
                    <span className={`${styles.brandText} ${isScrolled ? styles.brandTextVisible : ''}`}>
                        TutyJuicy
                    </span>
                </Link>

                <div className={styles.actions}>
                    <button
                        className={styles.checkOrderBtn}
                        onClick={() => setShowLookup(true)}
                    >
                        <Search size={16} />
                        <span className={styles.buttonText}>Cek Pesanan</span>
                    </button>
                </div>
            </header>

            <OrderLookupModal
                isOpen={showLookup}
                onClose={() => setShowLookup(false)}
            />
        </>
    );
};
