import React, { type ReactNode } from 'react';
import { CustomerHeader } from '../ui/CustomerHeader';

interface CustomerLayoutProps {
    children: ReactNode;
    hideCheckOrder?: boolean;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children, hideCheckOrder }) => {
    return (
        <div className="min-h-screen flex flex-col relative">
            <CustomerHeader hideCheckOrder={hideCheckOrder} />
            <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
                {children}
            </main>
        </div>
    );
};
