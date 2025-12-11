import React, { useEffect, useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import styles from './PaymentTimer.module.css';

export interface PaymentTimerProps {
    /** The timestamp when the timer expires (payment_started_at + 15 minutes) */
    expiresAt: Date;
    /** Callback when timer reaches zero */
    onExpire: () => void;
    /** Whether the timer is paused (e.g., after payment proof upload) */
    isPaused: boolean;
    /** Whether the order has been cancelled/expired */
    isExpired?: boolean;
}

export const PaymentTimer: React.FC<PaymentTimerProps> = ({
    expiresAt,
    onExpire,
    isPaused,
    isExpired = false,
}) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [hasExpired, setHasExpired] = useState(false);

    const calculateTimeLeft = useCallback(() => {
        const now = new Date().getTime();
        const expiry = expiresAt.getTime();
        const diff = Math.max(0, expiry - now);
        return Math.floor(diff / 1000); // seconds
    }, [expiresAt]);

    useEffect(() => {
        // Initial calculation
        const initialTime = calculateTimeLeft();
        setTimeLeft(initialTime);

        if (initialTime <= 0 && !hasExpired && !isPaused) {
            setHasExpired(true);
            onExpire();
            return;
        }

        // Don't run timer if paused or already expired
        if (isPaused || hasExpired || isExpired) return;

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            if (remaining <= 0 && !hasExpired) {
                setHasExpired(true);
                clearInterval(interval);
                onExpire();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, isPaused, hasExpired, isExpired, calculateTimeLeft, onExpire]);

    // Reset hasExpired if expiresAt changes (timer reset)
    useEffect(() => {
        setHasExpired(false);
    }, [expiresAt]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    // Determine color class based on time remaining
    const getColorClass = () => {
        if (isPaused) return styles.paused;
        if (isExpired || hasExpired || timeLeft <= 0) return styles.expired;
        if (minutes < 2) return styles.critical; // Red, pulsing
        if (minutes < 5) return styles.warning;   // Yellow
        return styles.safe;                        // Green
    };

    // Format display
    const getDisplayText = () => {
        if (isPaused) return 'Menunggu verifikasi';
        if (isExpired || hasExpired || timeLeft <= 0) return 'Waktu habis';
        if (minutes === 0) return `${seconds} detik tersisa`;
        return `${minutes} menit tersisa`;
    };

    return (
        <div className={`${styles.timer} ${getColorClass()}`}>
            <Clock size={16} className={styles.icon} />
            <span className={styles.text}>{getDisplayText()}</span>
            {!isPaused && !isExpired && !hasExpired && timeLeft > 0 && (
                <span className={styles.countdown}>
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            )}
        </div>
    );
};
