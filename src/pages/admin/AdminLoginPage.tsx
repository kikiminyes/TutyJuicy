import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './AdminLoginPage.module.css';

export const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            const role = data.user?.app_metadata?.role ?? data.user?.user_metadata?.role;
            if (role !== 'admin') {
                await supabase.auth.signOut();
                throw new Error('Akun ini bukan admin');
            }

            toast.success('Welcome back!');
            navigate('/admin/orders');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <h1 className={styles.logo}>TutyJuicy</h1>
                    <p className={styles.subtitle}>Admin Dashboard</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="admin@tutyjuicy.com"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="********"
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p className={styles.footerText}>Secure admin access</p>
                </div>
            </div>
        </div>
    );
};
