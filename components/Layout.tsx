
import React from 'react';
import { AppView } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange }) => {
  const isAuthView = activeView === 'splash' || activeView === 'login' || activeView === 'register';

  if (activeView === 'splash') return <>{children}</>;

  return (
    <div className="relative mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden bg-background-light dark:bg-background-dark shadow-2xl">
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {children}
      </main>

      {!isAuthView && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md bg-white/90 px-6 py-4 pb-8 backdrop-blur-xl dark:bg-background-dark/90 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => onViewChange('home')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'home' ? 'text-primary' : 'text-gray-400'}`}
            >
              <span className={`material-symbols-outlined ${activeView === 'home' ? 'fill-1' : ''}`} style={{ fontSize: '28px' }}>home</span>
            </button>
            
            <button 
              onClick={() => onViewChange('search')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'search' ? 'text-primary' : 'text-gray-400'}`}
            >
              <span className={`material-symbols-outlined ${activeView === 'search' ? 'fill-1' : ''}`} style={{ fontSize: '28px' }}>search</span>
            </button>

            <div className="-mt-12 relative">
              <button 
                onClick={() => onViewChange('studio')}
                className={`flex size-14 items-center justify-center rounded-full shadow-2xl transition-all active:scale-95 ${activeView === 'studio' ? 'bg-primary text-white scale-110' : 'bg-[#121217] text-white dark:bg-white dark:text-black'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>{activeView === 'studio' ? 'styler' : 'add'}</span>
              </button>
            </div>

            <button 
              onClick={() => onViewChange('favorites')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'favorites' ? 'text-primary' : 'text-gray-400'}`}
            >
              <span className={`material-symbols-outlined ${activeView === 'favorites' ? 'fill-1' : ''}`} style={{ fontSize: '28px' }}>favorite</span>
            </button>

            <button 
              onClick={() => onViewChange('profile')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'profile' ? 'text-primary' : 'text-gray-400'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>person</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
