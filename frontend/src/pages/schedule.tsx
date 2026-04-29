import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Schedule() {
  // Ссылка на скрытый input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Состояние для хранения выбранного файла
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Получаем данные пользователя из контекста
  const { user, isAuthenticated } = useAuth();
  
  // Проверяем, является ли пользователь администратором.
  // Предполагаем, что в объекте user есть поле role.
  // При необходимости замените 'admin' на нужное значение, например 'ROLE_ADMIN'.
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Обработчик клика по кнопке – открывает проводник
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Обработчик выбора файла
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      // Здесь может быть логика загрузки файла на сервер
    }
  };

  return (
    <div>
      <h2>Расписание занятий</h2>
      <p style={{ color: '#64748b', marginTop: '16px' }}>
        Здесь будет таблица с расписанием (задача Анны)
      </p>

      {/* Блок загрузки файла – отображается только для администратора */}
      {isAdmin && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            // accept=".xlsx"
          />
          <button onClick={handleButtonClick} style={{ marginTop: '20px' }}>
            Выбрать файл
          </button>

          {selectedFile && (
            <p style={{ marginTop: '12px', color: '#16a34a' }}>
              Выбран файл: {selectedFile.name}
            </p>
          )}
        </>
      )}
    </div>
  );
}