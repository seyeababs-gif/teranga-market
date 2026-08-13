import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Partner } from '@/types/marketplace';

export const [PartnersProvider, usePartners] = createContextHook(() => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPartners = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_active_user_partners');

      if (error) {
        console.error('[PartnersContext] Error loading partners:', error.message);
        return;
      }

      if (data) {
        const mappedPartners: Partner[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          avatar: p.avatar,
          bio: p.bio,
          partnerReferralCode: p.partner_referral_code,
          totalCommissionEarned: parseFloat(p.total_commission_earned || '0'),
          totalSales: parseInt(p.total_sales || '0'),
          isActive: true,
          createdAt: new Date(p.created_at),
          createdBy: '',
          updatedAt: new Date(),
        }));
        setPartners(mappedPartners);
      }
    } catch (error: any) {
      console.error('[PartnersContext] Error loading partners:', error?.message || String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPartnerStats = useCallback(async (partnerId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_partner_stats', {
        partner_user_id: partnerId,
      });

      if (error) {
        console.error('Error getting partner stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting partner stats:', error);
      return null;
    }
  }, []);

  const getReferredUsers = useCallback(async (partnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, email, avatar, location, type, created_at')
        .eq('referred_by_partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting referred users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting referred users:', error);
      return [];
    }
  }, []);

  const getPartnerDiscountCodes = useCallback(async (partnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('partner_user_id', partnerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting partner discount codes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting partner discount codes:', error);
      return [];
    }
  }, []);

  const createPartnerCode = useCallback(async (
    partnerId: string,
    code: string,
    description?: string,
    createdBy?: string
  ) => {
    try {
      const { data: settingsData } = await supabase
        .from('global_settings')
        .select('discount_reduction')
        .single();

      const discountReduction = settingsData?.discount_reduction || 5;

      const { data, error } = await supabase
        .from('discount_codes')
        .insert([
          {
            code: code.toUpperCase(),
            description: description || null,
            discount_percent: discountReduction,
            partner_user_id: partnerId,
            is_active: true,
            created_by: createdBy || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating partner code:', error);
        return { success: false, error: error.message };
      }

      await loadPartners();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating partner code:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadPartners]);

  const togglePartnerActive = useCallback(async (partnerId: string, newStatus: boolean) => {
    try {
      console.log('[PartnersContext] Toggling partner status for:', partnerId, 'to:', newStatus);
      
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('id, is_partner, name')
        .eq('id', partnerId)
        .single();

      if (fetchError || !userData) {
        console.error('[PartnersContext] User not found:', fetchError);
        return { success: false, error: 'Utilisateur introuvable' };
      }

      console.log('[PartnersContext] Current user data:', userData);

      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          is_partner: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', partnerId);

      if (updateError) {
        console.error('[PartnersContext] Error updating partner status:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('[PartnersContext] Partner status updated successfully');

      if (!newStatus) {
        console.log('[PartnersContext] Deactivating all discount codes for partner');
        await supabase
          .from('discount_codes')
          .update({ is_active: false })
          .eq('partner_user_id', partnerId);
      }

      await loadPartners();
      return { success: true };
    } catch (error: any) {
      console.error('[PartnersContext] Exception:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadPartners]);

  const getCodeUsages = useCallback(async (codeId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, seller_id, seller_name, seller_avatar, seller_phone, created_at')
        .eq('discount_code', codeId)
        .eq('discount_code_applied', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting code usages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting code usages:', error);
      return [];
    }
  }, []);

  const deactivateDiscountCode = useCallback(async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) {
        console.error('Error deactivating discount code:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error deactivating discount code:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, []);

  const updatePartnerCode = useCallback(async (partnerId: string, newCode: string) => {
    try {
      const { data, error } = await supabase.rpc('update_partner_referral_code', {
        partner_user_id: partnerId,
        new_code: newCode.toUpperCase(),
      });

      if (error) {
        console.error('Error updating partner code:', error);
        return { success: false, error: error.message };
      }

      if (data && data.length > 0) {
        const result = data[0];
        if (!result.success) {
          return { success: false, error: result.message };
        }
      }

      await loadPartners();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating partner code:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadPartners]);

  const getReferredClients = useCallback(async (partnerId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_partner_referred_clients', {
        partner_user_id: partnerId,
      });

      if (error) {
        console.error('Error getting referred clients:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting referred clients:', error);
      return [];
    }
  }, []);

  const getClientDetails = useCallback(async (partnerId: string, clientSellerId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_partner_client_details', {
        partner_user_id: partnerId,
        client_seller_id: clientSellerId,
      });

      if (error) {
        console.error('Error getting client details:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting client details:', error);
      return [];
    }
  }, []);

  return {
    partners,
    isLoading,
    loadPartners,
    getPartnerStats,
    getReferredUsers,
    getPartnerDiscountCodes,
    createPartnerCode,
    togglePartnerActive,
    getCodeUsages,
    deactivateDiscountCode,
    updatePartnerCode,
    getReferredClients,
    getClientDetails,
  };
});
