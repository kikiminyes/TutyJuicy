import React, { useEffect, useState, useRef } from 'react';
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
    const getTimeLeft = (target: Date) => {
        const diff = Math.max(0, target.getTime() - Date.now());
        return Math.floor(diff / 1000);
    };

    const [timeLeft, setTimeLeft] = useState<number>(() => getTimeLeft(expiresAt));
    const hasExpiredRef = useRef(false);

    useEffect(() => {
        hasExpiredRef.current = false;

        if (isPaused || isExpired) return;

        let active = true;

        const tick = () => {
            if (!active) return;
            const remaining = getTimeLeft(expiresAt);
            setTimeLeft(remaining);

            if (remaining <= 0 && !hasExpiredRef.current) {
                hasExpiredRef.current = true;
                onExpire();
            }
        };

        const timeoutId = setTimeout(tick, 0);
        const interval = setInterval(tick, 1000);

        return () => {
            active = false;
            clearTimeout(timeoutId);
            clearInterval(interval);
        };
    }, [expiresAt, isPaused, isExpired, onExpire]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    // Determine color class based on time remaining
    const getColorClass = () => {
        if (isPaused) return styles.paused;
        if (isExpired || timeLeft <= 0) return styles.expired;
        if (minutes < 2) return styles.critical; // Red, pulsing
        if (minutes < 5) return styles.warning;   // Yellow
        return styles.safe;                        // Green
    };

    // Format display
    const getDisplayText = () => {
        if (isPaused) return 'Menunggu verifikasi';
        if (isExpired || timeLeft <= 0) return 'Waktu habis';
        if (minutes === 0) return `${seconds} detik tersisa`;
        return `${minutes} menit tersisa`;
    };

    return (
        <div className={`${styles.timer} ${getColorClass()}`}>
            <Clock size={16} className={styles.icon} />
            <span className={styles.text}>{getDisplayText()}</span>
            {!isPaused && !isExpired && timeLeft > 0 && (
                <span className={styles.countdown}>
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            )}
        </div>
    );
};
