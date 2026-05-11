import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';

const STORAGE_KEY = 'downloadedFileIds';

const AttachmentList = ({ attachments, onDelete }) => {
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, fileId: null });
    const [downloadedIds, setDownloadedIds] = useState([]);
    const [confirmRedownload, setConfirmRedownload] = useState({ isOpen: false, attachment: null });

    // Загружаем историю скачанных файлов из localStorage при монтировании
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setDownloadedIds(JSON.parse(stored));
            } catch (e) {
                console.error('Ошибка загрузки истории скачиваний', e);
            }
        }
    }, []);

    // Сохраняем историю в localStorage при её изменении
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(downloadedIds));
    }, [downloadedIds]);

    const markAsDownloaded = (attachmentId) => {
        if (!downloadedIds.includes(attachmentId)) {
            setDownloadedIds(prev => [...prev, attachmentId]);
        }
    };

    const removeFromDownloaded = (attachmentId) => {
        setDownloadedIds(prev => prev.filter(id => id !== attachmentId));
    };

    const downloadFile = async (attachment) => {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            alert('Не авторизован');
            return;
        }

        // Проверяем, скачивался ли уже этот файл
        const alreadyDownloaded = downloadedIds.includes(attachment.id);
        if (alreadyDownloaded) {
            // Показываем диалог подтверждения
            setConfirmRedownload({ isOpen: true, attachment });
            return;
        }

        // Если не скачивался – сразу качаем
        performDownload(attachment, token);
    };

    const performDownload = async (attachment, token) => {
        try {
            const response = await fetch(`/api/files/${attachment.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Ошибка загрузки');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // После успешного скачивания отмечаем файл как скачанный
            markAsDownloaded(attachment.id);
        } catch (err) {
            console.error(err);
            alert('Не удалось скачать файл');
        }
    };

    const handleConfirmRedownload = () => {
        const { attachment } = confirmRedownload;
        if (attachment) {
            const token = localStorage.getItem('jwtToken');
            performDownload(attachment, token);
        }
        setConfirmRedownload({ isOpen: false, attachment: null });
    };

    const handleCancelRedownload = () => {
        setConfirmRedownload({ isOpen: false, attachment: null });
    };

    const truncateFileName = (fileName) => {
        if (!fileName) return '';
        const lastDot = fileName.lastIndexOf('.');
        const extension = lastDot !== -1 ? fileName.slice(lastDot) : '';
        const nameWithoutExt = lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
        if (nameWithoutExt.length <= 20) return fileName;
        const start = nameWithoutExt.slice(0, 15);
        const end = nameWithoutExt.slice(-5);
        return `${start}...${end}${extension}`;
    };

    const handleDeleteClick = (id) => setConfirmDelete({ isOpen: true, fileId: id });

    const handleConfirmDelete = async () => {
        const id = confirmDelete.fileId;
        try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`/api/files/${id}`, {
                method: 'DELETE',
                headers: { Authorization: token ? `Bearer ${token}` : '' },
            });
            if (response.ok) {
                // Удаляем запись о скачивании, если она есть
                removeFromDownloaded(id);
                if (onDelete) onDelete();
            } else {
                alert('Ошибка удаления');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Ошибка удаления');
        } finally {
            setConfirmDelete({ isOpen: false, fileId: null });
        }
    };

    const handleCancelDelete = () => setConfirmDelete({ isOpen: false, fileId: null });

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(0)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="attachments-list">
            <label className="form-label">Прикреплённые файлы</label>
            {attachments.length === 0 && <div className="attachments-empty">Нет файлов</div>}
            <ul>
                {attachments.map((att) => (
                    <li key={att.id} className="attachment-item">
                        <div className="attachment-info">
                            <span className="attachment-link" onClick={() => downloadFile(att)}>
                                <i className="fas fa-paperclip"></i> {truncateFileName(att.fileName)}
                            </span>
                            <span className="attachment-size">{formatFileSize(att.fileSize)}</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn--danger btn--small"
                            onClick={() => handleDeleteClick(att.id)}
                        >
                            <i className="fas fa-trash-alt"></i>
                        </button>
                    </li>
                ))}
            </ul>

            {/* Модалка подтверждения удаления файла */}
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Удаление файла"
                message="Вы действительно хотите удалить этот файл? Это действие необратимо."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />

            {/* Модалка предупреждения о повторном скачивании */}
            <ConfirmModal
                isOpen={confirmRedownload.isOpen}
                title="Файл уже был скачан"
                message="Вы уже скачивали этот файл ранее. Скачать его снова?"
                onConfirm={handleConfirmRedownload}
                onCancel={handleCancelRedownload}
                confirmText="Скачать"
                confirmIcon="fa-download"
                confirmStyle="btn--primary"
                cancelText="Отмена"
                cancelIcon="fa-times"
            />
        </div>
    );
};

export default AttachmentList;