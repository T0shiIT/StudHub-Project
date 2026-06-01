import { useState, useRef, } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ChangeEvent } from 'react';

// Типы
interface Author {
  id: number;
  name: string;
  avatar?: string;
  group?: string;
}

interface Post {
  id: string;
  author: Author;
  content: string;
  image?: string;
  createdAt: Date;
}

// Мок-данные для разработки
const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: { id: 101, name: 'Иванов И.И.', group: 'Преподаватели' },
    content: 'Завтра пара по Алгоритмам переносится на 15:00. Приносите с собой ноутбуки.',
    image: 'https://placehold.co/600x300/e2e8f0/1e293b?text=Аудитория+305',
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: '2',
    author: { id: 102, name: 'Петрова А.С.', group: 'Группа 09.03.01' },
    content: 'Ребята, скиньте кто-нибудь конспект за прошлую неделю, плиз 🙏',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
];

export default function Announcements() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [newText, setNewText] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обработка выбора файла
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Публикация поста (пока локально, позже заменится на fetch)
  const handleSubmit = async () => {
    if (!newText.trim() && !newImage) return;
    setIsSubmitting(true);

    const newPost: Post = {
      id: crypto.randomUUID(),
      author: {
        id: user?.id || 0,
        name: `${user?.lastName || 'User'} ${user?.firstName || ''}`.trim(),
        group: user?.group || '',
        avatar: undefined, // позже прикрутим аватары
      },
      content: newText.trim(),
      image: newImage || undefined,
      createdAt: new Date(),
    };

    // TODO: здесь будет запрос к бэку
    // await fetchWithCsrf('/api/posts', { method: 'POST', body: formData });

    setPosts((prev) => [newPost, ...prev]);
    setNewText('');
    setNewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsSubmitting(false);
  };

  // Форматирование времени
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин. назад`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ marginBottom: 20, fontSize: 22 }}>Лента объявлений</h2>

      {/* Форма создания поста */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24
      }}>
        <textarea
          placeholder="Что нового? Напишите объявление..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          rows={3}
          style={{
            width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: 12, fontSize: 15, resize: 'vertical', fontFamily: 'inherit'
          }}
        />
        {newImage && (
          <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
            <img src={newImage} alt="preview" style={{ maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />
            <button
              onClick={() => setNewImage(null)}
              style={{
                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)',
                color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20,
                cursor: 'pointer', fontSize: 12, lineHeight: '20px'
              }}
            >✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: 6,
              cursor: 'pointer', fontSize: 14, color: '#475569'
            }}
          >📷 Добавить фото</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!newText.trim() && !newImage)}
            style={{
              background: isSubmitting ? '#94a3b8' : '#2563eb', color: '#fff',
              border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
              fontSize: 14, fontWeight: 500, marginLeft: 'auto'
            }}
          >{isSubmitting ? 'Публикация...' : 'Опубликовать'}</button>
        </div>
      </div>

      {/* Лента постов */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {posts.map((post) => (
          <div key={post.id} style={{
            background: '#fff', borderRadius: 12, padding: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#475569'
              }}>
                {post.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{post.author.name}</div>
                {post.author.group && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{post.author.group}</div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                {formatTime(post.createdAt)}
              </div>
            </div>

            <p style={{ margin: '0 0 10px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {post.content}
            </p>

            {post.image && (
              <img
                src={post.image}
                alt="Пост"
                style={{
                  width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 400,
                  marginTop: 4
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}