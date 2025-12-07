import React from 'react';
import styles from './Tabs.module.css';

export interface Tab {
    id: string;
    label: string;
    count?: number;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
    return (
        <div className={styles.tabs} role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                    onClick={() => onChange(tab.id)}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    type="button"
                >
                    <span className={styles.label}>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                        <span className={styles.count}>{tab.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
};
