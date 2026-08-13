import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Partner, GlobalSettings } from '@/types/marketplace';

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discountRate: number;
  isActive: boolean;
  usageLimit: number | null;
  timesUsed: number;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  createdBy: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerCommissionRate: number;
}

export interface AnnouncementBanner {
  id: string;
  message: string;
  isActive: boolean;
  priority: number;
  backgroundColor: string;
  textColor: string;
  createdAt: Date;
  createdBy: string;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface GlobalPremiumMode {
  id: string;
  isActive: boolean;
  eventName: string | null;
  eventDescription: string | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export type GlobalSettingsData = GlobalSettings;

const [GlobalSettingsContext, useGlobalSettingsContext] = createContextHook(() => {
  const [banners, setBanners] = useState<AnnouncementBanner[]>([]);
  const [globalPremiumMode, setGlobalPremiumMode] = useState<GlobalPremiumMode | null>(null);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettingsData>({
    id: 'default',
    commissionRate: 15,
    discountReduction: 5,
    partnerCommissionRate: 5,
    updatedAt: new Date(),
    updatedBy: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBanners();
    loadGlobalPremiumMode();
    loadDiscountCodes();
    loadPartners();
    loadGlobalSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBanners = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_banners');
      if (error) {
        console.error('[GlobalSettings] Error loading banners:', error.message || error);
        return;
      }
      if (data) {
        const mapped: AnnouncementBanner[] = data.map((b: any) => ({
          id: b.id,
          message: b.message,
          isActive: true,
          priority: b.priority,
          backgroundColor: b.background_color,
          textColor: b.text_color,
          createdAt: new Date(),
          createdBy: '',
          validFrom: null,
          validUntil: null,
        }));
        setBanners(mapped);
      }
    } catch (error: any) {
      console.error('[GlobalSettings] Error loading banners:', error.message || error);
    }
  }, []);

  const loadGlobalPremiumMode = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('global_premium_mode')
        .select('*')
        .eq('is_active', true)
        .gte('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[GlobalSettings] Error loading global premium mode:', error);
        setGlobalPremiumMode(null);
        return;
      }
      
      if (data) {
        const mapped: GlobalPremiumMode = {
          id: data.id,
          isActive: data.is_active,
          eventName: data.event_name,
          eventDescription: data.event_description,
          startsAt: new Date(data.starts_at),
          endsAt: new Date(data.ends_at),
          createdAt: new Date(data.created_at),
          createdBy: data.created_by,
          updatedAt: new Date(data.updated_at),
        };
        setGlobalPremiumMode(mapped);
      } else {
        setGlobalPremiumMode(null);
      }
    } catch (error) {
      console.error('[GlobalSettings] Error loading global premium mode:', error);
      setGlobalPremiumMode(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDiscountCodes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[GlobalSettings] Error loading discount codes:', error);
        return;
      }
      
      if (data) {
        const mapped: DiscountCode[] = data.map((d: any) => ({
          id: d.id,
          code: d.code,
          description: d.description,
          discountRate: d.discount_rate,
          isActive: d.is_active,
          usageLimit: d.usage_limit,
          timesUsed: d.times_used,
          validFrom: d.valid_from ? new Date(d.valid_from) : null,
          validUntil: d.valid_until ? new Date(d.valid_until) : null,
          createdAt: new Date(d.created_at),
          createdBy: d.created_by,
          partnerId: d.partner_user_id,
          partnerName: null,
          partnerCommissionRate: 5,
        }));
        setDiscountCodes(mapped);
      }
    } catch (error) {
      console.error('[GlobalSettings] Error loading discount codes:', error);
    }
  }, []);

  const loadPartners = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_user_partners');
      
      if (error) {
        console.error('Error loading partners:', error.message || error);
        return;
      }
      
      if (data) {
        const mapped: Partner[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          avatar: p.avatar,
          bio: p.bio,
          partnerReferralCode: p.partner_referral_code,
          totalCommissionEarned: parseFloat(p.total_commission_earned) || 0,
          totalSales: p.total_sales || 0,
          totalReferrals: p.total_referrals || 0,
          isActive: true,
          createdAt: new Date(p.created_at),
          createdBy: '',
          updatedAt: new Date(p.created_at),
        }));
        setPartners(mapped);
      }
    } catch (error: any) {
      console.error('Error loading partners:', error.message || error);
    }
  }, []);

  const loadGlobalSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[GlobalSettings] Error loading global settings:', error.message || error);
        console.log('[GlobalSettings] Keeping default values');
        return;
      }
      
      if (data) {
        const mapped: GlobalSettingsData = {
          id: data.id,
          commissionRate: parseFloat(data.commission_rate),
          discountReduction: parseFloat(data.discount_reduction),
          partnerCommissionRate: parseFloat(data.partner_commission_rate),
          updatedAt: new Date(data.updated_at),
          updatedBy: data.updated_by,
        };
        setGlobalSettings(mapped);
      }
    } catch (error: any) {
      console.error('[GlobalSettings] Error loading global settings:', error.message || error);
    }
  }, []);

  const createDiscountCode = useCallback(async (
    code: string,
    description: string | null,
    discountRate: number,
    usageLimit: number | null,
    validFrom: Date | null,
    validUntil: Date | null,
    createdBy: string,
    partnerUserId: string | null = null
  ) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .insert([{
          id: `discount-${Date.now()}`,
          code: code.toUpperCase(),
          description,
          discount_rate: discountRate,
          is_active: true,
          usage_limit: usageLimit,
          times_used: 0,
          valid_from: validFrom?.toISOString(),
          valid_until: validUntil?.toISOString(),
          created_by: createdBy,
          partner_user_id: partnerUserId,
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating discount code:', error);
        return { success: false, error: error.message };
      }
      
      await loadDiscountCodes();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating discount code:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadDiscountCodes]);

  const deleteDiscountCode = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting discount code:', error);
        return { success: false, error: error.message };
      }
      
      await loadDiscountCodes();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting discount code:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadDiscountCodes]);

  const createBanner = useCallback(async (
    message: string,
    backgroundColor: string,
    textColor: string,
    priority: number,
    validFrom: Date | null,
    validUntil: Date | null,
    createdBy: string
  ) => {
    try {
      const { error } = await supabase
        .from('announcement_banners')
        .insert([{
          id: `banner-${Date.now()}`,
          message,
          is_active: true,
          priority,
          background_color: backgroundColor,
          text_color: textColor,
          valid_from: validFrom?.toISOString(),
          valid_until: validUntil?.toISOString(),
          created_by: createdBy,
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating banner:', error);
        return { success: false, error: error.message };
      }
      
      await loadBanners();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating banner:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadBanners]);

  const deleteBanner = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('announcement_banners')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting banner:', error);
        return { success: false, error: error.message };
      }
      
      await loadBanners();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting banner:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadBanners]);

  const createGlobalPremiumMode = useCallback(async (
    eventName: string,
    eventDescription: string | null,
    startsAt: Date,
    endsAt: Date,
    createdBy: string
  ) => {
    try {
      await supabase
        .from('global_premium_mode')
        .update({ is_active: false })
        .eq('is_active', true);
      
      const { error } = await supabase
        .from('global_premium_mode')
        .insert([{
          id: `global-premium-${Date.now()}`,
          is_active: true,
          event_name: eventName,
          event_description: eventDescription,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          created_by: createdBy,
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating global premium mode:', error);
        return { success: false, error: error.message };
      }
      
      await loadGlobalPremiumMode();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating global premium mode:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadGlobalPremiumMode]);

  const disableGlobalPremiumMode = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('global_premium_mode')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) {
        console.error('Error disabling global premium mode:', error);
        return { success: false, error: error.message };
      }
      
      await loadGlobalPremiumMode();
      return { success: true };
    } catch (error: any) {
      console.error('Error disabling global premium mode:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadGlobalPremiumMode]);

  const createPartner = useCallback(async (
    userId: string
  ) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_partner: true })
        .eq('id', userId);
      
      if (error) {
        console.error('Error creating partner:', error);
        return { success: false, error: error.message };
      }
      
      await loadPartners();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating partner:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadPartners]);

  const deletePartner = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_partner: false })
        .eq('id', userId);
      
      if (error) {
        console.error('Error deleting partner:', error);
        return { success: false, error: error.message };
      }
      
      await loadPartners();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting partner:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadPartners]);

  const updateGlobalSettings = useCallback(async (
    commissionRate: number,
    discountReduction: number,
    partnerCommissionRate: number,
    updatedBy: string
  ) => {
    try {
      const { error } = await supabase
        .from('global_settings')
        .update({
          commission_rate: commissionRate,
          discount_reduction: discountReduction,
          partner_commission_rate: partnerCommissionRate,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        })
        .eq('id', 'default');
      
      if (error) {
        console.error('Error updating global settings:', error);
        return { success: false, error: error.message };
      }
      
      await loadGlobalSettings();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating global settings:', error);
      return { success: false, error: error.message || String(error) };
    }
  }, [loadGlobalSettings]);

  return {
    banners,
    globalPremiumMode,
    discountCodes,
    partners,
    globalSettings,
    isLoading,
    loadBanners,
    loadGlobalPremiumMode,
    loadDiscountCodes,
    loadPartners,
    loadGlobalSettings,
    createDiscountCode,
    deleteDiscountCode,
    createBanner,
    deleteBanner,
    createGlobalPremiumMode,
    disableGlobalPremiumMode,
    createPartner,
    deletePartner,
    updateGlobalSettings,
  };
});

export const GlobalSettingsProvider = GlobalSettingsContext;

export function useGlobalSettings() {
  const context = useGlobalSettingsContext();
  return context;
}
