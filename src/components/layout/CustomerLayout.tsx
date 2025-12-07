import React, { type ReactNode } from 'react';
import { CustomerHeader } from '../ui/CustomerHeader';

interface CustomerLayoutProps {
    children: ReactNode;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col relative">
            <CustomerHeader />
            <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
                {children}
            </main>
        </div>
    );
};
