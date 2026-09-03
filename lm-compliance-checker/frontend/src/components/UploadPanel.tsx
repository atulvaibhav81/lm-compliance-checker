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
    <div className="glass-card animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div className="tab-container">
        <button 
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <ImageIcon size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
          File Upload
        </button>
        <button 
          className={`tab-button ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => { setActiveTab('camera'); startCamera(); }}
        >
          <Camera size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
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
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleChange}
          />
          
          {selectedFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <FileImage size={56} className="upload-icon" style={{ transform: 'none' }} />
              </div>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFile.name}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setSelectedFile(null)}
                disabled={isScanning}
              >
                <X size={16} /> Remove File
              </button>
            </div>
          ) : (
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <UploadCloud size={52} className="upload-icon" />
              <div>
                <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px', textAlign: 'center' }}>Drag &amp; Drop Packaging Image Here</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>or click to browse · JPEG, PNG, WebP · Max 10 MB</p>
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
        <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', textAlign: 'center', background: 'var(--danger-bg)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)' }}>
          {errorMsg}
        </div>
      )}

      <button
        className="btn"
        onClick={() => selectedFile && onScan(selectedFile)}
        disabled={!selectedFile || isScanning}
        style={{ padding: '14px 24px', fontSize: '1rem', justifyContent: 'center', marginTop: '8px' }}
      >
        {isScanning ? (
          <><div className="loader"></div> Analysing Integrity…</>
        ) : (
          <><ShieldCheck size={18} style={{ color: '#E3F0A3' }} /> Scan Package Label</>
        )}
      </button>

      {/* Demo Mode */}
      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '14px', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Demo Sample Data
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button 
            className="btn btn-secondary" 
            style={{ flex: 1, fontSize: '0.9rem' }}
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
            className="btn btn-secondary" 
            style={{ flex: 1, fontSize: '0.9rem' }}
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
