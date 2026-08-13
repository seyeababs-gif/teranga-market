import { Category, SubCategory } from '@/types/marketplace';

export interface SubCategoryInfo {
  id: SubCategory;
  name: string;
  icon: string;
  parentCategory: Category;
}

export interface CategoryInfo {
  id: Category;
  name: string;
  icon: string;
  color: string;
  gradient: [string, string];
  subCategories?: SubCategoryInfo[];
}

export const subCategories: SubCategoryInfo[] = [
  { id: 'chemises_homme', name: 'Chemises', icon: '👔', parentCategory: 'vetements_homme' },
  { id: 'pantalons_homme', name: 'Pantalons', icon: '👖', parentCategory: 'vetements_homme' },
  { id: 'tshirts_homme', name: 'T-shirts', icon: '👕', parentCategory: 'vetements_homme' },
  { id: 'jeans_homme', name: 'Jeans', icon: '👖', parentCategory: 'vetements_homme' },
  { id: 'costumes_homme', name: 'Costumes', icon: '🤵', parentCategory: 'vetements_homme' },
  { id: 'vestes_homme', name: 'Vestes', icon: '🧥', parentCategory: 'vetements_homme' },
  { id: 'shorts_homme', name: 'Shorts', icon: '🩳', parentCategory: 'vetements_homme' },
  { id: 'maillots_homme', name: 'Maillots de bain', icon: '🩱', parentCategory: 'vetements_homme' },
  { id: 'autres_homme', name: 'Autres', icon: '✨', parentCategory: 'vetements_homme' },

  { id: 'robes', name: 'Robes', icon: '👗', parentCategory: 'vetements_femme' },
  { id: 'jupes', name: 'Jupes', icon: '👗', parentCategory: 'vetements_femme' },
  { id: 'hauts_femme', name: 'Hauts', icon: '👚', parentCategory: 'vetements_femme' },
  { id: 'pantalons_femme', name: 'Pantalons', icon: '👖', parentCategory: 'vetements_femme' },
  { id: 'jeans_femme', name: 'Jeans', icon: '👖', parentCategory: 'vetements_femme' },
  { id: 'vestes_femme', name: 'Vestes', icon: '🧥', parentCategory: 'vetements_femme' },
  { id: 'ensembles_femme', name: 'Ensembles', icon: '👗', parentCategory: 'vetements_femme' },
  { id: 'lingerie', name: 'Lingerie', icon: '👙', parentCategory: 'vetements_femme' },
  { id: 'maillots_femme', name: 'Maillots de bain', icon: '👙', parentCategory: 'vetements_femme' },
  { id: 'autres_femme', name: 'Autres', icon: '✨', parentCategory: 'vetements_femme' },

  { id: 'garcon', name: 'Garçon', icon: '👦', parentCategory: 'vetements_enfant' },
  { id: 'fille', name: 'Fille', icon: '👧', parentCategory: 'vetements_enfant' },
  { id: 'bebe', name: 'Bébé', icon: '👶', parentCategory: 'vetements_enfant' },
  { id: 'ados', name: 'Ados', icon: '🧒', parentCategory: 'vetements_enfant' },
  { id: 'autres_enfant', name: 'Autres', icon: '✨', parentCategory: 'vetements_enfant' },

  { id: 'baskets', name: 'Baskets', icon: '👟', parentCategory: 'chaussures' },
  { id: 'chaussures_ville', name: 'Chaussures de ville', icon: '👞', parentCategory: 'chaussures' },
  { id: 'sandales', name: 'Sandales', icon: '🩴', parentCategory: 'chaussures' },
  { id: 'talons', name: 'Talons', icon: '👠', parentCategory: 'chaussures' },
  { id: 'bottes', name: 'Bottes', icon: '🥾', parentCategory: 'chaussures' },
  { id: 'tongs', name: 'Tongs', icon: '🩴', parentCategory: 'chaussures' },
  { id: 'mocassins', name: 'Mocassins', icon: '👞', parentCategory: 'chaussures' },
  { id: 'chaussures_enfant', name: 'Enfant', icon: '👟', parentCategory: 'chaussures' },
  { id: 'autres_chaussures', name: 'Autres', icon: '✨', parentCategory: 'chaussures' },

  { id: 'sacs_main', name: 'Sacs à main', icon: '👜', parentCategory: 'sacs_bagages' },
  { id: 'sacs_dos', name: 'Sacs à dos', icon: '🎒', parentCategory: 'sacs_bagages' },
  { id: 'valises', name: 'Valises', icon: '🧳', parentCategory: 'sacs_bagages' },
  { id: 'pochettes', name: 'Pochettes', icon: '👛', parentCategory: 'sacs_bagages' },
  { id: 'sacs_voyage', name: 'Sacs de voyage', icon: '🛄', parentCategory: 'sacs_bagages' },
  { id: 'porte_documents', name: 'Porte-documents', icon: '💼', parentCategory: 'sacs_bagages' },
  { id: 'autres_sacs', name: 'Autres', icon: '✨', parentCategory: 'sacs_bagages' },

  { id: 'bijoux', name: 'Bijoux', icon: '💍', parentCategory: 'accessoires' },
  { id: 'montres', name: 'Montres', icon: '⌚', parentCategory: 'accessoires' },
  { id: 'ceintures', name: 'Ceintures', icon: '👔', parentCategory: 'accessoires' },
  { id: 'echarpes', name: 'Écharpes', icon: '🧣', parentCategory: 'accessoires' },
  { id: 'lunettes', name: 'Lunettes', icon: '🕶️', parentCategory: 'accessoires' },
  { id: 'chapeaux', name: 'Chapeaux', icon: '👒', parentCategory: 'accessoires' },
  { id: 'foulards', name: 'Foulards', icon: '🧕', parentCategory: 'accessoires' },
  { id: 'gants', name: 'Gants', icon: '🧤', parentCategory: 'accessoires' },
  { id: 'autres_accessoires', name: 'Autres', icon: '✨', parentCategory: 'accessoires' },

  { id: 'boubou', name: 'Boubou', icon: '👘', parentCategory: 'traditionnel' },
  { id: 'kaftan', name: 'Kaftan', icon: '👘', parentCategory: 'traditionnel' },
  { id: 'bazin', name: 'Bazin', icon: '🎽', parentCategory: 'traditionnel' },
  { id: 'tissu_wax', name: 'Tissu Wax', icon: '🧵', parentCategory: 'traditionnel' },
  { id: 'gandoura', name: 'Gandoura', icon: '👘', parentCategory: 'traditionnel' },
  { id: 'dashiki', name: 'Dashiki', icon: '👕', parentCategory: 'traditionnel' },
  { id: 'kente', name: 'Kente', icon: '🎨', parentCategory: 'traditionnel' },
  { id: 'kitenge', name: 'Kitenge', icon: '🎨', parentCategory: 'traditionnel' },
  { id: 'pagne', name: 'Pagne', icon: '🧵', parentCategory: 'traditionnel' },
  { id: 'autres_traditionnel', name: 'Autres', icon: '✨', parentCategory: 'traditionnel' },

  { id: 'tissus_wax', name: 'Tissus Wax', icon: '🧵', parentCategory: 'tissu_couture' },
  { id: 'tissus_basin', name: 'Tissus Basin', icon: '🧵', parentCategory: 'tissu_couture' },
  { id: 'tissus_soie', name: 'Soie', icon: '🧵', parentCategory: 'tissu_couture' },
  { id: 'tissus_coton', name: 'Coton', icon: '🧵', parentCategory: 'tissu_couture' },
  { id: 'dentelle', name: 'Dentelle', icon: '🧵', parentCategory: 'tissu_couture' },
  { id: 'accessoires_couture', name: 'Accessoires couture', icon: '🪡', parentCategory: 'tissu_couture' },
  { id: 'autres_tissu', name: 'Autres', icon: '✨', parentCategory: 'tissu_couture' },

  { id: 'colliers', name: 'Colliers', icon: '📿', parentCategory: 'bijoux_artisanat' },
  { id: 'bracelets', name: 'Bracelets', icon: '💍', parentCategory: 'bijoux_artisanat' },
  { id: 'boucles_oreilles', name: "Boucles d'oreilles", icon: '💎', parentCategory: 'bijoux_artisanat' },
  { id: 'bagues', name: 'Bagues', icon: '💍', parentCategory: 'bijoux_artisanat' },
  { id: 'perles_africaines', name: 'Perles africaines', icon: '📿', parentCategory: 'bijoux_artisanat' },
  { id: 'bronze_dore', name: 'Bronze doré', icon: '🔶', parentCategory: 'bijoux_artisanat' },
  { id: 'sculpture_bois', name: 'Sculpture bois', icon: '🗿', parentCategory: 'bijoux_artisanat' },
  { id: 'poterie', name: 'Poterie', icon: '🏺', parentCategory: 'bijoux_artisanat' },
  { id: 'masques', name: 'Masques', icon: '🎭', parentCategory: 'bijoux_artisanat' },
  { id: 'paniers_vannerie', name: 'Paniers', icon: '🧺', parentCategory: 'bijoux_artisanat' },
  { id: 'autres_bijoux_artisanat', name: 'Autres', icon: '✨', parentCategory: 'bijoux_artisanat' },

  { id: 'maquillage', name: 'Maquillage', icon: '💄', parentCategory: 'cosmetique_beaute' },
  { id: 'soins_visage', name: 'Soins visage', icon: '🧴', parentCategory: 'cosmetique_beaute' },
  { id: 'soins_corps', name: 'Soins corps', icon: '🧴', parentCategory: 'cosmetique_beaute' },
  { id: 'soins_cheveux', name: 'Soins cheveux', icon: '💇', parentCategory: 'cosmetique_beaute' },
  { id: 'parfums', name: 'Parfums', icon: '🧴', parentCategory: 'cosmetique_beaute' },
  { id: 'huiles_naturelles', name: 'Huiles naturelles', icon: '🫒', parentCategory: 'cosmetique_beaute' },
  { id: 'beurre_karite', name: 'Beurre de karité', icon: '🥥', parentCategory: 'cosmetique_beaute' },
  { id: 'savon_noir', name: 'Savon noir', icon: '🧼', parentCategory: 'cosmetique_beaute' },
  { id: 'henne', name: 'Henné', icon: '🌿', parentCategory: 'cosmetique_beaute' },
  { id: 'produits_capillaires', name: 'Produits capillaires', icon: '💆', parentCategory: 'cosmetique_beaute' },
  { id: 'autres_cosmetique', name: 'Autres', icon: '✨', parentCategory: 'cosmetique_beaute' },

  { id: 'telephones', name: 'Téléphones', icon: '📱', parentCategory: 'electronique' },
  { id: 'tablettes', name: 'Tablettes', icon: '📱', parentCategory: 'electronique' },
  { id: 'ordinateurs', name: 'Ordinateurs', icon: '💻', parentCategory: 'electronique' },
  { id: 'accessoires_tel', name: 'Accessoires téléphone', icon: '🔌', parentCategory: 'electronique' },
  { id: 'ecouteurs', name: 'Écouteurs', icon: '🎧', parentCategory: 'electronique' },
  { id: 'chargeurs', name: 'Chargeurs', icon: '🔌', parentCategory: 'electronique' },
  { id: 'consoles_jeux', name: 'Consoles de jeux', icon: '🎮', parentCategory: 'electronique' },
  { id: 'tv_audio', name: 'TV & Audio', icon: '📺', parentCategory: 'electronique' },
  { id: 'autres_electronique', name: 'Autres', icon: '✨', parentCategory: 'electronique' },

  { id: 'meubles', name: 'Meubles', icon: '🛋️', parentCategory: 'maison_deco' },
  { id: 'decoration', name: 'Décoration', icon: '🖼️', parentCategory: 'maison_deco' },
  { id: 'tapis_nattes', name: 'Tapis & Nattes', icon: '🧶', parentCategory: 'maison_deco' },
  { id: 'rideaux', name: 'Rideaux', icon: '🪟', parentCategory: 'maison_deco' },
  { id: 'luminaires', name: 'Luminaires', icon: '💡', parentCategory: 'maison_deco' },
  { id: 'vaisselle', name: 'Vaisselle', icon: '🍽️', parentCategory: 'maison_deco' },
  { id: 'linge_maison', name: 'Linge de maison', icon: '🛏️', parentCategory: 'maison_deco' },
  { id: 'objets_deco_africains', name: 'Objets déco africains', icon: '🗿', parentCategory: 'maison_deco' },
  { id: 'autres_maison', name: 'Autres', icon: '✨', parentCategory: 'maison_deco' },

  { id: 'vetements_sport', name: 'Vêtements sport', icon: '👕', parentCategory: 'sport_loisirs' },
  { id: 'chaussures_sport', name: 'Chaussures sport', icon: '👟', parentCategory: 'sport_loisirs' },
  { id: 'equipements_sport', name: 'Équipements sport', icon: '⚽', parentCategory: 'sport_loisirs' },
  { id: 'velos', name: 'Vélos', icon: '🚴', parentCategory: 'sport_loisirs' },
  { id: 'camping', name: 'Camping', icon: '⛺', parentCategory: 'sport_loisirs' },
  { id: 'instruments_musique', name: 'Instruments musique', icon: '🥁', parentCategory: 'sport_loisirs' },
  { id: 'jeux_jouets', name: 'Jeux & Jouets', icon: '🧸', parentCategory: 'sport_loisirs' },
  { id: 'autres_sport', name: 'Autres', icon: '✨', parentCategory: 'sport_loisirs' },

  { id: 'vetements_bebe', name: 'Vêtements bébé', icon: '👶', parentCategory: 'bebe_puericulture' },
  { id: 'chaussures_bebe', name: 'Chaussures bébé', icon: '👶', parentCategory: 'bebe_puericulture' },
  { id: 'poussettes', name: 'Poussettes', icon: '🍼', parentCategory: 'bebe_puericulture' },
  { id: 'sieges_auto', name: 'Sièges auto', icon: '🚗', parentCategory: 'bebe_puericulture' },
  { id: 'jouets_eveil', name: "Jouets d'éveil", icon: '🧸', parentCategory: 'bebe_puericulture' },
  { id: 'alimentation_bebe', name: 'Alimentation bébé', icon: '🍼', parentCategory: 'bebe_puericulture' },
  { id: 'hygiene_bebe', name: 'Hygiène bébé', icon: '🧴', parentCategory: 'bebe_puericulture' },
  { id: 'autres_bebe', name: 'Autres', icon: '✨', parentCategory: 'bebe_puericulture' },

  { id: 'livres', name: 'Livres', icon: '📚', parentCategory: 'livres_culture' },
  { id: 'magazines', name: 'Magazines', icon: '📰', parentCategory: 'livres_culture' },
  { id: 'bd_mangas', name: 'BD & Mangas', icon: '📖', parentCategory: 'livres_culture' },
  { id: 'dvd_films', name: 'DVD & Films', icon: '📀', parentCategory: 'livres_culture' },
  { id: 'cd_musique', name: 'CD Musique', icon: '💿', parentCategory: 'livres_culture' },
  { id: 'vinyles', name: 'Vinyles', icon: '💿', parentCategory: 'livres_culture' },
  { id: 'autres_livres', name: 'Autres', icon: '✨', parentCategory: 'livres_culture' },

  { id: 'autres', name: 'Autres', icon: '✨', parentCategory: 'autres' },

  { id: 'plats_prepares', name: 'Plats préparés', icon: '🍛', parentCategory: 'nourriture' },
  { id: 'epices', name: 'Épices', icon: '🌶️', parentCategory: 'nourriture' },
  { id: 'friandises', name: 'Friandises', icon: '🍬', parentCategory: 'nourriture' },
  { id: 'boissons', name: 'Boissons', icon: '🥤', parentCategory: 'nourriture' },
  { id: 'produits_frais', name: 'Produits frais', icon: '🥬', parentCategory: 'nourriture' },
  { id: 'autres_nourriture', name: 'Autres', icon: '✨', parentCategory: 'nourriture' },

  { id: 'trajet_unique', name: 'Trajet unique', icon: '🚗', parentCategory: 'covoiturage' },
  { id: 'trajet_regulier', name: 'Trajet régulier', icon: '🚙', parentCategory: 'covoiturage' },
  { id: 'gp_colisage', name: 'GP / Colisage', icon: '📦', parentCategory: 'covoiturage' },
  { id: 'autres_covoiturage', name: 'Autres', icon: '✨', parentCategory: 'covoiturage' },
];

