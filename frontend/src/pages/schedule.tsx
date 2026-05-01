import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Schedule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const { isAuthenticated } = useAuth();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setUploadStatus('');

    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus('Загрузка...');
      const response = await axios.post(
        'http://localhost:8080/api/schedule/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true
        }
      );
      setUploadStatus(`Успешно: ${response.data.message}`);
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.detail || error.message;
      setUploadStatus(`Ошибка: ${msg}`);
    }
  };

  return (
    <div>
      <h2>Расписание занятий</h2>
      <p style={{ color: '#64748b', marginTop: '16px' }}>
        Здесь будет таблица с расписанием
      </p>

      {isAuthenticated && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".xlsx,.xlsm,.xlsb,.xls"
          />
          <button onClick={handleButtonClick} className="schedule-upload-btn">
            Добавить расписание
          </button>

          {selectedFile && (
            <p style={{ marginTop: '12px', color: '#16a34a' }}>
              Выбран файл: {selectedFile.name}
            </p>
          )}
          {uploadStatus && (
            <p style={{ marginTop: '12px' }}>{uploadStatus}</p>
          )}
        </>
      )}
    </div>
  );
}