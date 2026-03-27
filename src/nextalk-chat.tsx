import { useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';

interface ChatProps {
  user: any;
  supabase: any;
  t: (key: string) => string;
}

export default function NextalkChat({ user, supabase, t }: ChatProps) {
  const [message, setMessage] = useState('');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center gap-4">
          <button className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('chat')}</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto flex">
        <aside className="w-80 border-r bg-gray-50 p-4">
          <div className="mb-4">
            <input
              type="text"
              placeholder={t('searchUsers')}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <div className="p-3 bg-white rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">مستخدم تجريبي</h3>
                  <p className="text-sm text-gray-600">{t('online')}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-md">
                  <p className="text-gray-800">مرحباً! كيف حالك؟</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-md">
                  <p>بخير، شكراً لك!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 bg-white">
            <div className="container mx-auto max-w-3xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('typeMessage')}
                  className="flex-1 px-4 py-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-full hover:shadow-lg transition-all">
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