export const categories: CategoryInfo[] = [
  {
    id: 'all',
    name: 'Tout',
    icon: '🌍',
    color: '#FF6B35',
    gradient: ['#FF6B35', '#E63946'],
  },
  {
    id: 'vetements_homme',
    name: 'Homme',
    icon: '👔',
    color: '#264653',
    gradient: ['#264653', '#2A9D8F'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'vetements_homme'),
  },
  {
    id: 'vetements_femme',
    name: 'Femme',
    icon: '👗',
    color: '#E63946',
    gradient: ['#E63946', '#FF6B35'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'vetements_femme'),
  },
  {
    id: 'vetements_enfant',
    name: 'Enfant',
    icon: '👶',
    color: '#FFB703',
    gradient: ['#FFB703', '#F4A460'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'vetements_enfant'),
  },
  {
    id: 'chaussures',
    name: 'Chaussures',
    icon: '👟',
    color: '#8B4513',
    gradient: ['#8B4513', '#D97236'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'chaussures'),
  },
  {
    id: 'sacs_bagages',
    name: 'Sacs',
    icon: '👜',
    color: '#9B4DCA',
    gradient: ['#9B4DCA', '#D97236'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'sacs_bagages'),
  },
  {
    id: 'accessoires',
    name: 'Accessoires',
    icon: '⌚',
    color: '#F4A460',
    gradient: ['#F4A460', '#FFB703'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'accessoires'),
  },
  {
    id: 'traditionnel',
    name: 'Traditionnel',
    icon: '🎨',
    color: '#2A9D8F',
    gradient: ['#2A9D8F', '#264653'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'traditionnel'),
  },
  {
    id: 'tissu_couture',
    name: 'Tissu & Couture',
    icon: '🧵',
    color: '#D97236',
    gradient: ['#D97236', '#FF6B35'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'tissu_couture'),
  },
  {
    id: 'bijoux_artisanat',
    name: 'Bijoux & Artisanat',
    icon: '💎',
    color: '#FFB703',
    gradient: ['#FFB703', '#FF6B35'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'bijoux_artisanat'),
  },
  {
    id: 'cosmetique_beaute',
    name: 'Cosmétique & Beauté',
    icon: '💄',
    color: '#9B4DCA',
    gradient: ['#9B4DCA', '#E63946'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'cosmetique_beaute'),
  },
  {
    id: 'electronique',
    name: 'Électronique',
    icon: '📱',
    color: '#264653',
    gradient: ['#264653', '#2A9D8F'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'electronique'),
  },
  {
    id: 'maison_deco',
    name: 'Maison & Déco',
    icon: '🏠',
    color: '#D97236',
    gradient: ['#D97236', '#F4A460'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'maison_deco'),
  },
  {
    id: 'sport_loisirs',
    name: 'Sport & Loisirs',
    icon: '⚽',
    color: '#2A9D8F',
    gradient: ['#2A9D8F', '#FFB703'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'sport_loisirs'),
  },
  {
    id: 'bebe_puericulture',
    name: 'Bébé & Puériculture',
    icon: '🍼',
    color: '#FF6B35',
    gradient: ['#FF6B35', '#FFB703'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'bebe_puericulture'),
  },
  {
    id: 'livres_culture',
    name: 'Livres & Culture',
    icon: '📚',
    color: '#8B4513',
    gradient: ['#8B4513', '#D97236'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'livres_culture'),
  },
  {
    id: 'nourriture',
    name: 'Nourriture',
    icon: '🍽️',
    color: '#E67E22',
    gradient: ['#E67E22', '#F39C12'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'nourriture'),
  },
  {
    id: 'covoiturage',
    name: 'Covoiturage & GP',
    icon: '🚗',
    color: '#2980B9',
    gradient: ['#2980B9', '#3498DB'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'covoiturage'),
  },
  {
    id: 'autres',
    name: 'Autres',
    icon: '✨',
    color: '#95A5A6',
    gradient: ['#95A5A6', '#BDC3C7'],
    subCategories: subCategories.filter(sub => sub.parentCategory === 'autres'),
  },
];

export const getSubCategoriesForCategory = (categoryId: Category): SubCategoryInfo[] => {
  if (categoryId === 'all') return subCategories;
  return subCategories.filter(sub => sub.parentCategory === categoryId);
};

export const getCategoryInfo = (categoryId: Category): CategoryInfo | undefined => {
  return categories.find(cat => cat.id === categoryId);
};
