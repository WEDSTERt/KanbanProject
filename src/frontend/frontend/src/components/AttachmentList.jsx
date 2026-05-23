import React, {useState, useEffect} from 'react';
import ConfirmModal from './ConfirmModal';

const STORAGE_KEY = 'downloadedFileIds';

const AttachmentList = ({
                            attachments,
                            onDelete,
                            isEditMode = false  // Новый пропс - режим редактирования
                        }) => {
    const [confirmDelete, setConfirmDelete] = useState({isOpen: false, fileId: null});
    const [downloadedIds, setDownloadedIds] = useState([]);
    const [confirmRedownload, setConfirmRedownload] = useState({isOpen: false, attachment: null});
    const [isInitialized, setIsInitialized] = useState(false);

    // Загрузка истории из localStorage при монтировании (только один раз)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setDownloadedIds(parsed);
                }
            } catch (e) {
                console.error('Ошибка загрузки истории скачиваний', e);
            }
        }
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        if (downloadedIds.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(downloadedIds));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [downloadedIds, isInitialized]);

    const markAsDownloaded = (attachmentId) => {
        if (!downloadedIds.includes(attachmentId)) {
            const newIds = [...downloadedIds, attachmentId];
            setDownloadedIds(newIds);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds));
        }
    };

    const removeFromDownloaded = (attachmentId) => {
        const newIds = downloadedIds.filter(id => id !== attachmentId);
        setDownloadedIds(newIds);
        if (newIds.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const performDownload = async (attachment, token) => {
        try {
            const response = await fetch(`/api/files/${attachment.id}`, {
                headers: {Authorization: `Bearer ${token}`},
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
            markAsDownloaded(attachment.id);
        } catch (err) {
            console.error(err);
            alert('Не удалось скачать файл');
        }
    };

    const downloadFile = async (attachment) => {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            alert('Не авторизован');
            return;
        }
        const alreadyDownloaded = downloadedIds.includes(attachment.id);
        if (alreadyDownloaded) {
            setConfirmRedownload({isOpen: true, attachment});
            return;
        }
        await performDownload(attachment, token);
    };

    const handleConfirmRedownload = async () => {
        const {attachment} = confirmRedownload;
        if (attachment) {
            const token = localStorage.getItem('jwtToken');
            await performDownload(attachment, token);
        }
        setConfirmRedownload({isOpen: false, attachment: null});
    };

    const handleCancelRedownload = () => {
        setConfirmRedownload({isOpen: false, attachment: null});
    };

    const handleDeleteClick = (fileId) => setConfirmDelete({isOpen: true, fileId});

    const handleConfirmDelete = async () => {
        const fileId = confirmDelete.fileId;
        if (onDelete) {
            await onDelete(fileId);
        }
        removeFromDownloaded(fileId);
        setConfirmDelete({isOpen: false, fileId: null});
    };

    const handleCancelDelete = () => setConfirmDelete({isOpen: false, fileId: null});

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
                {attachments.map((att) => {
                    const isDownloaded = downloadedIds.includes(att.id);
                    return (
                        <li key={att.id} className="attachment-item">
                            <div className="attachment-info">
                                <div className="attachment-wrapper" onClick={() => downloadFile(att)}>
                                    <span
                                        className="attachment-link"
                                        style={isDownloaded ? { color: '#a855f7' } : {}}
                                    >
                                        <i className="fas fa-paperclip"></i> {truncateFileName(att.fileName)}
                                        {isDownloaded && (
                                            <span style={{marginLeft: '8px', fontSize: '0.7rem', color: '#a855f7'}}>
                                                <i className="fas fa-check-circle"></i>
                                            </span>
                                        )}
                                    </span>
                                    <span className="attachment-tooltip">{att.fileName}</span>
                                </div>
                                <span className="attachment-size">{formatFileSize(att.fileSize)}</span>
                            </div>
                            {/* Кнопка удаления ТОЛЬКО в режиме редактирования */}
                            {isEditMode && onDelete && (
                                <button
                                    type="button"
                                    className="btn btn--danger btn--small"
                                    onClick={() => handleDeleteClick(att.id)}
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                title="Удаление файла"
                message="Вы действительно хотите удалить этот файл? Это действие необратимо."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />

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