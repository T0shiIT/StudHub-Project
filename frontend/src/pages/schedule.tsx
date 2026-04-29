import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Schedule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const { user, isAuthenticated } = useAuth();

  // Check for admin role (adjust role name as stored in DB)
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

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
      setUploadStatus('Uploading...');
      const response = await axios.post(
        'http://localhost:8081/api/cpp/upload-schedule',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-User-Id': user?.id?.toString() || ''
          }
        }
      );
      setUploadStatus(`Success: ${response.data.message}`);
    } catch (error: any) {
      const msg = error.response?.data || error.message;
      setUploadStatus(`Error: ${msg}`);
    }
  };

  return (
    <div>
      <h2>Расписание занятий</h2>
      <p style={{ color: '#64748b', marginTop: '16px' }}>
        Здесь будет таблица с расписанием
      </p>

      {isAdmin && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".xlsx"
          />
          <button onClick={handleButtonClick} style={{ marginTop: '20px' }}>
            Выбрать файл
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