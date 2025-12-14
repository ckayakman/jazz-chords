/// <reference types="vite/client" />

interface Window {
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
}
