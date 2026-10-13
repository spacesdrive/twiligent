import { useRef, useState } from 'react';

function clearInput(inputRef) {
  if (inputRef.current) inputRef.current.value = '';
}

export function useSinglePostMedia() {
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const handleFileSelect = e => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setFilePreview(URL.createObjectURL(picked));
  };

  const handleCoverSelect = e => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setCoverFile(picked);
    setCoverPreview(URL.createObjectURL(picked));
  };

  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
    clearInput(fileInputRef);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    clearInput(coverInputRef);
  };

  return {
    file, filePreview, coverFile, coverPreview, fileInputRef, coverInputRef,
    handleFileSelect, handleCoverSelect, clearFile, clearCover,
  };
}
