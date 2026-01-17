
export type AppView = 'splash' | 'login' | 'register' | 'home' | 'studio' | 'result' | 'profile' | 'search' | 'favorites' | 'look_detail';

export type StyleCategory = 'Hairstyle' | 'Top' | 'Bottom' | 'Style';

export type Gender = 'Male' | 'Female';

export interface StyleOption {
  id: string;
  name: string;
  category: StyleCategory;
  thumbnailUrl: string;
  description: string;
  gender: Gender | 'Unisex';
}

export interface GeneratedResult {
  originalUrl: string;
  resultUrl: string;
  description: string;
}

export interface CurrentSelection {
  Hairstyle: StyleOption | null;
  Top: StyleOption | null;
  Bottom: StyleOption | null;
  Style: string | null; // 存储自定义风格描述
}

export interface SavedLook {
  id: string;
  resultUrl: string;
  originalUrl: string;
  selections: CurrentSelection;
  thumbnails: Record<string, string>; // 存储保存时的组件缩略图
  timestamp: number;
  gender: Gender;
}
