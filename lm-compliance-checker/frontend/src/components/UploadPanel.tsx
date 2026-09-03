import React, { useCallback, useState, useRef, useEffect } from 'react';
import { UploadCloud, FileImage, ShieldCheck, Camera, Image as ImageIcon, X } from 'lucide-react';

interface UploadPanelProps {
  onScan: (file: File) => Promise<void>;
  isScanning: boolean;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onScan, isScanning }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera when unmounting or switching tabs
  useEffect(() => {
    return () => stopCamera();
  }, [activeTab]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setErrorMsg('Could not access camera. Please allow permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
          setSelectedFile(file);
          stopCamera();
          setActiveTab('upload');
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const validateFile = (file: File): boolean => {
    setErrorMsg(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File is too large. Maximum size is 10MB.');
      return false;
    }
    return true;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (validateFile(e.dataTransfer.files[0])) setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (validateFile(e.target.files[0])) setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="glass-card animate-fade-in flex flex-col gap-5 p-5 md:p-6 w-full">
      
      <div className="tab-container flex flex-wrap gap-1">
        <button 
          className={`tab-button flex-1 sm:flex-none ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <ImageIcon size={18} className="inline mr-2 align-text-bottom" />
          File Upload
        </button>
        <button 
          className={`tab-button flex-1 sm:flex-none ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => { setActiveTab('camera'); startCamera(); }}
        >
          <Camera size={18} className="inline mr-2 align-text-bottom" />
          Live Camera
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div 
          className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            accept="image/*"
            onChange={handleChange}
          />
          
          {selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <FileImage size={56} className="upload-icon !transform-none" />
              </div>
              <p className="font-semibold text-[var(--text-primary)] text-center break-all">{selectedFile.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <button 
                className="btn btn-secondary mt-4 flex items-center gap-2"
                onClick={() => setSelectedFile(null)}
                disabled={isScanning}
              >
                <X size={16} /> Remove File
              </button>
            </div>
          ) : (
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3.5">
              <UploadCloud size={52} className="upload-icon" />
              <div>
                <h3 className="font-[family-name:var(--font-body)] text-base md:text-[1.1rem] font-bold text-[var(--text-primary)] mb-1 text-center">Drag & Drop Packaging Image Here</h3>
                <p className="text-[var(--text-muted)] text-xs md:text-sm text-center px-4">or click to browse · JPEG, PNG, WebP · Max 10 MB</p>
              </div>
            </label>
          )}
        </div>
      ) : (
        <div className="viewfinder-container">
          <video ref={videoRef} autoPlay playsInline className="viewfinder-video" />
          {cameraActive && <div className="laser-line" />}
          <div className="camera-controls">
            {!cameraActive ? (
              <button className="btn btn-secondary" onClick={startCamera}>Start Camera</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={stopCamera}>Stop</button>
                <button className="shutter-btn" onClick={capturePhoto} aria-label="Take Photo" />
              </>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="text-[var(--danger)] font-[family-name:var(--font-body)] text-sm text-center bg-[var(--danger-bg)] py-3 px-4 rounded-[var(--radius-md)] border border-[var(--danger-border)]">
          {errorMsg}
        </div>
      )}

      <button
        className="btn justify-center w-full py-3.5 text-base mt-2"
        onClick={() => selectedFile && onScan(selectedFile)}
        disabled={!selectedFile || isScanning}
      >
        {isScanning ? (
          <><div className="loader"></div> Analysing Integrity…</>
        ) : (
          <><ShieldCheck size={18} className="text-[#E3F0A3]" /> Scan Package Label</>
        )}
      </button>

      {/* Demo Mode */}
      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <p className="font-[family-name:var(--font-body)] text-[11px] font-bold text-[var(--text-muted)] mb-3.5 text-center tracking-widest uppercase">
          Demo Sample Data
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            className="btn btn-secondary flex-1 text-sm justify-center py-2.5" 
            disabled={isScanning}
            onClick={async () => {
              const res = await fetch('/samples/sample_1_perfect.png');
              const blob = await res.blob();
              const file = new File([blob], 'sample_1_perfect.png', { type: 'image/png' });
              setSelectedFile(file);
              setActiveTab('upload');
            }}
          >
            Load Perfect Label
          </button>
          <button 
            className="btn btn-secondary flex-1 text-sm justify-center py-2.5" 
            disabled={isScanning}
            onClick={async () => {
              const res = await fetch('/samples/sample_2_failed.png');
              const blob = await res.blob();
              const file = new File([blob], 'sample_2_failed.png', { type: 'image/png' });
              setSelectedFile(file);
              setActiveTab('upload');
            }}
          >
            Load Faulty Label
          </button>
        </div>
      </div>
    </div>
  );
};
