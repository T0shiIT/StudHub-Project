import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWithCsrf, ensureCsrfToken } from '../utils/csrf';
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

export default function Announcements() {
  const { user } = useAuth();
  
  // Изначально пустой массив, без мок-данных
  const [posts, setPosts] = useState<Post[]>([]);
  const [newText, setNewText] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Загрузка реальных постов с бэкенда при открытии страницы
  useEffect(() => {
    const loadPosts = async () => {
      try {
        await ensureCsrfToken();
        const response = await fetchWithCsrf('http://localhost:8080/api/announcements', { 
          method: 'GET' 
        });
        
        if (response.ok) {
          const data = await response.json();
          const mappedPosts: Post[] = data.map((item: any) => ({
            id: item.id,
            author: {
              id: Number(item.userId),
              name: item.userName,
              group: item.userGroup,
            },
            content: item.content,
            image: item.imageUrl || undefined,
            createdAt: new Date(item.createdAt),
          }));
          setPosts(mappedPosts);
        }
      } catch (error) {
        console.error('Ошибка при загрузке объявлений:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPosts();
  }, []);

  // Обработка выбора файла
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 2. Публикация поста с отправкой на бэкенд
  const handleSubmit = async () => {
    if (!newText.trim() && !newImage) return;
    setIsSubmitting(true);

    try {
      const response = await fetchWithCsrf('http://localhost:8080/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newText.trim(),
          imageUrl: newImage,
        }),
      });

      if (response.ok) {
        const savedPost = await response.json();
        const newPost: Post = {
          id: savedPost.id,
          author: {
            id: Number(savedPost.userId),
            name: savedPost.userName,
            group: savedPost.userGroup,
          },
          content: savedPost.content,
          image: savedPost.imageUrl || undefined,
          createdAt: new Date(savedPost.createdAt),
        };

        // Добавляем новый пост в начало списка
        setPosts((prev) => [newPost, ...prev]);
        
        // Очистка формы
        setNewText('');
        setNewImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        alert('Не удалось опубликовать объявление');
      }
    } catch (error) {
      console.error('Ошибка сети при публикации:', error);
      alert('Ошибка сети');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Удаление поста (только для автора)
  const handleDelete = async (postId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это объявление?')) return;
    
    try {
      const response = await fetchWithCsrf(`http://localhost:8080/api/announcements/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Убираем пост из локального состояния без перезагрузки страницы
        setPosts((prev) => prev.filter((post) => post.id !== postId));
      } else {
        const err = await response.json();
        alert(err.error || 'Не удалось удалить объявление');
      }
    } catch (error) {
      console.error('Ошибка при удалении:', error);
      alert('Ошибка сети при удалении');
    }
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
            padding: 12, fontSize: 15, resize: 'vertical', fontFamily: 'inherit',
            boxSizing: 'border-box'
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
              fontSize: 14, fontWeight: 500, marginLeft: 'auto',
              transition: 'background 0.2s'
            }}
          >{isSubmitting ? 'Публикация...' : 'Опубликовать'}</button>
        </div>
      </div>

      {/* Лента постов */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#fff', borderRadius: 12 }}>
            Загрузка объявлений...
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#fff', borderRadius: 12 }}>
            Пока нет объявлений. Будьте первым!
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} style={{
              background: '#fff', borderRadius: 12, padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: '#475569', fontWeight: 600
                }}>
                  {post.author.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{post.author.name}</div>
                  {post.author.group && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>{post.author.group}</div>
                  )}
                </div>
                
                {/* Блок с кнопкой удаления и временем */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  {/* Показываем кнопку удаления ТОЛЬКО если ID автора совпадает с ID текущего пользователя */}
                  {post.author.id === user?.id && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      title="Удалить объявление"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      🗑️
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatTime(post.createdAt)}
                  </div>
                </div>
              </div>

              <p style={{ margin: '0 0 10px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#334155' }}>
                {post.content}
              </p>

              {post.image && (
                <img
                  src={post.image}
                  alt="Пост"
                  style={{
                    width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 400,
                    marginTop: 4, border: '1px solid #f1f5f9'
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}