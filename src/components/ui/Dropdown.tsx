import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import styles from './Dropdown.module.css';

export interface DropdownItem {
    label: string;
    icon?: React.ComponentType<{ size?: number }>;
    onClick: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}

interface DropdownProps {
    items: DropdownItem[];
    trigger?: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({ items, trigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleItemClick = (item: DropdownItem) => {
        if (item.disabled) return;
        item.onClick();
        setIsOpen(false);
    };

    return (
        <div className={styles.dropdown} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                aria-label="Open menu"
                aria-expanded={isOpen}
            >
                {trigger || <MoreVertical size={20} />}
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    {items.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={index}
                                className={`${styles.menuItem} ${
                                    item.variant === 'danger' ? styles.danger : ''
                                } ${item.disabled ? styles.disabled : ''}`}
                                onClick={() => handleItemClick(item)}
                                disabled={item.disabled}
                                type="button"
                            >
                                {Icon && <Icon size={18} />}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
