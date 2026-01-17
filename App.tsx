
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import ComparisonSlider from './components/ComparisonSlider';
import { AppView, StyleOption, GeneratedResult, StyleCategory, CurrentSelection, Gender, SavedLook } from './types';
import { generateStyleTransformation } from './services/geminiService';

// --- IndexedDB 核心存储逻辑 (解决 3 个以上保存失败的 5MB 限制问题) ---
const DB_NAME = 'VogueAIDB_v2';
const STORE_NAME = 'saved_looks';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveLookToDB = async (look: SavedLook & { userId: string }) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(look);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const deleteLookFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllLooksFromDB = async (userId: string): Promise<SavedLook[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as (SavedLook & { userId: string })[];
      resolve(all.filter(l => l.userId === userId).sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

const INITIAL_STYLE_OPTIONS: StyleOption[] = [
  { id: 'fh1', name: '法式波波头', category: 'Hairstyle', gender: 'Female', thumbnailUrl: '', description: '利落短发' },
  { id: 'fh2', name: '大波浪卷发', category: 'Hairstyle', gender: 'Female', thumbnailUrl: '', description: '长卷发' },
  { id: 'fh3', name: '蓬松自然卷', category: 'Hairstyle', gender: 'Female', thumbnailUrl: '', description: '自然卷' },
  { id: 'ft1', name: '真丝衬衫', category: 'Top', gender: 'Female', thumbnailUrl: '', description: '白色衬衫' },
  { id: 'ft2', name: '皮质机车服', category: 'Top', gender: 'Female', thumbnailUrl: '', description: '黑色夹克' },
  { id: 'fb1', name: '百褶短裙', category: 'Bottom', gender: 'Female', thumbnailUrl: '', description: '格纹短裙' },
  { id: 'fb2', name: '丝绸半裙', category: 'Bottom', gender: 'Female', thumbnailUrl: '', description: '缎面半裙' },
  { id: 'mh1', name: '寸头', category: 'Hairstyle', gender: 'Male', thumbnailUrl: '', description: '圆寸' },
  { id: 'mh2', name: '背头', category: 'Hairstyle', gender: 'Male', thumbnailUrl: '', description: '油头背发' },
  { id: 'mh3', name: '韩式中分', category: 'Hairstyle', gender: 'Male', thumbnailUrl: '', description: '中分微卷' },
  { id: 'mt1', name: '商务西装', category: 'Top', gender: 'Male', thumbnailUrl: '', description: '蓝色西装' },
  { id: 'mt2', name: '极简卫衣', category: 'Top', gender: 'Male', thumbnailUrl: '', description: '灰色卫衣' },
  { id: 'mb1', name: '工装长裤', category: 'Bottom', gender: 'Male', thumbnailUrl: '', description: '卡其色长裤' },
  { id: 'mb2', name: '修身牛仔', category: 'Bottom', gender: 'Male', thumbnailUrl: '', description: '深色牛仔' },
];

const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
const TRENDING_TAGS = ['#老钱风', '#极简主义', '#夏日度假', '#赛博朋克', '#法式浪漫', '#商务精英'];
const PRESET_STYLES = ['温婉', '性感', '干练', '复古', '甜美', '极简', '朋克', '哥特'];

interface UserAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  gender: Gender;
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('splash');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [gender, setGender] = useState<Gender>('Female');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [userModelImage, setUserModelImage] = useState<string | null>(null);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  
  const [regGender, setRegGender] = useState<Gender>('Female');
  const [showPreferences, setShowPreferences] = useState(false);
  const [activeSavedLook, setActiveSavedLook] = useState<SavedLook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StyleCategory>('Hairstyle');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [styleInput, setStyleInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  const [selections, setSelections] = useState<CurrentSelection>({
    Hairstyle: null,
    Top: null,
    Bottom: null,
    Style: null,
  });

  // 初始化应用
  useEffect(() => {
    const sessionUserId = localStorage.getItem('vogue_session');
    if (sessionUserId) {
      const users = JSON.parse(localStorage.getItem('vogue_users') || '[]');
      const user = users.find((u: UserAccount) => u.id === sessionUserId);
      if (user) {
        setCurrentUser(user);
        const userData = JSON.parse(localStorage.getItem(`vogue_data_${user.id}`) || '{}');
        setGender(userData.gender || user.gender || 'Female');
        setAvatarUrl(userData.avatarUrl || DEFAULT_AVATAR);
        setUserModelImage(userData.userModelImage || null);
        getAllLooksFromDB(user.id).then(setSavedLooks);
        if (view === 'splash') setView('home');
      } else {
        localStorage.removeItem('vogue_session');
        if (view === 'splash') setView('home');
      }
    } else if (view === 'splash') {
       setTimeout(() => setView('home'), 2000);
    }
  }, []);

  // 持久化数据
  useEffect(() => {
    if (currentUser) {
      const dataToSave = { gender, avatarUrl, userModelImage };
      localStorage.setItem(`vogue_data_${currentUser.id}`, JSON.stringify(dataToSave));
    }
  }, [currentUser, gender, avatarUrl, userModelImage]);

  const baseImage = useMemo(() => {
    if (userModelImage) return userModelImage;
    return gender === 'Female' 
      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1000&auto=format&fit=crop'
      : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1000&auto=format&fit=crop';
  }, [gender, userModelImage]);

  const [previewImage, setPreviewImage] = useState<string>(baseImage);

  // 统一视图跳转控制器
  const handleViewChange = (newView: AppView) => {
    const authRestricted: AppView[] = ['studio', 'favorites', 'profile', 'look_detail'];
    if (authRestricted.includes(newView) && !currentUser) {
      setView('login');
    } else {
      if (newView === 'studio' && result === null) {
        setPreviewImage(baseImage);
      }
      setView(newView);
    }
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const users = JSON.parse(localStorage.getItem('vogue_users') || '[]');
    if (users.find((u: UserAccount) => u.email === email)) return alert('邮箱已存在');
    const newUser = { id: Math.random().toString(36).substr(2, 9), email, password, name, gender: regGender };
    localStorage.setItem('vogue_users', JSON.stringify([...users, newUser]));
    setView('login');
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const users = JSON.parse(localStorage.getItem('vogue_users') || '[]');
    const user = users.find((u: UserAccount) => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem('vogue_session', user.id);
      setCurrentUser(user);
      const userData = JSON.parse(localStorage.getItem(`vogue_data_${user.id}`) || '{}');
      setAvatarUrl(userData.avatarUrl || DEFAULT_AVATAR);
      setGender(userData.gender || user.gender || 'Female');
      setUserModelImage(userData.userModelImage || null);
      getAllLooksFromDB(user.id).then(looks => {
        setSavedLooks(looks);
        setView('home');
      });
    } else alert('登录失败');
  };

  const handleLogout = () => {
    localStorage.removeItem('vogue_session');
    setCurrentUser(null);
    setSavedLooks([]);
    setUserModelImage(null);
    setAvatarUrl(DEFAULT_AVATAR);
    setView('home');
  };

  const updatePreview = useCallback(async (currentSelections: CurrentSelection) => {
    setIsPreviewLoading(true);
    try {
      const styleDesc = currentSelections.Style ? `overall vibe is ${currentSelections.Style}` : 'maintain natural vibe';
      const prompt = `Style update: Hairstyle=${currentSelections.Hairstyle?.description || 'keep'}, Top=${currentSelections.Top?.description || 'keep'}, Bottom=${currentSelections.Bottom?.description || 'keep'}. Additionally, the ${styleDesc}. Maintain the person's identity.`;
      const imgResp = await fetch(baseImage);
      const blob = await imgResp.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const generatedImg = await generateStyleTransformation(reader.result as string, prompt, 'Fashion');
        setPreviewImage(generatedImg);
        setIsPreviewLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) { setIsPreviewLoading(false); }
  }, [baseImage, gender]);

  const handleSelection = (option: StyleOption) => {
    const next = { ...selections, [option.category]: option };
    setSelections(next);
    updatePreview(next);
  };

  const handleStyleChange = (val: string) => {
    setStyleInput(val);
    const next = { ...selections, Style: val || null };
    setSelections(next);
    // 使用防抖或简单的延时触发预览更新可能会更好，这里为了简单直接触发
    if (val.length > 2 || val === '') {
       updatePreview(next);
    }
  };

  const handleSaveResult = async () => {
    if (!result || !currentUser) return;
    const thumbs: Record<string, string> = {};
    Object.values(selections).forEach(opt => { if(opt && typeof opt !== 'string') thumbs[opt.id] = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400"; });
    const look = {
      id: "look_" + Date.now(),
      userId: currentUser.id,
      resultUrl: result.resultUrl,
      originalUrl: result.originalUrl,
      selections: { ...selections },
      thumbnails: thumbs,
      timestamp: Date.now(),
      gender
    };
    await saveLookToDB(look);
    setSavedLooks(prev => [look, ...prev]);
    setResult(null);
    setView('favorites');
  };

  const handleDeleteLook = async (id: string) => {
    if (!confirm('确定要删除这个方案吗？')) return;
    await deleteLookFromDB(id);
    setSavedLooks(prev => prev.filter(l => l.id !== id));
    setView('favorites');
  };

  const renderContent = () => {
    switch (view) {
      case 'splash':
        return (
          <div className="flex h-full flex-col items-center justify-center bg-background-light dark:bg-background-dark">
            <div className="animate-float flex flex-col items-center">
              <span className="material-symbols-outlined text-6xl text-primary mb-4">styler</span>
              <h1 className="text-3xl font-bold tracking-widest uppercase">Vogue AI</h1>
            </div>
          </div>
        );

      case 'login':
        return (
          <div className="px-8 pt-20 h-full animate-in slide-in-from-bottom duration-500">
            <h2 className="text-4xl font-bold mb-10">登录</h2>
            <form onSubmit={handleLogin} className="space-y-6">
              <input name="email" type="email" placeholder="电子邮箱" required className="w-full p-4 rounded-2xl bg-white border-none shadow-sm focus:ring-primary" />
              <input name="password" type="password" placeholder="密码" required className="w-full p-4 rounded-2xl bg-white border-none shadow-sm focus:ring-primary" />
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg">进入时尚空间</button>
              <button type="button" onClick={() => setView('register')} className="w-full text-sm text-gray-400 font-bold">没有账号？立即注册</button>
            </form>
          </div>
        );

      case 'register':
        return (
          <div className="px-8 pt-16 h-full overflow-y-auto no-scrollbar animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-bold mb-8">注册</h2>
            <form onSubmit={handleRegister} className="space-y-5">
              <input name="name" type="text" placeholder="昵称" required className="w-full p-4 rounded-2xl bg-white border-none shadow-sm" />
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button type="button" onClick={() => setRegGender('Female')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${regGender === 'Female' ? 'bg-white text-primary' : 'text-gray-400'}`}>女士</button>
                <button type="button" onClick={() => setRegGender('Male')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${regGender === 'Male' ? 'bg-white text-primary' : 'text-gray-400'}`}>男士</button>
              </div>
              <input name="email" type="email" placeholder="邮箱" required className="w-full p-4 rounded-2xl bg-white border-none shadow-sm" />
              <input name="password" type="password" placeholder="密码" required className="w-full p-4 rounded-2xl bg-white border-none shadow-sm" />
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg">创建账号</button>
              <button type="button" onClick={() => setView('login')} className="w-full text-sm text-gray-400 font-bold">已有账号？去登录</button>
            </form>
          </div>
        );

      case 'home':
        return (
          <div className="px-6 py-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-10">
              <div><p className="text-gray-400 text-sm">Hello,</p><h1 className="text-2xl font-bold">{currentUser?.name || 'Vogue Guest'}</h1></div>
              <div className="size-12 rounded-full overflow-hidden border-2 border-primary/20" onClick={() => handleViewChange('profile')}>
                <img src={currentUser ? avatarUrl : DEFAULT_AVATAR} className="object-cover w-full h-full" />
              </div>
            </header>

            <div className="flex justify-between items-end mb-4 px-1">
              <h2 className="text-xl font-bold">数字模特</h2>
              <div className="flex gap-2">
                {userModelImage && (
                  <button onClick={() => setUserModelImage(null)} className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1.5 rounded-full border border-red-100 transition-all active:scale-95">重置</button>
                )}
                <button onClick={() => currentUser ? modelFileInputRef.current?.click() : setView('login')} className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 transition-all active:scale-95">上传照片</button>
              </div>
            </div>

            <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl group cursor-pointer" onClick={() => handleViewChange('studio')}>
              <img src={baseImage} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div className="text-white"><p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Digital Twin</p><h3 className="text-2xl font-bold">私人试衣间</h3></div>
                <button className="px-6 py-3 bg-white text-black text-[10px] font-bold rounded-xl shadow-xl uppercase">Start</button>
              </div>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="px-6 py-10 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold mb-8">风格灵感</h2>
            <div className="relative mb-8"><span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span><input type="text" placeholder="发现流行趋势..." className="w-full pl-12 pr-4 py-4 rounded-2xl border-none bg-white shadow-sm focus:ring-primary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            <div className="flex flex-wrap gap-2 mb-8">{TRENDING_TAGS.map(tag => <button key={tag} onClick={() => {setSearchQuery(tag); handleViewChange('studio');}} className="px-4 py-2 rounded-xl bg-white text-[10px] font-bold shadow-sm border border-gray-50">{tag}</button>)}</div>
            <div className="grid grid-cols-2 gap-4">
              {['https://images.unsplash.com/photo-1434389677669-e08b4cac3105', 'https://images.unsplash.com/photo-1523381235312-3f113d27dea6', 'https://images.unsplash.com/photo-1488161628813-04466f872be2', 'https://images.unsplash.com/photo-1519033007971-f24b0f3290f3'].map((url, i) => <div key={i} className="aspect-square rounded-2xl overflow-hidden shadow-md" onClick={() => handleViewChange('studio')}><img src={`${url}?q=80&w=400`} className="w-full h-full object-cover" /></div>)}
            </div>
          </div>
        );

      case 'favorites':
        return (
          <div className="px-6 py-10 h-full animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold mb-4">我的收藏</h2>
            <p className="text-gray-400 text-sm mb-8">无限量存储您的专属方案</p>
            {savedLooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-1/2 opacity-20"><span className="material-symbols-outlined text-6xl">favorite</span><p className="font-bold uppercase mt-2">空空如也</p></div>
            ) : (
              <div className="grid grid-cols-2 gap-4 pb-20">
                {savedLooks.map(look => (
                  <div key={look.id} className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-lg cursor-pointer transition-transform active:scale-95" onClick={() => { setActiveSavedLook(look); setView('look_detail'); }}>
                    <img src={look.resultUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-4 left-4 text-white"><p className="text-[9px] font-bold opacity-70">{new Date(look.timestamp).toLocaleDateString()}</p><p className="text-[11px] font-bold truncate">{look.selections.Hairstyle?.name || 'Look'}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'look_detail':
        if (!activeSavedLook) { setView('favorites'); return null; }
        return (
          <div className="h-full bg-white animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar pb-24">
            <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/80 backdrop-blur sticky top-0 z-10">
              <button onClick={() => setView('favorites')} className="size-10 rounded-full bg-gray-50 flex items-center justify-center active:scale-90 transition-all"><span className="material-symbols-outlined">arrow_back</span></button>
              <h3 className="font-bold">方案详情</h3>
              <button onClick={() => handleDeleteLook(activeSavedLook.id)} className="size-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-all"><span className="material-symbols-outlined text-xl">delete</span></button>
            </header>
            <div className="px-6 py-4">
              <div className="aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl mb-8"><img src={activeSavedLook.resultUrl} className="w-full h-full object-cover" /></div>
              <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">搭配组合</h4>
                <div className="space-y-4">
                  {Object.entries(activeSavedLook.selections).map(([cat, opt]) => opt && (
                    <div key={cat} className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm">
                      <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center text-primary"><span className="material-symbols-outlined text-xl">{cat === 'Style' ? 'auto_awesome' : 'check_circle'}</span></div>
                      <div><p className="text-[9px] text-gray-400 uppercase font-bold">{cat}</p><p className="text-sm font-bold">{typeof opt === 'string' ? opt : opt.name}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { setSelections(activeSavedLook.selections); setPreviewImage(activeSavedLook.resultUrl); setView('studio'); }} className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all">以此为基础继续编辑</button>
            </div>
          </div>
        );

      case 'studio':
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 relative bg-[#121217] flex items-center justify-center overflow-hidden">
              <img src={previewImage} className={`max-w-full max-h-full object-contain transition-all duration-700 ${isPreviewLoading ? 'blur-2xl opacity-50 scale-110' : ''}`} />
              {isPreviewLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-10"><div className="size-12 border-4 border-white/20 border-t-primary rounded-full animate-spin mb-4" /><p className="text-white text-[10px] font-bold tracking-widest uppercase">AI 创意设计中...</p></div>}
              <button onClick={() => setView('home')} className="absolute top-6 left-6 size-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="h-[52vh] bg-white rounded-t-[3rem] p-6 shadow-[0_-15px_50px_rgba(0,0,0,0.15)] flex flex-col">
              <div className="flex gap-6 border-b border-gray-50 mb-6 shrink-0 overflow-x-auto no-scrollbar">
                {['Hairstyle', 'Top', 'Bottom', 'Style'].map(cat => <button key={cat} onClick={() => setActiveTab(cat as any)} className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === cat ? 'text-primary' : 'text-gray-400'}`}>{cat === 'Hairstyle' ? '发型' : cat === 'Top' ? '上衣' : cat === 'Bottom' ? '下衣' : '风格'}{activeTab === cat && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}</button>)}
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                {activeTab === 'Style' ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">键入您的风格愿景</label>
                       <div className="relative">
                         <input 
                           type="text" 
                           placeholder="例如：温婉、性感、先锋..." 
                           className="w-full p-5 pr-14 rounded-2xl bg-gray-50 border-none shadow-inner text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                           value={styleInput}
                           onChange={(e) => handleStyleChange(e.target.value)}
                         />
                         {styleInput && (
                           <button onClick={() => handleStyleChange('')} className="absolute right-4 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400">
                             <span className="material-symbols-outlined text-lg">close</span>
                           </button>
                         )}
                       </div>
                    </div>
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 block">风格灵感推荐</label>
                       <div className="flex flex-wrap gap-2">
                         {PRESET_STYLES.map(style => (
                           <button 
                             key={style} 
                             onClick={() => handleStyleChange(style)}
                             className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${styleInput === style ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-600'}`}
                           >
                             {style}
                           </button>
                         ))}
                       </div>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed italic">提示：自定义风格将深刻影响 AI 对发型和服装细节的重新诠释，尝试组合多个关键词。</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {INITIAL_STYLE_OPTIONS.filter(o => o.category === activeTab && (o.gender === gender || o.gender === 'Unisex')).map(opt => (
                      <button key={opt.id} onClick={() => handleSelection(opt)} className={`w-full p-5 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${selections[activeTab]?.id === opt.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-gray-50'}`}>
                        <div><p className={`font-bold text-sm ${selections[activeTab]?.id === opt.id ? 'text-primary' : ''}`}>{opt.name}</p><p className="text-[10px] text-gray-400 mt-1 uppercase">{opt.description}</p></div>
                        {selections[activeTab]?.id === opt.id && <span className="material-symbols-outlined text-primary">check_circle</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => {setResult({ originalUrl: baseImage, resultUrl: previewImage, description: 'Design' }); setView('result');}} className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shrink-0 mt-4 active:scale-95 transition-all">完成设计</button>
            </div>
          </div>
        );

      case 'result':
        if (!result) return null;
        return (
          <div className="h-full bg-white animate-in zoom-in duration-300 flex flex-col">
            <header className="px-6 pt-12 pb-4 flex justify-between items-center"><button onClick={() => setView('studio')} className="size-10 rounded-full bg-gray-50 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button><h3 className="font-bold">保存方案</h3><div className="size-10" /></header>
            <div className="flex-1 px-6 overflow-y-auto no-scrollbar">
              <div className="mb-6"><ComparisonSlider original={result.originalUrl} result={result.resultUrl} /></div>
              <button onClick={handleSaveResult} className="w-full py-4 bg-[#121217] text-white rounded-2xl font-bold uppercase tracking-widest shadow-2xl mb-4">保存到我的收藏</button>
              <button onClick={() => setView('home')} className="w-full py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-400">放弃修改</button>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="px-6 py-12 flex flex-col items-center h-full animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="size-32 rounded-full overflow-hidden border-4 border-white shadow-2xl"><img src={avatarUrl} className="w-full h-full object-cover" /></div>
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 size-8 rounded-full bg-primary text-white flex items-center justify-center border-2 border-white shadow-lg active:scale-90 transition-all"><span className="material-symbols-outlined text-sm">photo_camera</span></button>
            </div>
            <h2 className="text-2xl font-bold mb-8">{currentUser?.name}</h2>
            <div className="w-full space-y-3">
              <div className="p-5 bg-white rounded-2xl flex justify-between items-center shadow-sm cursor-pointer" onClick={() => setShowPreferences(true)}><span className="font-bold text-sm">试穿偏好</span><span className="text-primary text-sm font-bold">{gender === 'Female' ? '女性' : '男性'}</span></div>
              <button onClick={handleLogout} className="w-full p-5 bg-red-50 text-red-500 rounded-2xl font-bold flex justify-between items-center active:scale-[0.98] transition-all"><span>退出登录</span><span className="material-symbols-outlined">logout</span></button>
            </div>
            {showPreferences && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end">
                <div className="w-full bg-white rounded-t-[3rem] p-8 animate-in slide-in-from-bottom">
                  <h3 className="text-xl font-bold mb-6">偏好设置</h3>
                  <div className="flex gap-4 mb-8">
                    <button onClick={() => setGender('Female')} className={`flex-1 py-4 rounded-2xl font-bold border-2 ${gender === 'Female' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100'}`}>女性方案</button>
                    <button onClick={() => setGender('Male')} className={`flex-1 py-4 rounded-2xl font-bold border-2 ${gender === 'Male' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100'}`}>男性方案</button>
                  </div>
                  <button onClick={() => setShowPreferences(false)} className="w-full py-4 bg-[#121217] text-white rounded-2xl font-bold shadow-lg">确定</button>
                </div>
              </div>
            )}
          </div>
        );

      default: return null;
    }
  };

  return (
    <Layout activeView={view} onViewChange={handleViewChange}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setAvatarUrl(r.result as string); r.readAsDataURL(f); } }} />
      <input type="file" ref={modelFileInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setUserModelImage(r.result as string); r.readAsDataURL(f); } }} />
      {renderContent()}
    </Layout>
  );
};

export default App;
