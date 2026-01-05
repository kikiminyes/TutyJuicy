import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Menu } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import i18n from '../lib/i18n';

export interface CartItem extends Menu {
    quantity: number;
    max_stock?: number;
}

const MAX_ITEM_QUANTITY = 99;
const CART_STORAGE_KEY = 'tutyjuicy_cart';

interface CartState {
    items: CartItem[];
    isOpen: boolean;
    _hasHydrated: boolean;
}

interface CartActions {
    addItem: (item: Menu, maxStock?: number) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, delta: number) => void;
    clearCart: () => void;
    setIsOpen: (isOpen: boolean) => void;
    toggleCart: () => void;
    validateCart: () => Promise<void>;
    setHasHydrated: (state: boolean) => void;
}

interface CartStore extends CartState, CartActions {
    totalItems: number;
    totalPrice: number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            _hasHydrated: false,

            setHasHydrated: (state: boolean) => {
                set({ _hasHydrated: state });
            },

            addItem: (menu: Menu, maxStock?: number) => {
                const t = i18n.t.bind(i18n);
                set((state) => {
                    const existing = state.items.find((i) => i.id === menu.id);
                    // Determine limit: Use provided maxStock, or existing max_stock, or legacy MAX_ITEM_QUANTITY
                    const limit = maxStock !== undefined ? maxStock : (existing?.max_stock ?? MAX_ITEM_QUANTITY);

                    if (existing) {
                        const newQty = existing.quantity + 1;
                        if (newQty > limit) {
                            toast.error(t('menu.stockInsufficient'));
                            // If we have a new maxStock, update the item anyway to keep it fresh, but don't increase qty
                            if (maxStock !== undefined && existing.max_stock !== maxStock) {
                                return {
                                    items: state.items.map((i) =>
                                        i.id === menu.id ? { ...i, max_stock: maxStock } : i
                                    ),
                                };
                            }
                            return state;
                        }

                        return {
                            items: state.items.map((i) =>
                                i.id === menu.id
                                    ? { ...i, quantity: newQty, max_stock: maxStock ?? i.max_stock }
                                    : i
                            ),
                        };
                    }

                    // New item
                    if (1 > limit) {
                        toast.error(t('menu.stockInsufficient'));
                        return state;
                    }

                    return {
                        items: [...state.items, { ...menu, quantity: 1, max_stock: maxStock }],
                    };
                });
            },

            removeItem: (itemId: string) => {
                set((state) => ({
                    items: state.items.filter((i) => i.id !== itemId),
                }));
            },

            updateQuantity: (itemId: string, delta: number) => {
                const t = i18n.t.bind(i18n);
                set((state) => ({
                    items: state.items.map((i) => {
                        if (i.id === itemId) {
                            const newQty = i.quantity + delta;
                            const limit = i.max_stock ?? MAX_ITEM_QUANTITY;

                            if (newQty > limit) {
                                toast.error(t('menu.stockInsufficient'));
                                return i;
                            }
                            // Also respect global max hard limit if no specific stock (fallback)
                            if (newQty > MAX_ITEM_QUANTITY) {
                                toast.error(t('cart.maxItemError', { max: MAX_ITEM_QUANTITY }));
                                return i;
                            }

                            return newQty > 0 ? { ...i, quantity: newQty } : i;
                        }
                        return i;
                    }),
                }));
            },

            clearCart: () => {
                set({ items: [] });
            },

            setIsOpen: (isOpen: boolean) => {
                set({ isOpen });
            },

            toggleCart: () => {
                set((state) => ({ isOpen: !state.isOpen }));
            },

            validateCart: async () => {
                const t = i18n.t.bind(i18n);
                const { items } = get();
                if (!items.length) return;

                try {
                    const menuIds = items.map(item => item.id);
                    const { data: validMenus } = await supabase
                        .from('menus')
                        .select('id, name, price, description, image_url, size, created_at, updated_at')
                        .in('id', menuIds);

                    if (!validMenus || validMenus.length === 0) {
                        set({ items: [] });
                        return;
                    }

                    const validatedItems: CartItem[] = [];
                    let hasChanges = false;

                    for (const cartItem of items) {
                        const dbMenu = validMenus.find(m => m.id === cartItem.id);
                        if (dbMenu) {
                            if (dbMenu.price !== cartItem.price) {
                                hasChanges = true;
                            }
                            validatedItems.push({
                                ...dbMenu,
                                quantity: cartItem.quantity,
                                max_stock: cartItem.max_stock
                            });
                        } else {
                            hasChanges = true;
                        }
                    }

                    if (hasChanges && validatedItems.length < items.length) {
                        toast(t('errors.cartItemsUnavailable'), { icon: 'ℹ️' });
                    }

                    set({ items: validatedItems });
                } catch (e) {
                    console.error('Failed to validate cart', e);
                }
            },

            // Computed properties using getters
            get totalItems() {
                return get().items.reduce((sum, item) => sum + item.quantity, 0);
            },

            get totalPrice() {
                return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            },
        }),
        {
            name: CART_STORAGE_KEY,
            partialize: (state) => ({ items: state.items }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
                // Validate cart after hydration
                state?.validateCart();
            },
        }
    )
);

// Hook for backwards compatibility with context API
// Uses individual selectors to ensure proper reactivity
export const useCart = () => {
    const items = useCartStore(state => state.items);
    const isOpen = useCartStore(state => state.isOpen);
    const addItem = useCartStore(state => state.addItem);
    const removeItem = useCartStore(state => state.removeItem);
    const updateQuantity = useCartStore(state => state.updateQuantity);
    const clearCart = useCartStore(state => state.clearCart);
    const setIsOpen = useCartStore(state => state.setIsOpen);
    const toggleCart = useCartStore(state => state.toggleCart);

    // Compute derived values from items to ensure reactivity
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
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
    };
};
