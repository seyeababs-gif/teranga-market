export type Category = 
  | 'vetements_homme' 
  | 'vetements_femme' 
  | 'vetements_enfant' 
  | 'chaussures' 
  | 'sacs_bagages' 
  | 'accessoires' 
  | 'traditionnel'
  | 'tissu_couture'
  | 'bijoux_artisanat'
  | 'cosmetique_beaute'
  | 'electronique'
  | 'maison_deco'
  | 'sport_loisirs'
  | 'bebe_puericulture'
  | 'livres_culture'
  | 'nourriture'
  | 'covoiturage'
  | 'autres' 
  | 'all';

export type SubCategory = 
  // Vêtements Homme
  | 'chemises_homme'
  | 'pantalons_homme'
  | 'tshirts_homme'
  | 'jeans_homme'
  | 'costumes_homme'
  | 'vestes_homme'
  | 'shorts_homme'
  | 'maillots_homme'
  | 'autres_homme'
  // Vêtements Femme
  | 'robes'
  | 'jupes'
  | 'hauts_femme'
  | 'pantalons_femme'
  | 'jeans_femme'
  | 'vestes_femme'
  | 'ensembles_femme'
  | 'lingerie'
  | 'maillots_femme'
  | 'autres_femme'
  // Vêtements Enfant
  | 'garcon'
  | 'fille'
  | 'bebe'
  | 'ados'
  | 'autres_enfant'
  // Chaussures
  | 'baskets'
  | 'chaussures_ville'
  | 'sandales'
  | 'talons'
  | 'bottes'
  | 'tongs'
  | 'mocassins'
  | 'chaussures_enfant'
  | 'autres_chaussures'
  // Sacs & Bagages
  | 'sacs_main'
  | 'sacs_dos'
  | 'valises'
  | 'pochettes'
  | 'sacs_voyage'
  | 'porte_documents'
  | 'autres_sacs'
  // Accessoires
  | 'bijoux'
  | 'montres'
  | 'ceintures'
  | 'echarpes'
  | 'lunettes'
  | 'chapeaux'
  | 'foulards'
  | 'gants'
  | 'autres_accessoires'
  // Traditionnel
  | 'boubou'
  | 'kaftan'
  | 'bazin'
  | 'tissu_wax'
  | 'gandoura'
  | 'dashiki'
  | 'kente'
  | 'kitenge'
  | 'pagne'
  | 'autres_traditionnel'
  // Tissu & Couture
  | 'tissus_wax'
  | 'tissus_basin'
  | 'tissus_soie'
  | 'tissus_coton'
  | 'dentelle'
  | 'accessoires_couture'
  | 'autres_tissu'
  // Bijoux & Artisanat
  | 'colliers'
  | 'bracelets'
  | 'boucles_oreilles'
  | 'bagues'
  | 'perles_africaines'
  | 'bronze_dore'
  | 'sculpture_bois'
  | 'poterie'
  | 'masques'
  | 'paniers_vannerie'
  | 'autres_bijoux_artisanat'
  // Cosmétique & Beauté
  | 'maquillage'
  | 'soins_visage'
  | 'soins_corps'
  | 'soins_cheveux'
  | 'parfums'
  | 'huiles_naturelles'
  | 'beurre_karite'
  | 'savon_noir'
  | 'henne'
  | 'produits_capillaires'
  | 'autres_cosmetique'
  // Électronique
  | 'telephones'
  | 'tablettes'
  | 'ordinateurs'
  | 'accessoires_tel'
  | 'ecouteurs'
  | 'chargeurs'
  | 'consoles_jeux'
  | 'tv_audio'
  | 'autres_electronique'
  // Maison & Déco
  | 'meubles'
  | 'decoration'
  | 'tapis_nattes'
  | 'rideaux'
  | 'luminaires'
  | 'vaisselle'
  | 'linge_maison'
  | 'objets_deco_africains'
  | 'autres_maison'
  // Sport & Loisirs
  | 'vetements_sport'
  | 'chaussures_sport'
  | 'equipements_sport'
  | 'velos'
  | 'camping'
  | 'instruments_musique'
  | 'jeux_jouets'
  | 'autres_sport'
  // Bébé & Puériculture
  | 'vetements_bebe'
  | 'chaussures_bebe'
  | 'poussettes'
  | 'sieges_auto'
  | 'jouets_eveil'
  | 'alimentation_bebe'
  | 'hygiene_bebe'
  | 'autres_bebe'
  // Livres & Culture
  | 'livres'
  | 'magazines'
  | 'bd_mangas'
  | 'dvd_films'
  | 'cd_musique'
  | 'vinyles'
  | 'autres_livres'
  // Nourriture
  | 'plats_prepares'
  | 'epices'
  | 'friandises'
  | 'boissons'
  | 'produits_frais'
  | 'autres_nourriture'
  // Covoiturage & GP
  | 'trajet_unique'
  | 'trajet_regulier'
  | 'gp_colisage'
  | 'autres_covoiturage'
  // Autres
  | 'autres'
  | 'all';

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export type ListingType = 'product' | 'service';

/** A product can be listed for sale or as a free donation/gift. */
export type SaleType = 'sale' | 'donation';

export interface ServiceDetails {
  departureLocation?: string;
  arrivalLocation?: string;
  departureDate?: string;
  arrivalDate?: string;
  pricePerKg?: number;
  tripPrice?: number;
  vehicleType?: string;
  availableSeats?: number;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: Category;
  subCategory?: SubCategory;
  location: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerPhone: string;
  createdAt: Date;
  condition?: 'new' | 'used' | 'refurbished';
  status: ProductStatus;
  rejectionReason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: string;
  averageRating?: number;
  reviewCount?: number;
  listingType?: ListingType;
  serviceDetails?: ServiceDetails;
  stockQuantity?: number;
  isOutOfStock?: boolean;
  hasDiscount?: boolean;
  discountPercent?: number;
  originalPrice?: number;
  size?: string;
  brand?: string;
  color?: string;
  material?: string;
  commissionAmount?: number;
  /** Whether this product is a free donation (price = 0) or a regular sale. */
  isDonation?: boolean;
  saleType?: SaleType;
}

export type UserType = 'standard' | 'premium';

export interface User {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  password?: string;
  location: string;
  type: UserType;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isPartner?: boolean;
  partnerReferralCode?: string;
  referredByPartnerId?: string;
  email?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  joinedDate?: Date;
  premiumPaymentPending?: boolean;
  premiumRequestDate?: Date;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPhone?: string;
}

export interface Message {
  id: string;
  productId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  productId: string;
  product: Product;
  otherUser: User;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface SellerRating {
  sellerId: string;
  averageRating: number;
  totalReviews: number;
}

export type OrderStatus = 'pending' | 'validated' | 'rejected' | 'shipped' | 'completed';

export interface OrderItem {
  product: Product;
  quantity: number;
  priceAtPurchase: number;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  validatedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  shippedAt?: Date;
  completedAt?: Date;
  hasReview?: boolean;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
}

export type NotificationType = 
  | 'product_published'
  | 'product_approved'
  | 'product_rejected'
  | 'order_validated'
  | 'order_rejected'
  | 'order_shipped'
  | 'order_completed'
  | 'partner_code_used'
  | 'partner_commission_paid';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  bio: string | null;
  partnerReferralCode: string | null;
  totalCommissionEarned: number;
  totalSales: number;
  totalReferrals?: number;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface GlobalSettings {
  id: string;
  commissionRate: number;
  discountReduction: number;
  partnerCommissionRate: number;
  updatedAt: Date;
  updatedBy: string | null;
}
