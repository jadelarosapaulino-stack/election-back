export type ElectionThemeConfig = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  headerTextColor: string;
  backgroundColor: string;
};

export type ElectionThemeCatalogSeed = {
  code: string;
  label: string;
  description: string;
  sortOrder: number;
  active: boolean;
  config: ElectionThemeConfig;
};

// Commercial platform themes for the voter portal and election management UI.
export const ELECTION_THEME_CATALOG_SEED: ElectionThemeCatalogSeed[] = [
  {
    code: 'theme-ocean',
    label: 'Azul Confianza',
    description: 'Azul corporativo limpio para instituciones y SaaS.',
    sortOrder: 10,
    active: true,
    config: {
      primaryColor: '#0F62FE',
      secondaryColor: '#083B8A',
      accentColor: '#38BDF8',
      textColor: '#0F172A',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F4F8FF',
    },
  },
  {
    code: 'theme-forest',
    label: 'Civic Verde',
    description: 'Verde sobrio para procesos cívicos y gubernamentales.',
    sortOrder: 20,
    active: true,
    config: {
      primaryColor: '#168A5B',
      secondaryColor: '#0E5F43',
      accentColor: '#47D7AC',
      textColor: '#0B132B',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F2FBF7',
    },
  },
  {
    code: 'theme-ember',
    label: 'Coral Premium',
    description: 'Coral moderno con contraste comercial.',
    sortOrder: 30,
    active: true,
    config: {
      primaryColor: '#E85D4F',
      secondaryColor: '#9F2D25',
      accentColor: '#FFB86B',
      textColor: '#171717',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#FFF6F3',
    },
  },
  {
    code: 'theme-midnight',
    label: 'Ejecutivo Indigo',
    description: 'Indigo profesional para experiencias administrativas.',
    sortOrder: 40,
    active: true,
    config: {
      primaryColor: '#4F46E5',
      secondaryColor: '#312E81',
      accentColor: '#A78BFA',
      textColor: '#111827',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F5F3FF',
    },
  },
  {
    code: 'theme-slate',
    label: 'Grafito Claro',
    description: 'Neutro elegante con acentos azules.',
    sortOrder: 50,
    active: true,
    config: {
      primaryColor: '#334155',
      secondaryColor: '#0F172A',
      accentColor: '#60A5FA',
      textColor: '#0F172A',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F8FAFC',
    },
  },
  {
    code: 'theme-azure',
    label: 'Fintech Cyan',
    description: 'Azul y cian vibrante para productos digitales.',
    sortOrder: 60,
    active: true,
    config: {
      primaryColor: '#0284C7',
      secondaryColor: '#075985',
      accentColor: '#22D3EE',
      textColor: '#0F172A',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F0FDFF',
    },
  },
  {
    code: 'theme-emerald',
    label: 'Emerald Tech',
    description: 'Esmeralda tecnológico con lectura clara.',
    sortOrder: 70,
    active: true,
    config: {
      primaryColor: '#059669',
      secondaryColor: '#064E3B',
      accentColor: '#34D399',
      textColor: '#0B132B',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#ECFDF5',
    },
  },
  {
    code: 'theme-amber',
    label: 'Dorado Institucional',
    description: 'Ámbar sobrio para marcas institucionales.',
    sortOrder: 80,
    active: true,
    config: {
      primaryColor: '#B7791F',
      secondaryColor: '#78350F',
      accentColor: '#F59E0B',
      textColor: '#1F2937',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#FFFBEB',
    },
  },
  {
    code: 'theme-charcoal',
    label: 'Carbon Ejecutivo',
    description: 'Grafito oscuro con acento premium.',
    sortOrder: 90,
    active: true,
    config: {
      primaryColor: '#18181B',
      secondaryColor: '#09090B',
      accentColor: '#A3E635',
      textColor: '#F4F4F5',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#111113',
    },
  },
  {
    code: 'theme-royal',
    label: 'Royal Moderno',
    description: 'Azul real con acento violeta moderno.',
    sortOrder: 100,
    active: true,
    config: {
      primaryColor: '#2563EB',
      secondaryColor: '#1E1B4B',
      accentColor: '#8B5CF6',
      textColor: '#0F172A',
      headerTextColor: '#FFFFFF',
      backgroundColor: '#F5F7FF',
    },
  },
  {
    code: 'theme-custom',
    label: 'Custom',
    description: 'Tema personalizado editable.',
    sortOrder: 1000,
    active: true,
    config: {
      primaryColor: '#2563EB',
      secondaryColor: '#1E293B',
      accentColor: '#22D3EE',
      textColor: '#0F172A',
      headerTextColor: '#F8FAFC',
      backgroundColor: '#F8FAFC',
    },
  },
];
