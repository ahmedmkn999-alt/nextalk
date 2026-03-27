import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import NextalkDashboard from './nextalk-dashboard-v2';
import NextalkChat from './nextalk-chat';
import NextalkProfile from './nextalk-profile';
import NextalkNotifications from './nextalk-notifications';
import { translations } from './i18n';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('ar');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const t = (key: string) => {
    return translations[language]?.[key] || key;
  };

  const renderView = () => {
    switch (currentView) {
      case 'chat':
        return <NextalkChat user={user} supabase={supabase} t={t} />;
      case 'profile':
        return <NextalkProfile user={user} supabase={supabase} t={t} />;
      case 'notifications':
        return <NextalkNotifications user={user} supabase={supabase} t={t} />;
      default:
        return <NextalkDashboard user={user} supabase={supabase} setCurrentView={setCurrentView} t={t} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {renderView()}
    </div>
  );
}

export default App;
