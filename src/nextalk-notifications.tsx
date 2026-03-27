import { ArrowLeft, Bell, MessageSquare, UserPlus, Heart } from 'lucide-react';

interface NotificationsProps {
  user: any;
  supabase: any;
  t: (key: string) => string;
}

export default function NextalkNotifications({ user, supabase, t }: NotificationsProps) {
  const notifications = [
    {
      id: 1,
      type: 'message',
      title: 'رسالة جديدة',
      description: 'لديك رسالة جديدة من مستخدم تجريبي',
      time: 'منذ 5 دقائق',
      read: false,
    },
    {
      id: 2,
      type: 'user',
      title: 'طلب صداقة جديد',
      description: 'يريد أحمد إضافتك كصديق',
      time: 'منذ ساعة',
      read: false,
    },
    {
      id: 3,
      type: 'like',
      title: 'إعجاب جديد',
      description: 'أعجب شخص ما بمنشورك',
      time: 'منذ ساعتين',
      read: true,
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-6 h-6 text-blue-600" />;
      case 'user':
        return <UserPlus className="w-6 h-6 text-green-600" />;
      case 'like':
        return <Heart className="w-6 h-6 text-red-600" />;
      default:
        return <Bell className="w-6 h-6 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center gap-4">
          <button className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('notifications')}</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all cursor-pointer ${
                !notification.read ? 'border-r-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    {notification.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">
                    {notification.description}
                  </p>
                  <span className="text-xs text-gray-500">{notification.time}</span>
                </div>
                {!notification.read && (
                  <div className="w-3 h-3 bg-blue-600 rounded-full flex-shrink-0"></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {notifications.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">لا توجد إشعارات جديدة</p>
          </div>
        )}
      </div>
    </div>
  );
}
