import { useRef, useState} from 'react';

export default function Schedule() {
  // Ссылка на импут
  const fileInputRef = useRef<HTMLInputElement>(null);
  //Состояние для хранения файлов
  const [selectedFile, setSelectedFile] = useState<File | null> (null);

  //Обработчик клика - проводник
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  //Обработчик изменения значения imnput
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]); // сохранияем первый выбранный файл
      // возможно здесь загрузка на сервер
    }
  };

    return (
    <div>
      <h2>Расписание занятий</h2>
      <p style={{ color: '#64748b', marginTop: '16px' }}>
        Здесь будет таблица с расписанием (задача Анны)
      </p>

      {/* Скрытый input для выбора файла */}
      <input
        type="file"
        ref={fileInputRef}
        style={{display: 'none' }}    //Визуально скрыт
        onChange={handleFileChange}
        //accept=".xlsx"
      />
      {/* Кнопка, которую видит пользователь */}
      <button onClick={handleButtonClick} style={{ marginTop: '20px' }}>
        Выбрать файл
      </button>

      {/* Отображение имени выбранного файла */}
      {selectedFile && (
        <p style={{ marginTop: '12px', color: '#16a34a'}}>
          Выбран файл: {selectedFile.name}
        </p>
      )}
    </div>
  );
}