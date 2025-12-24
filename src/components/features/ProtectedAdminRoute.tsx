import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const ProtectedAdminRoute: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const hasAdminRole = (session: Session | null) => {
            const role = session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role;
            return role === 'admin';
        };

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session && hasAdminRole(session));
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session && hasAdminRole(session));
        });

        return () => subscription.unsubscribe();
    }, []);

    if (isAuthenticated === null) {
        return <div className="p-4 text-center">Loading auth...</div>;
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/admin/login" replace />;
};
