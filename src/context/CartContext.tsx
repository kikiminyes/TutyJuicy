import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Menu } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface CartItem extends Menu {
    quantity: number;
}

const MAX_ITEM_QUANTITY = 99;
const CART_STORAGE_KEY = 'tutyjuicy_cart';

interface CartContextType {
    items: CartItem[];
    addItem: (item: Menu) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, delta: number) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Load cart from local storage and validate against database
    useEffect(() => {
        const loadAndValidateCart = async () => {
            const savedCart = localStorage.getItem(CART_STORAGE_KEY);
            if (!savedCart) return;

            try {
                const parsedCart: CartItem[] = JSON.parse(savedCart);
                if (!parsedCart.length) return;

                // Validate cart items still exist in database with current prices
                const menuIds = parsedCart.map(item => item.id);
                const { data: validMenus } = await supabase
                    .from('menus')
                    .select('id, name, price, description, image_url, created_at, updated_at')
                    .in('id', menuIds);

                if (!validMenus || validMenus.length === 0) {
                    // All items removed, clear cart
                    localStorage.removeItem(CART_STORAGE_KEY);
                    return;
                }

                // Keep only valid items and update prices
                const validatedItems: CartItem[] = [];
                let hasChanges = false;

                for (const cartItem of parsedCart) {
                    const dbMenu = validMenus.find(m => m.id === cartItem.id);
                    if (dbMenu) {
                        // Update item with current DB data
                        if (dbMenu.price !== cartItem.price) {
                            hasChanges = true;
                        }
                        validatedItems.push({
                            ...dbMenu,
                            quantity: cartItem.quantity
                        });
                    } else {
                        hasChanges = true;
                    }
                }

                if (hasChanges && validatedItems.length < parsedCart.length) {
                    toast('Some items in your cart are no longer available', { icon: 'ℹ️' });
                }

                setItems(validatedItems);
            } catch (e) {
                console.error('Failed to load cart', e);
                localStorage.removeItem(CART_STORAGE_KEY);
            }
        };

        loadAndValidateCart();
    }, []);

    // Save cart to local storage on change
    useEffect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addItem = (menu: Menu) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.id === menu.id);
            if (existing) {
                if (existing.quantity >= MAX_ITEM_QUANTITY) {
                    toast.error(`Maximum ${MAX_ITEM_QUANTITY} items per product`);
                    return prev;
                }
                return prev.map((i) =>
                    i.id === menu.id ? { ...i, quantity: i.quantity + 1 } : i
                );
            }
            return [...prev, { ...menu, quantity: 1 }];
        });
        setIsOpen(true);
    };

    const removeItem = (itemId: string) => {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setItems((prev) =>
            prev.map((i) => {
                if (i.id === itemId) {
                    const newQty = i.quantity + delta;
                    if (newQty > MAX_ITEM_QUANTITY) {
                        toast.error(`Maximum ${MAX_ITEM_QUANTITY} items per product`);
                        return i;
                    }
                    return newQty > 0 ? { ...i, quantity: newQty } : i;
                }
                return i;
            })
        );
    };

    const clearCart = () => {
        setItems([]);
    };

    const toggleCart = () => setIsOpen((prev) => !prev);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                items,
                addItem,
                removeItem,
                updateQuantity,
                clearCart,
                totalItems,
                totalPrice,
                isOpen,
                setIsOpen,
                toggleCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
