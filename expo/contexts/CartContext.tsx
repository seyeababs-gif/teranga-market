import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { CartItem, Product } from '@/types/marketplace';

const CART_STORAGE_KEY = '@marketplace_cart';

export const [CartContext, useCart] = createContextHook(() => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const saveCart = useCallback(async (items: CartItem[]) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, []);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsedItems = JSON.parse(stored);
          const itemsWithDates = parsedItems.map((item: CartItem) => ({
            ...item,
            product: {
              ...item.product,
              createdAt: item.product.createdAt ? new Date(item.product.createdAt) : new Date(),
              approvedAt: item.product.approvedAt ? new Date(item.product.approvedAt) : undefined,
              rejectedAt: item.product.rejectedAt ? new Date(item.product.rejectedAt) : undefined,
            }
          }));
          setCartItems(itemsWithDates);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    loadCart();
  }, []);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.product.id === product.id);
      
      let newItems: CartItem[];
      if (existingItem) {
        newItems = prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newItems = [...prevItems, { product, quantity }];
      }
      
      saveCart(newItems);
      return newItems;
    });
  }, [saveCart]);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems(prevItems => {
      const newItems = prevItems.filter(item => item.product.id !== productId);
      saveCart(newItems);
      return newItems;
    });
  }, [saveCart]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prevItems => {
      const newItems = prevItems.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      );
      saveCart(newItems);
      return newItems;
    });
  }, [saveCart, removeFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    saveCart([]);
  }, [saveCart]);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const hasDiscount = item.product.hasDiscount && item.product.discountPercent && item.product.discountPercent > 0;
      const price = hasDiscount && item.product.originalPrice 
        ? item.product.originalPrice * (1 - (item.product.discountPercent || 0) / 100)
        : item.product.price;
      return total + price * item.quantity;
    }, 0);
  }, [cartItems]);

  const getCartItemsCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  const isInCart = useCallback((productId: string) => {
    return cartItems.some(item => item.product.id === productId);
  }, [cartItems]);

  return useMemo(() => ({
    cartItems,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    isInCart,
  }), [cartItems, isLoading, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartItemsCount, isInCart]);
});
