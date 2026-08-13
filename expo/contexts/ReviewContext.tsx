import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Review, Order } from '@/types/marketplace';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

export const [ReviewProvider, useReviews] = createContextHook(() => {
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading reviews:', error.message || error);
        throw new Error(error.message || 'Failed to load reviews');
      }

      if (data) {
        const mappedReviews: Review[] = data.map((r: any) => ({
          id: r.id,
          orderId: r.order_id,
          productId: r.product_id,
          sellerId: r.seller_id,
          userId: r.user_id,
          userName: r.user_name,
          userAvatar: r.user_avatar,
          rating: r.rating,
          comment: r.comment,
          createdAt: new Date(r.created_at),
        }));
        setReviews(mappedReviews);
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error loading reviews:', errorMsg);
      toast.showError('Erreur lors du chargement des avis');
    } finally {
      setIsLoading(false);
    }
  };

  const addReview = useCallback(async (
    orderId: string,
    productId: string,
    sellerId: string,
    userId: string,
    userName: string,
    userAvatar: string,
    rating: number,
    comment: string
  ) => {
    try {
      const newReviewData = {
        id: `review-${Date.now()}`,
        order_id: orderId,
        product_id: productId,
        seller_id: sellerId,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        rating,
        comment,
      };

      const { data, error } = await supabase
        .from('reviews')
        .insert([newReviewData])
        .select()
        .single();

      if (error) {
        console.error('Error adding review:', error);
        return null;
      }

      if (data) {
        const newReview: Review = {
          id: data.id,
          orderId: data.order_id,
          productId: data.product_id,
          sellerId: data.seller_id,
          userId: data.user_id,
          userName: data.user_name,
          userAvatar: data.user_avatar,
          rating: data.rating,
          comment: data.comment,
          createdAt: new Date(data.created_at),
        };
        
        setReviews([newReview, ...reviews]);
        
        await supabase
          .from('orders')
          .update({ has_review: true })
          .eq('id', orderId);
        
        return newReview;
      }
    } catch (error) {
      console.error('Error adding review:', error);
      return null;
    }
  }, [reviews]);

  const getReviewsForProduct = useCallback((productId: string) => {
    return reviews.filter(review => review.productId === productId);
  }, [reviews]);

  const getReviewsForSeller = useCallback((sellerId: string) => {
    return reviews.filter(review => review.sellerId === sellerId);
  }, [reviews]);

  const hasUserReviewedOrder = useCallback((orderId: string, userId: string) => {
    return reviews.some(review => review.orderId === orderId && review.userId === userId);
  }, [reviews]);

  const getProductRating = useCallback((productId: string) => {
    const productReviews = reviews.filter(review => review.productId === productId);
    if (productReviews.length === 0) return { average: 0, count: 0 };
    
    const sum = productReviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      average: sum / productReviews.length,
      count: productReviews.length,
    };
  }, [reviews]);

  const getSellerRating = useCallback((sellerId: string) => {
    const sellerReviews = reviews.filter(review => review.sellerId === sellerId);
    if (sellerReviews.length === 0) return { average: 0, count: 0 };
    
    const sum = sellerReviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      average: sum / sellerReviews.length,
      count: sellerReviews.length,
    };
  }, [reviews]);

  const canReviewOrder = useCallback((order: Order, userId: string) => {
    return (
      order.status === 'completed' &&
      order.userId === userId &&
      !hasUserReviewedOrder(order.id, userId)
    );
  }, [hasUserReviewedOrder]);

  return useMemo(() => ({
    reviews,
    isLoading,
    addReview,
    getReviewsForProduct,
    getReviewsForSeller,
    hasUserReviewedOrder,
    getProductRating,
    getSellerRating,
    canReviewOrder,
  }), [
    reviews,
    isLoading,
    addReview,
    getReviewsForProduct,
    getReviewsForSeller,
    hasUserReviewedOrder,
    getProductRating,
    getSellerRating,
    canReviewOrder,
  ]);
});
