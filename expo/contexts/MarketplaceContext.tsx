import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Product, Category, User, UserType, Review, ProductStatus, SubCategory, ListingType, SaleType } from '@/types/marketplace';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

export const [MarketplaceProvider, useMarketplace] = createContextHook(() => {
  const notifications = useNotifications();
  const toast = useToast();
  const { globalSettings } = useGlobalSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sellerStats, setSellerStats] = useState({
    totalViews: 0,
    totalWhatsAppClicks: 0,
    totalFavorites: 0,
    totalProducts: 0,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    loadProducts();
  }, []);
  
  useEffect(() => {
    if (currentUser) {
      loadFavorites();
      loadSellerStats(currentUser.id);
    } else {
      setFavorites([]);
      setSellerStats({
        totalViews: 0,
        totalWhatsAppClicks: 0,
        totalFavorites: 0,
        totalProducts: 0,
      });
    }
  }, [currentUser]);

  const loadUser = async () => {
    try {
      let storedUserId: string | null = null;
      if (Platform.OS === 'web') {
        storedUserId = localStorage.getItem('currentUserId');
      } else {
        storedUserId = await AsyncStorage.getItem('currentUserId');
      }
      if (storedUserId) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', storedUserId)
          .single();
        
        if (error || !userData) {
          console.error('Error loading user from Supabase:', error);
          if (Platform.OS === 'web') {
            localStorage.removeItem('currentUserId');
          } else {
            await AsyncStorage.removeItem('currentUserId');
          }
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }

        const user: User = {
          id: userData.id,
          name: userData.name,
          avatar: userData.avatar,
          phone: userData.phone,
          password: userData.password,
          location: userData.location,
          type: userData.type as UserType,
          isAdmin: userData.is_admin,
          isSuperAdmin: userData.is_super_admin,
          isPartner: userData.is_partner,
          partnerReferralCode: userData.partner_referral_code,
          email: userData.email,
          bio: userData.bio,
          rating: userData.rating,
          reviewCount: userData.review_count,
          joinedDate: userData.joined_date ? new Date(userData.joined_date) : undefined,
          premiumPaymentPending: userData.premium_payment_pending,
          premiumRequestDate: userData.premium_request_date ? new Date(userData.premium_request_date) : undefined,
          deliveryAddress: userData.delivery_address,
          deliveryCity: userData.delivery_city,
          deliveryPhone: userData.delivery_phone,
        };
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  const loadProducts = async () => {
    try {
      const cachedProducts = Platform.OS === 'web' 
        ? localStorage.getItem('cached_products')
        : await AsyncStorage.getItem('cached_products');
      
      const cachedTimestamp = Platform.OS === 'web'
        ? localStorage.getItem('cached_products_timestamp')
        : await AsyncStorage.getItem('cached_products_timestamp');
      
      const now = Date.now();
      const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp, 10) : Infinity;
      const MAX_STALE_AGE = 2 * 60 * 60 * 1000;
      
      if (cachedProducts && cacheAge < MAX_STALE_AGE) {
        try {
          const parsed = JSON.parse(cachedProducts);
          const mappedFromCache: Product[] = parsed.map((p: any) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            approvedAt: p.approvedAt ? new Date(p.approvedAt) : undefined,
            rejectedAt: p.rejectedAt ? new Date(p.rejectedAt) : undefined,
          }));
          setProducts(mappedFromCache);
          
          loadProductsFromServer();
          return;
        } catch (e) {
          console.error('Error parsing cached products:', e);
        }
      }
      
      await loadProductsFromServer();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error loading products:', errorMsg);
    }
  };
  
  const loadProductsFromServer = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error loading products:', error.message || error);
        throw new Error(error.message || 'Failed to load products');
      }

      if (data) {
        const mappedProducts: Product[] = data.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          price: parseFloat(p.price),
          images: p.images,
          category: p.category as Category,
          subCategory: p.sub_category as SubCategory | undefined,
          location: p.location,
          sellerId: p.seller_id,
          sellerName: p.seller_name,
          sellerAvatar: p.seller_avatar,
          sellerPhone: p.seller_phone,
          createdAt: new Date(p.created_at),
          condition: p.condition,
          status: p.status as ProductStatus,
          rejectionReason: p.rejection_reason,
          approvedAt: p.approved_at ? new Date(p.approved_at) : undefined,
          rejectedAt: p.rejected_at ? new Date(p.rejected_at) : undefined,
          approvedBy: p.approved_by,
          averageRating: p.average_rating,
          reviewCount: p.review_count,
          listingType: p.listing_type as ListingType,
          serviceDetails: p.service_details,
          stockQuantity: p.stock_quantity,
          isOutOfStock: p.is_out_of_stock,
          hasDiscount: p.has_discount,
          discountPercent: p.discount_percent,
          originalPrice: p.original_price ? parseFloat(p.original_price) : undefined,
          commissionAmount: p.commission_amount ? parseFloat(p.commission_amount) : undefined,
          isDonation: p.is_donation ?? false,
          saleType: p.sale_type as SaleType | undefined,
        }));
        setProducts(mappedProducts);

        const cacheData = JSON.stringify(mappedProducts);
        const timestamp = Date.now().toString();
        
        if (Platform.OS === 'web') {
          try {
            localStorage.setItem('cached_products', cacheData);
            localStorage.setItem('cached_products_timestamp', timestamp);
          } catch (e) {
            console.error('Error caching products:', e);
            try {
              localStorage.removeItem('cached_products');
              localStorage.removeItem('cached_products_timestamp');
            } catch (clearError) {
              console.error('Error clearing cache:', clearError);
            }
          }
        } else {
          try {
            await AsyncStorage.multiSet([
              ['cached_products', cacheData],
              ['cached_products_timestamp', timestamp]
            ]);
          } catch (e) {
            console.error('Error caching products:', e);
            try {
              await AsyncStorage.multiRemove(['cached_products', 'cached_products_timestamp']);
            } catch (clearError) {
              console.error('Error clearing cache:', clearError);
            }
          }
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error loading products from server:', errorMsg);
    }
  };

  const loadFavorites = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', currentUser.id);
      
      if (error) {
        console.error('Error loading favorites:', error);
        return;
      }
      
      if (data) {
        setFavorites(data.map((f: any) => f.product_id));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };



  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const loadSellerStats = useCallback(async (sellerId: string) => {
    if (!UUID_RE.test(sellerId)) return;
    try {
      const { data, error } = await supabase.rpc('get_seller_stats', {
        p_seller_id: sellerId,
      });
      if (error) {
        console.error('Error loading seller stats:', error);
        return;
      }
      if (data && data.length > 0) {
        const row = data[0];
        setSellerStats({
          totalViews: row.total_views ?? 0,
          totalWhatsAppClicks: row.total_whatsapp_clicks ?? 0,
          totalFavorites: row.total_favorites ?? 0,
          totalProducts: row.total_products ?? 0,
        });
      }
    } catch (error) {
      console.error('Error loading seller stats:', error);
    }
  }, []);

  const incrementProductStat = useCallback(async (
    productId: string,
    statName: 'view_count' | 'whatsapp_click_count' | 'favorite_count',
    delta: number = 1
  ) => {
    if (!UUID_RE.test(productId)) return;
    try {
      await supabase.rpc('increment_product_stat', {
        p_product_id: productId,
        p_stat_name: statName,
        p_delta: delta,
      });
    } catch (error) {
      console.error('Error incrementing product stat:', error);
    }
  }, []);

  const getProductStats = useCallback(async (productId: string) => {
    if (!UUID_RE.test(productId)) {
      return { viewCount: 0, whatsappClickCount: 0, favoriteCount: 0 };
    }
    try {
      const { data, error } = await supabase
        .from('product_stats')
        .select('view_count, whatsapp_click_count, favorite_count')
        .eq('product_id', productId)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error loading product stats:', error);
        }
        return { viewCount: 0, whatsappClickCount: 0, favoriteCount: 0 };
      }
      return {
        viewCount: data?.view_count ?? 0,
        whatsappClickCount: data?.whatsapp_click_count ?? 0,
        favoriteCount: data?.favorite_count ?? 0,
      };
    } catch (error) {
      console.error('Error loading product stats:', error);
      return { viewCount: 0, whatsappClickCount: 0, favoriteCount: 0 };
    }
  }, []);

  const toggleFavorite = useCallback(async (productId: string) => {
    if (!isAuthenticated || !currentUser) {
      return;
    }
    
    try {
      const isFav = favorites.includes(productId);
      
      if (isFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('product_id', productId);
        
        if (error) {
          console.error('Error removing favorite:', error);
          return;
        }
        
        setFavorites(favorites.filter(id => id !== productId));
        incrementProductStat(productId, 'favorite_count', -1);
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert([{
            user_id: currentUser.id,
            product_id: productId,
          }]);
        
        if (error) {
          console.error('Error adding favorite:', error);
          return;
        }
        
        setFavorites([...favorites, productId]);
        incrementProductStat(productId, 'favorite_count', 1);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [favorites, isAuthenticated, currentUser, incrementProductStat]);

  const isFavorite = useCallback((productId: string) => favorites.includes(productId), [favorites]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const isApproved = product.status === 'approved';
      const isAdmin = currentUser?.isAdmin === true;
      const isSuperAdmin = currentUser?.isSuperAdmin === true;
      const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSubCategory = !selectedSubCategory || product.subCategory === selectedSubCategory;
      return (isAdmin || isSuperAdmin || isApproved) && matchesSearch && matchesCategory && matchesSubCategory;
    });
  }, [products, searchQuery, selectedCategory, selectedSubCategory, currentUser]);

  const favoriteProducts = useMemo(() => {
    return products.filter(product => favorites.includes(product.id));
  }, [products, favorites]);

  const userProducts = useMemo(() => {
    if (!currentUser) return [];
    return products.filter(product => product.sellerId === currentUser.id);
  }, [products, currentUser]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'createdAt' | 'sellerId' | 'sellerName' | 'sellerAvatar' | 'status'>) => {
    if (!currentUser) return { success: false, error: 'User not logged in' };
    
    try {
      // FREE VERSION — zero commission for everyone
      const commissionAmount = 0;

      const newProductData = {
        id: `product-${Date.now()}`,
        title: product.title,
        description: product.description,
        price: product.price,
        images: product.images,
        category: product.category,
        sub_category: product.subCategory,
        location: product.location,
        seller_id: currentUser.id,
        seller_name: currentUser.name,
        seller_avatar: currentUser.avatar,
        seller_phone: currentUser.phone,
        condition: product.condition,
        status: 'pending',
        listing_type: product.listingType || 'product',
        service_details: product.serviceDetails,
        stock_quantity: product.stockQuantity,
        is_out_of_stock: product.listingType === 'product' ? false : undefined,
        has_discount: product.hasDiscount,
        discount_percent: product.discountPercent,
        original_price: product.originalPrice,
        commission_amount: commissionAmount,
        is_donation: product.isDonation ?? false,
        sale_type: product.saleType ?? 'sale',
      };

      const { data, error } = await supabase
        .from('products')
        .insert([newProductData])
        .select()
        .single();

      if (error) {
        console.error('Error adding product:', error);
        return { success: false, error: error.message };
      }

      if (data) {
        const newProduct: Product = {
          id: data.id,
          title: data.title,
          description: data.description,
          price: parseFloat(data.price),
          images: data.images,
          category: data.category as Category,
          subCategory: data.sub_category as SubCategory | undefined,
          location: data.location,
          sellerId: data.seller_id,
          sellerName: data.seller_name,
          sellerAvatar: data.seller_avatar,
          sellerPhone: data.seller_phone,
          createdAt: new Date(data.created_at),
          condition: data.condition,
          status: data.status as ProductStatus,
          listingType: data.listing_type as ListingType,
          serviceDetails: data.service_details,
          stockQuantity: data.stock_quantity,
          isOutOfStock: data.is_out_of_stock,
          hasDiscount: data.has_discount,
          discountPercent: data.discount_percent,
          originalPrice: data.original_price ? parseFloat(data.original_price) : undefined,
          commissionAmount: data.commission_amount ? parseFloat(data.commission_amount) : undefined,
          isDonation: data.is_donation ?? false,
          saleType: data.sale_type as SaleType | undefined,
        };
        setProducts([newProduct, ...products]);

        await notifications.sendNotificationToAdmins({
          type: 'product_published',
          title: 'Nouvelle annonce publiée',
          message: `${currentUser.name} a publié une nouvelle annonce: ${product.title}`,
          data: { productId: data.id, sellerId: currentUser.id },
        });

        return { success: true, product: newProduct };
      }
      return { success: false, error: 'No data returned' };
    } catch (error: any) {
      console.error('Error adding product:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [currentUser, products, notifications]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) {
        console.error('Product not found');
        return;
      }

      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.images !== undefined) updateData.images = updates.images;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.subCategory !== undefined) updateData.sub_category = updates.subCategory;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.condition !== undefined) updateData.condition = updates.condition;
      
      if (currentUser?.type === 'premium') {
        if (updates.stockQuantity !== undefined) updateData.stock_quantity = updates.stockQuantity;
        if (updates.isOutOfStock !== undefined) updateData.is_out_of_stock = updates.isOutOfStock;
        if (updates.hasDiscount !== undefined) updateData.has_discount = updates.hasDiscount;
        if (updates.discountPercent !== undefined) updateData.discount_percent = updates.discountPercent;
        if (updates.originalPrice !== undefined) updateData.original_price = updates.originalPrice;
      } else {
        if (product.stockQuantity !== undefined && updates.stockQuantity !== undefined) {
          updateData.stock_quantity = updates.stockQuantity;
        }
        if (product.isOutOfStock !== undefined && updates.isOutOfStock !== undefined) {
          updateData.is_out_of_stock = updates.isOutOfStock;
        }
        if (product.hasDiscount && updates.hasDiscount !== undefined) {
          updateData.has_discount = updates.hasDiscount;
        }
        if (product.hasDiscount && updates.discountPercent !== undefined) {
          updateData.discount_percent = updates.discountPercent;
        }
        if (product.hasDiscount && updates.originalPrice !== undefined) {
          updateData.original_price = updates.originalPrice;
        }
      }
      
      if (updates.serviceDetails !== undefined) updateData.service_details = updates.serviceDetails;
      if (updates.listingType !== undefined) updateData.listing_type = updates.listingType;

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) {
        console.error('Error updating product:', error);
        return;
      }

      const finalUpdates: Partial<Product> = {};
      if (updateData.title !== undefined) finalUpdates.title = updateData.title;
      if (updateData.description !== undefined) finalUpdates.description = updateData.description;
      if (updateData.price !== undefined) finalUpdates.price = updateData.price;
      if (updateData.images !== undefined) finalUpdates.images = updateData.images;
      if (updateData.category !== undefined) finalUpdates.category = updateData.category as Category;
      if (updateData.sub_category !== undefined) finalUpdates.subCategory = updateData.sub_category;
      if (updateData.location !== undefined) finalUpdates.location = updateData.location;
      if (updateData.condition !== undefined) finalUpdates.condition = updateData.condition;
      if (updateData.stock_quantity !== undefined) finalUpdates.stockQuantity = updateData.stock_quantity;
      if (updateData.is_out_of_stock !== undefined) finalUpdates.isOutOfStock = updateData.is_out_of_stock;
      if (updateData.has_discount !== undefined) finalUpdates.hasDiscount = updateData.has_discount;
      if (updateData.discount_percent !== undefined) finalUpdates.discountPercent = updateData.discount_percent;
      if (updateData.original_price !== undefined) finalUpdates.originalPrice = updateData.original_price;
      if (updateData.service_details !== undefined) finalUpdates.serviceDetails = updateData.service_details;
      if (updateData.listing_type !== undefined) finalUpdates.listingType = updateData.listing_type as ListingType;

      setProducts(products.map(p => p.id === productId ? { ...p, ...finalUpdates } : p));
    } catch (error) {
      console.error('Error updating product:', error);
    }
  }, [products, currentUser]);

  const renewProduct = useCallback(async (productId: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('products')
        .update({ created_at: now })
        .eq('id', productId);

      if (error) {
        console.error('Error renewing product:', error);
        return { success: false, error: error.message };
      }

      setProducts(products.map(p => p.id === productId ? { ...p, createdAt: new Date(now) } : p));
      return { success: true };
    } catch (error: any) {
      console.error('Error renewing product:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [products]);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        console.error('Error deleting product:', error);
        return;
      }

      setProducts(products.filter(p => p.id !== productId));
      setFavorites(favorites.filter(id => id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }, [products, favorites]);

  const canAddProduct = useCallback(() => {
    if (!currentUser) {
      return { canAdd: false, reason: 'Vous devez être connecté pour ajouter un produit.' };
    }
    // FREE VERSION — unlimited listings for everyone
    return { canAdd: true, reason: '' };
  }, [currentUser]);

  const getMaxImages = useCallback(() => {
    // FREE VERSION — generous image limit for everyone
    return 10;
  }, []);

  const upgradeToPremium = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('users')
        .update({ type: 'premium' })
        .eq('id', currentUser.id);
      
      const updatedUser = { ...currentUser, type: 'premium' as UserType };
      setCurrentUser(updatedUser);
    } catch (error) {
      console.error('Error upgrading to premium:', error);
    }
  }, [currentUser]);

  const requestPremiumUpgrade = useCallback(async () => {
    if (!currentUser) return { success: false, error: 'Non connecté' };
    try {
      const { error } = await supabase
        .from('users')
        .update({
          premium_payment_pending: true,
          premium_request_date: new Date().toISOString(),
        })
        .eq('id', currentUser.id);
      
      if (error) {
        console.error('Error requesting premium upgrade:', error);
        return { success: false, error: 'Erreur lors de la demande' };
      }
      
      const updatedCurrentUser = { 
        ...currentUser, 
        premiumPaymentPending: true, 
        premiumRequestDate: new Date() 
      };
      setCurrentUser(updatedCurrentUser);
      await loadAllUsers();
      
      return { success: true };
    } catch (error) {
      console.error('Error requesting premium upgrade:', error);
      return { success: false, error: 'Erreur lors de la demande' };
    }
  }, [currentUser]);

  const approvePremiumUpgrade = useCallback(async (userId: string) => {
    if (!currentUser?.isAdmin) return { success: false, error: 'Non autorisé' };
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          type: 'premium',
          premium_payment_pending: false,
          premium_request_date: null,
        })
        .eq('id', userId);
      
      if (error) {
        console.error('Error approving premium upgrade:', error);
        return { success: false, error: 'Erreur lors de l\'approbation' };
      }
      
      await loadAllUsers();
      
      if (currentUser.id === userId) {
        const updatedCurrentUser = { 
          ...currentUser, 
          type: 'premium' as UserType, 
          premiumPaymentPending: false, 
          premiumRequestDate: undefined 
        };
        setCurrentUser(updatedCurrentUser);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error approving premium upgrade:', error);
      return { success: false, error: 'Erreur lors de l\'approbation' };
    }
  }, [currentUser]);

  const rejectPremiumUpgrade = useCallback(async (userId: string) => {
    if (!currentUser?.isAdmin) return { success: false, error: 'Non autorisé' };
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          premium_payment_pending: false,
          premium_request_date: null,
        })
        .eq('id', userId);
      
      if (error) {
        console.error('Error rejecting premium upgrade:', error);
        return { success: false, error: 'Erreur lors du rejet' };
      }
      
      await loadAllUsers();
      
      if (currentUser.id === userId) {
        const updatedCurrentUser = { 
          ...currentUser, 
          premiumPaymentPending: false, 
          premiumRequestDate: undefined 
        };
        setCurrentUser(updatedCurrentUser);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error rejecting premium upgrade:', error);
      return { success: false, error: 'Erreur lors du rejet' };
    }
  }, [currentUser]);

  const register = useCallback(async (userData: { name: string; email: string; password: string; location: string; deliveryAddress: string; deliveryCity: string; phone?: string }) => {
    try {
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', userData.email)
        .single();
      
      if (existingEmail) {
        return { success: false, error: 'Cet email est déjà enregistré' };
      }

      if (userData.phone) {
        const { data: existingPhone } = await supabase
          .from('users')
          .select('id')
          .eq('phone', userData.phone)
          .single();
        
        if (existingPhone) {
          return { success: false, error: 'Ce numéro WhatsApp est déjà enregistré' };
        }
      }

      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newUserData = {
        id: userId,
        name: userData.name,
        email: userData.email,
        password: userData.password,
        phone: userData.phone || null,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=00A651&color=fff&size=200`,
        location: userData.location,
        type: 'standard',
        is_admin: false,
        delivery_address: userData.deliveryAddress,
        delivery_city: userData.deliveryCity,
      };

      const { error: insertError } = await supabase
        .from('users')
        .insert([newUserData]);

      if (insertError) {
        console.error('User insert error:', insertError);
        const message = insertError.message || '';
        const code = (insertError as any).code || '';
        if (code === '23505' || message.includes('users_phone_key')) {
          return { success: false, error: 'Ce numéro WhatsApp est déjà enregistré' };
        }
        if (code === '23505' || message.includes('users_email_key')) {
          return { success: false, error: 'Cet email est déjà enregistré' };
        }
        return { success: false, error: 'Erreur lors de l\'enregistrement des données' };
      }

      const newUser: User = {
        id: userId,
        name: userData.name,
        email: userData.email,
        password: userData.password,
        avatar: newUserData.avatar,
        location: userData.location,
        type: 'standard',
        joinedDate: new Date(),
        deliveryAddress: userData.deliveryAddress,
        deliveryCity: userData.deliveryCity,
      };
      
      if (Platform.OS === 'web') {
        localStorage.setItem('currentUserId', userId);
      } else {
        await AsyncStorage.setItem('currentUserId', userId);
      }
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      
      toast.showSuccess('Inscription réussie ! Bienvenue sur Marketplace');
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Erreur lors de l\'inscription' };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();
      
      if (userError || !userData) {
        return { success: false, error: 'Aucun compte trouvé avec cet email' };
      }

      if (userData.password !== password) {
        return { success: false, error: 'Mot de passe incorrect' };
      }

      const user: User = {
        id: userData.id,
        name: userData.name,
        avatar: userData.avatar,
        phone: userData.phone,
        password: userData.password,
        location: userData.location,
        type: userData.type as UserType,
        isAdmin: userData.is_admin,
        isSuperAdmin: userData.is_super_admin,
        isPartner: userData.is_partner,
        partnerReferralCode: userData.partner_referral_code,
        email: userData.email,
        bio: userData.bio,
        rating: userData.rating,
        reviewCount: userData.review_count,
        joinedDate: userData.joined_date ? new Date(userData.joined_date) : undefined,
        premiumPaymentPending: userData.premium_payment_pending,
        premiumRequestDate: userData.premium_request_date ? new Date(userData.premium_request_date) : undefined,
        deliveryAddress: userData.delivery_address,
        deliveryCity: userData.delivery_city,
        deliveryPhone: userData.delivery_phone,
      };

      if (Platform.OS === 'web') {
        localStorage.setItem('currentUserId', userData.id);
      } else {
        await AsyncStorage.setItem('currentUserId', userData.id);
      }
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      toast.showSuccess(`Bienvenue ${user.name} !`);
      
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erreur lors de la connexion' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('currentUserId');
      } else {
        await AsyncStorage.removeItem('currentUserId');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!currentUser) return { success: false, error: 'User not logged in' };
    
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.bio !== undefined) updateData.bio = updates.bio;
      if (updates.deliveryAddress !== undefined) updateData.delivery_address = updates.deliveryAddress;
      if (updates.deliveryCity !== undefined) updateData.delivery_city = updates.deliveryCity;
      if (updates.deliveryPhone !== undefined) updateData.delivery_phone = updates.deliveryPhone;
      if (updates.isAdmin !== undefined) updateData.is_admin = updates.isAdmin;
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', currentUser.id);
      
      if (error) {
        console.error('Error updating user:', error);
        return { success: false, error: error.message };
      }
      
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [currentUser]);

  const getProductReviews = useCallback((productId: string) => {
    return reviews.filter(review => review.productId === productId);
  }, [reviews]);

  const getProductRating = useCallback((productId: string) => {
    const productReviews = reviews.filter(review => review.productId === productId);
    if (productReviews.length === 0) return { average: 0, count: 0 };
    const sum = productReviews.reduce((acc, review) => acc + review.rating, 0);
    return { average: sum / productReviews.length, count: productReviews.length };
  }, [reviews]);

  const getSellerRating = useCallback((sellerId: string) => {
    const sellerProducts = products.filter(p => p.sellerId === sellerId);
    const sellerProductIds = sellerProducts.map(p => p.id);
    const sellerReviews = reviews.filter(r => sellerProductIds.includes(r.productId));
    if (sellerReviews.length === 0) return { average: 0, count: 0 };
    const sum = sellerReviews.reduce((acc, review) => acc + review.rating, 0);
    return { average: sum / sellerReviews.length, count: sellerReviews.length };
  }, [products, reviews]);

  const addReview = useCallback((review: Omit<Review, 'id' | 'createdAt' | 'userId' | 'userName' | 'userAvatar'>) => {
    if (!currentUser) return;
    const newReview: Review = {
      ...review,
      id: `review-${Date.now()}`,
      createdAt: new Date(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
    };
    setReviews([newReview, ...reviews]);
  }, [currentUser, reviews]);

  const getProduct = useCallback((productId: string) => {
    return products.find(p => p.id === productId);
  }, [products]);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    try {
      const cachedUsers = Platform.OS === 'web' 
        ? localStorage.getItem('cached_users')
        : await AsyncStorage.getItem('cached_users');
      
      const cachedTimestamp = Platform.OS === 'web'
        ? localStorage.getItem('cached_users_timestamp')
        : await AsyncStorage.getItem('cached_users_timestamp');
      
      const now = Date.now();
      const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp, 10) : Infinity;
      const MAX_CACHE_AGE = 30 * 60 * 1000;
      
      if (cachedUsers && cacheAge < MAX_CACHE_AGE) {
        try {
          const parsed = JSON.parse(cachedUsers);
          const mappedFromCache: User[] = parsed.map((u: any) => ({
            ...u,
            joinedDate: u.joinedDate ? new Date(u.joinedDate) : undefined,
            premiumRequestDate: u.premiumRequestDate ? new Date(u.premiumRequestDate) : undefined,
          }));
          setAllUsers(mappedFromCache);
          
          if (cacheAge < 5 * 60 * 1000) {
            return;
          }
        } catch (e) {
          console.error('Error parsing cached users:', e);
        }
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading users:', error.message || error);
        throw new Error(error.message || 'Failed to load users');
      }
      
      if (data) {
        const users: User[] = data.map((u: any) => ({
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          phone: u.phone,
          password: u.password,
          location: u.location,
          type: u.type as UserType,
          isAdmin: u.is_admin,
          isSuperAdmin: u.is_super_admin,
          isPartner: u.is_partner,
          partnerReferralCode: u.partner_referral_code,
          email: u.email,
          bio: u.bio,
          rating: u.rating,
          reviewCount: u.review_count,
          joinedDate: u.joined_date ? new Date(u.joined_date) : undefined,
          premiumPaymentPending: u.premium_payment_pending,
          premiumRequestDate: u.premium_request_date ? new Date(u.premium_request_date) : undefined,
          deliveryAddress: u.delivery_address,
          deliveryCity: u.delivery_city,
          deliveryPhone: u.delivery_phone,
        }));
        setAllUsers(users);
        
        const cacheData = JSON.stringify(users);
        const timestamp = Date.now().toString();
        
        if (Platform.OS === 'web') {
          try {
            localStorage.setItem('cached_users', cacheData);
            localStorage.setItem('cached_users_timestamp', timestamp);
          } catch (e) {
            console.error('Error caching users:', e);
          }
        } else {
          try {
            await AsyncStorage.multiSet([
              ['cached_users', cacheData],
              ['cached_users_timestamp', timestamp]
            ]);
          } catch (e) {
            console.error('Error caching users:', e);
          }
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error loading users:', errorMsg);
      toast.showError('Error loading users: ' + errorMsg);
    }
  };

  const changeUserType = useCallback(async (userId: string, newType: UserType) => {
    if (!currentUser?.isAdmin) return { success: false, error: 'Non autorisé' };
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ type: newType })
        .eq('id', userId);
      
      if (error) {
        console.error('Error changing user type:', error);
        return { success: false, error: 'Erreur lors du changement de type' };
      }
      
      await loadAllUsers();
      
      if (currentUser.id === userId) {
        const updatedCurrentUser = { ...currentUser, type: newType };
        setCurrentUser(updatedCurrentUser);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error changing user type:', error);
      return { success: false, error: 'Erreur lors du changement de type' };
    }
  }, [currentUser]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!currentUser?.isAdmin && !currentUser?.isSuperAdmin) return { success: false, error: 'Non autorisé' };
    if (currentUser.id === userId) return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' };
    
    const targetUser = allUsers.find(u => u.id === userId);
    if (targetUser?.isSuperAdmin) return { success: false, error: 'Le super administrateur ne peut pas être supprimé' };
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: 'Erreur lors de la suppression' };
      }
      
      await loadAllUsers();
      await loadProducts();
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: 'Erreur lors de la suppression' };
    }
  }, [currentUser, allUsers]);

  const pendingProducts = useMemo(() => {
    return products.filter(product => product.status === 'pending');
  }, [products]);

  const approveProduct = useCallback(async (productId: string) => {
    if (!currentUser?.isAdmin) return;
    
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const { error } = await supabase
        .from('products')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id,
        })
        .eq('id', productId);

      if (error) {
        console.error('Error approving product:', error);
        return;
      }

      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, status: 'approved' as ProductStatus, approvedAt: new Date(), approvedBy: currentUser.id } 
          : p
      ));

      await notifications.sendNotification(product.sellerId, {
        type: 'product_approved',
        title: 'Annonce approuvée',
        message: `Votre annonce "${product.title}" a été approuvée et est maintenant visible pour tous les utilisateurs.`,
        data: { productId: product.id },
      });
    } catch (error) {
      console.error('Error approving product:', error);
    }
  }, [products, currentUser, notifications]);

  const toggleAdminStatus = useCallback(async (userId: string) => {
    if (!currentUser?.isSuperAdmin) return { success: false, error: 'Seul le super administrateur peut gérer les admins' };
    
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return { success: false, error: 'Utilisateur introuvable' };
    if (targetUser.isSuperAdmin) return { success: false, error: 'Le statut du super administrateur ne peut pas être modifié' };
    if (targetUser.id === currentUser.id) return { success: false, error: 'Vous ne pouvez pas modifier votre propre statut' };
    
    try {
      const newAdminStatus = !targetUser.isAdmin;
      const { error } = await supabase
        .from('users')
        .update({ is_admin: newAdminStatus })
        .eq('id', userId);
      
      if (error) {
        console.error('Error toggling admin status:', error);
        return { success: false, error: 'Erreur lors du changement de statut' };
      }
      
      await loadAllUsers();
      
      return { success: true };
    } catch (error) {
      console.error('Error toggling admin status:', error);
      return { success: false, error: 'Erreur lors du changement de statut' };
    }
  }, [currentUser, allUsers]);

  const togglePartnerStatus = useCallback(async (userId: string) => {
    if (!currentUser?.isSuperAdmin) return { success: false, error: 'Seul le super administrateur peut gérer les partenaires' };
    
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return { success: false, error: 'Utilisateur introuvable' };
    
    try {
      const newPartnerStatus = !targetUser.isPartner;
      console.log('[togglePartnerStatus] Updating user:', userId, 'New status:', newPartnerStatus);
      
      const updatePayload: any = {
        is_partner: newPartnerStatus,
        updated_at: new Date().toISOString()
      };

      if (newPartnerStatus && !targetUser.partnerReferralCode) {
        const referralCode = `PARTNER${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        updatePayload.partner_referral_code = referralCode;
        console.log('[togglePartnerStatus] Generated referral code:', referralCode);
      }
      
      const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);
      
      if (updateError) {
        console.error('[togglePartnerStatus] Error updating user:', updateError);
        return { success: false, error: updateError.message || 'Erreur lors du changement de statut' };
      }
      
      console.log('[togglePartnerStatus] User updated successfully');

      if (!newPartnerStatus) {
        console.log('[togglePartnerStatus] Deactivating discount codes');
        await supabase
          .from('discount_codes')
          .update({ is_active: false })
          .eq('partner_user_id', userId);
      }
      
      // Invalider le cache et recharger
      if (Platform.OS === 'web') {
        localStorage.removeItem('cached_users');
        localStorage.removeItem('cached_users_timestamp');
      } else {
        await AsyncStorage.removeItem('cached_users');
        await AsyncStorage.removeItem('cached_users_timestamp');
      }
      
      // Mettre à jour immédiatement les utilisateurs locaux
      setAllUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId 
            ? { 
                ...u, 
                isPartner: newPartnerStatus,
                partnerReferralCode: updatePayload.partner_referral_code || u.partnerReferralCode
              } 
            : u
        )
      );
      
      // Recharger depuis la base de données
      await loadAllUsers();
      
      if (currentUser.id === userId) {
        await loadUser();
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('[togglePartnerStatus] Exception:', error);
      return { success: false, error: error.message || 'Erreur lors du changement de statut' };
    }
  }, [currentUser, allUsers, loadUser, loadAllUsers]);

  const rejectProduct = useCallback(async (productId: string, reason?: string) => {
    if (!currentUser?.isAdmin) return;
    
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const { error } = await supabase
        .from('products')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', productId);

      if (error) {
        console.error('Error rejecting product:', error);
        return;
      }

      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, status: 'rejected' as ProductStatus, rejectedAt: new Date(), rejectionReason: reason } 
          : p
      ));

      await notifications.sendNotification(product.sellerId, {
        type: 'product_rejected',
        title: 'Annonce rejetée',
        message: `Votre annonce "${product.title}" a été rejetée. Raison: ${reason || 'Non spécifié'}`,
        data: { productId: product.id, reason: reason },
      });
    } catch (error) {
      console.error('Error rejecting product:', error);
    }
  }, [products, currentUser, notifications]);

  return useMemo(() => ({
    products,
    productsLoadError,
    loadProducts,
    filteredProducts,
    favoriteProducts,
    userProducts,
    pendingProducts,
    favorites,
    toggleFavorite,
    isFavorite,
    sellerStats,
    loadSellerStats,
    incrementProductStat,
    getProductStats,
    addProduct,
    updateProduct,
    renewProduct,
    deleteProduct,
    getProduct,
    canAddProduct,
    getMaxImages,
    upgradeToPremium,
    requestPremiumUpgrade,
    approvePremiumUpgrade,
    rejectPremiumUpgrade,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSubCategory,
    setSelectedSubCategory,
    currentUser,
    isAuthenticated,
    register,
    login,
    logout,
    updateUser,
    reviews,
    getProductReviews,
    getProductRating,
    getSellerRating,
    addReview,
    approveProduct,
    rejectProduct,
    allUsers,
    changeUserType,
    deleteUser,
    toggleAdminStatus,
    togglePartnerStatus,
  }), [
    products,
    productsLoadError,
    loadProducts,
    filteredProducts,
    favoriteProducts,
    userProducts,
    pendingProducts,
    favorites,
    toggleFavorite,
    isFavorite,
    sellerStats,
    loadSellerStats,
    incrementProductStat,
    getProductStats,
    addProduct,
    updateProduct,
    renewProduct,
    deleteProduct,
    getProduct,
    canAddProduct,
    getMaxImages,
    upgradeToPremium,
    requestPremiumUpgrade,
    approvePremiumUpgrade,
    rejectPremiumUpgrade,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSubCategory,
    setSelectedSubCategory,
    currentUser,
    isAuthenticated,
    register,
    login,
    logout,
    updateUser,
    reviews,
    getProductReviews,
    getProductRating,
    getSellerRating,
    addReview,
    approveProduct,
    rejectProduct,
    allUsers,
    changeUserType,
    deleteUser,
    toggleAdminStatus,
    togglePartnerStatus,
  ]);
});
