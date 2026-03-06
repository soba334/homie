import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface FileUploadProps {
  accept: string;
  onFileSelect: (files: File[]) => void;
  multiple?: boolean;
  children?: ReactNode;
}

export function FileUpload({ accept, onFileSelect, multiple = false, children }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (fileList) {
      onFileSelect(Array.from(fileList));
    }
  }

  return (
    <motion.div
      animate={{
        borderColor: isDragging ? 'var(--color-primary)' : 'var(--color-outline)',
        backgroundColor: isDragging ? 'rgb(99 102 241 / 0.05)' : 'transparent',
      }}
      whileHover={{ borderColor: 'var(--color-primary-light)' }}
      transition={{ duration: 0.15 }}
      className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {children || (
        <div className="flex flex-col items-center gap-2 text-on-surface-variant">
          <Upload size={32} />
          <p>ファイルをドラッグ&ドロップ、またはクリックして選択</p>
        </div>
      )}
    </motion.div>
  );
}
