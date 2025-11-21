import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhotoCapture as PhotoCaptureType, PhotoAnnotation } from '../types/field';
import { v4 as uuidv4 } from 'uuid';

interface PhotoCaptureProps {
  onPhotoComplete: (photo: PhotoCaptureType) => void;
  onCancel: () => void;
  projectId: string;
  initialLocation?: string;
}

/**
 * PhotoCapture Component
 * 
 * Provides photo capture functionality using device camera with fallback to file upload,
 * annotation capabilities, and mock AI-powered caption generation
 */
const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoComplete,
  onCancel,
  projectId,
  initialLocation = 'Main construction area'
}) => {
  // State
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload' | 'preview' | 'annotate' | 'processing' | 'complete'>('camera');
  const [cameraAvailable, setCameraAvailable] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [aiGeneratedCaption, setAiGeneratedCaption] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<PhotoAnnotation | null>(null);
  const [annotationMode, setAnnotationMode] = useState<'text' | 'arrow' | 'rectangle' | 'circle' | 'freeform' | null>(null);
  const [location, setLocation] = useState<string>(initialLocation);
  const [tags, setTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Check camera availability
  useEffect(() => {
    const checkCameraAvailability = async () => {
      try {
        // Check if the browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraAvailable(false);
          setCameraError('Camera access is not supported in this browser.');
          setCaptureMode('upload');
          return;
        }
        
        // Try to access the camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStreamRef.current = stream;
        setCameraAvailable(true);
        
        // If we have a video element, set up the stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Camera access error:', error);
        setCameraAvailable(false);
        setCameraError(`Camera access denied: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setCaptureMode('upload');
      }
    };
    
    checkCameraAvailability();
    
    // Cleanup function to stop the camera stream
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Handle camera capture
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImageDataUrl(dataUrl);
        
        // Stop the camera stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Switch to preview mode
        setCaptureMode('preview');
      }
    }
  }, []);
  
  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      // Read the file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImageDataUrl(dataUrl);
        setCaptureMode('preview');
      };
      reader.readAsDataURL(file);
    }
  }, []);
  
  // Handle retake photo
  const handleRetake = useCallback(() => {
    setImageDataUrl(null);
    setAnnotations([]);
    setCurrentAnnotation(null);
    setAnnotationMode(null);
    
    // If camera was available, restart it
    if (cameraAvailable) {
      setCaptureMode('camera');
      
      // Restart camera stream
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(error => {
          console.error('Failed to restart camera:', error);
          setCameraAvailable(false);
          setCameraError(`Failed to restart camera: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setCaptureMode('upload');
        });
    } else {
      setCaptureMode('upload');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [cameraAvailable]);
  
  // Handle proceed to annotation
  const handleProceedToAnnotate = useCallback(() => {
    setCaptureMode('annotate');
    
    // Initialize annotation canvas
    if (annotationCanvasRef.current && imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        if (annotationCanvasRef.current) {
          annotationCanvasRef.current.width = img.width;
          annotationCanvasRef.current.height = img.height;
          
          // Draw existing annotations
          drawAnnotations();
        }
      };
      img.src = imageDataUrl;
    }
  }, [imageDataUrl]);
  
  // Handle annotation mode selection
  const selectAnnotationMode = useCallback((mode: 'text' | 'arrow' | 'rectangle' | 'circle' | 'freeform' | null) => {
    setAnnotationMode(mode);
    setCurrentAnnotation(null);
  }, []);
  
  // Handle annotation canvas mouse events
  const handleAnnotationStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotationMode || !annotationCanvasRef.current) return;
    
    const canvas = annotationCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Create a new annotation based on the selected mode
    const newAnnotation: PhotoAnnotation = {
      id: uuidv4(),
      type: annotationMode,
      coordinates: [[x, y]],
      color: '#FF0000', // Default to red
      text: annotationMode === 'text' ? 'Text annotation' : undefined
    };
    
    setCurrentAnnotation(newAnnotation);
    
    // For text annotations, immediately add them
    if (annotationMode === 'text') {
      const text = prompt('Enter text annotation:', 'Text annotation');
      if (text) {
        newAnnotation.text = text;
        setAnnotations([...annotations, newAnnotation]);
        drawAnnotations();
      }
    }
  }, [annotationMode, annotations]);
  
  const handleAnnotationMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentAnnotation || !annotationCanvasRef.current) return;
    
    // Skip for text annotations as they're added immediately
    if (currentAnnotation.type === 'text') return;
    
    const canvas = annotationCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Update the current annotation based on the mode
    let updatedCoordinates = [...currentAnnotation.coordinates];
    
    switch (currentAnnotation.type) {
      case 'arrow':
        // For arrows, we just need start and end points
        if (updatedCoordinates.length === 1) {
          updatedCoordinates.push([x, y]);
        } else {
          updatedCoordinates[1] = [x, y];
        }
        break;
        
      case 'rectangle':
        // For rectangles, we need diagonal corners
        if (updatedCoordinates.length === 1) {
          updatedCoordinates.push([x, y]);
        } else {
          updatedCoordinates[1] = [x, y];
        }
        break;
        
      case 'circle':
        // For circles, we need center and radius point
        if (updatedCoordinates.length === 1) {
          updatedCoordinates.push([x, y]);
        } else {
          updatedCoordinates[1] = [x, y];
        }
        break;
        
      case 'freeform':
        // For freeform, we add each point
        updatedCoordinates.push([x, y]);
        break;
    }
    
    setCurrentAnnotation({
      ...currentAnnotation,
      coordinates: updatedCoordinates
    });
    
    // Redraw annotations
    drawAnnotations();
  }, [currentAnnotation]);
  
  const handleAnnotationEnd = useCallback(() => {
    if (!currentAnnotation) return;
    
    // Skip for text annotations as they're added immediately
    if (currentAnnotation.type === 'text') return;
    
    // Add the completed annotation to the list
    setAnnotations([...annotations, currentAnnotation]);
    setCurrentAnnotation(null);
  }, [currentAnnotation, annotations]);
  
  // Draw annotations on the canvas
  const drawAnnotations = useCallback(() => {
    if (!annotationCanvasRef.current || !imageDataUrl) return;
    
    const canvas = annotationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw all saved annotations
      annotations.forEach(annotation => {
        drawAnnotation(ctx, annotation);
      });
      
      // Draw the current annotation being created
      if (currentAnnotation) {
        drawAnnotation(ctx, currentAnnotation);
      }
    };
    img.src = imageDataUrl;
  }, [annotations, currentAnnotation, imageDataUrl]);
  
  // Helper function to draw a single annotation
  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: PhotoAnnotation) => {
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = 3;
    
    switch (annotation.type) {
      case 'text':
        if (annotation.text && annotation.coordinates.length > 0) {
          const [x, y] = annotation.coordinates[0];
          ctx.font = '16px Arial';
          ctx.fillText(annotation.text, x, y);
        }
        break;
        
      case 'arrow':
        if (annotation.coordinates.length >= 2) {
          const [startX, startY] = annotation.coordinates[0];
          const [endX, endY] = annotation.coordinates[1];
          
          // Draw the line
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Draw the arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLength = 15;
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        break;
        
      case 'rectangle':
        if (annotation.coordinates.length >= 2) {
          const [startX, startY] = annotation.coordinates[0];
          const [endX, endY] = annotation.coordinates[1];
          
          ctx.beginPath();
          ctx.rect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
          );
          ctx.stroke();
        }
        break;
        
      case 'circle':
        if (annotation.coordinates.length >= 2) {
          const [centerX, centerY] = annotation.coordinates[0];
          const [radiusX, radiusY] = annotation.coordinates[1];
          
          const radius = Math.sqrt(
            Math.pow(radiusX - centerX, 2) + Math.pow(radiusY - centerY, 2)
          );
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;
        
      case 'freeform':
        if (annotation.coordinates.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(annotation.coordinates[0][0], annotation.coordinates[0][1]);
          
          for (let i = 1; i < annotation.coordinates.length; i++) {
            ctx.lineTo(annotation.coordinates[i][0], annotation.coordinates[i][1]);
          }
          
          ctx.stroke();
        }
        break;
    }
  };
  
  // Update the canvas when annotations change
  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations]);
  
  // Handle caption change
  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCaption(e.target.value);
  };
  
  // Handle location change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
  };
  
  // Handle tag input
  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };
  
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  // Generate AI caption
  const generateAICaption = useCallback(() => {
    setIsProcessing(true);
    
    // Simulate AI processing delay
    setTimeout(() => {
      // Mock AI caption generation based on tags and location
      const constructionTerms = [
        'structural framework',
        'foundation work',
        'steel reinforcement',
        'concrete pouring',
        'masonry installation',
        'electrical conduit',
        'plumbing fixtures',
        'HVAC ductwork',
        'insulation materials',
        'drywall installation',
        'exterior cladding',
        'roofing system',
        'window installation',
        'flooring preparation',
        'safety barriers'
      ];
      
      const progressTerms = [
        'in progress',
        'completed',
        'being installed',
        'under construction',
        'being prepared',
        'being assembled',
        'being inspected'
      ];
      
      // Pick random terms
      const constructionTerm = constructionTerms[Math.floor(Math.random() * constructionTerms.length)];
      const progressTerm = progressTerms[Math.floor(Math.random() * progressTerms.length)];
      
      // Generate caption
      const aiCaption = `${constructionTerm} ${progressTerm} at ${location}`;
      setAiGeneratedCaption(aiCaption);
      
      // If user hasn't entered a caption, use the AI one
      if (!caption) {
        setCaption(aiCaption);
      }
      
      // Generate suggested tags based on the caption
      const suggestedTagsList = [
        constructionTerm.split(' ')[0],
        progressTerm.split(' ')[0],
        location.split(' ')[0],
        'construction',
        'project',
        'documentation'
      ].filter(tag => !tags.includes(tag));
      
      setSuggestedTags(suggestedTagsList);
      
      setIsProcessing(false);
    }, 1500);
  }, [location, caption, tags]);
  
  // Complete the photo capture process
  const handleComplete = useCallback(() => {
    if (!imageDataUrl) return;
    
    // Create the final annotated image
    let finalImageUrl = imageDataUrl;
    
    if (annotationCanvasRef.current && annotations.length > 0) {
      finalImageUrl = annotationCanvasRef.current.toDataURL('image/jpeg', 0.8);
    }
    
    // Create the photo object
    const photo: PhotoCaptureType = {
      id: uuidv4(),
      timestamp: new Date(),
      uri: finalImageUrl,
      thumbnail: finalImageUrl, // In a real app, we'd generate a smaller thumbnail
      location: {
        latitude: 40.7128, // Mock NYC coordinates
        longitude: -74.0060,
        accuracy: 10,
        // Parse floor from location if possible
        floor: location.match(/floor\s+(\d+)/i) ? 
               parseInt(location.match(/floor\s+(\d+)/i)![1]) : 
               undefined,
        building: location.includes('building') ? location : undefined,
        room: location.includes('room') ? location : undefined
      },
      annotations: annotations,
      tags: tags,
      caption: caption || (aiGeneratedCaption || `Photo at ${location}`),
      aiGeneratedCaption: aiGeneratedCaption
    };
    
    // Notify parent component
    onPhotoComplete(photo);
    
    // Reset state
    setCaptureMode('complete');
  }, [imageDataUrl, annotations, caption, aiGeneratedCaption, location, tags, onPhotoComplete]);
  
  // Render based on capture mode
  return (
    <div className="photo-capture-container bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Photo Capture</h3>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Camera mode */}
        {captureMode === 'camera' && (
          <div className="flex flex-col items-center space-y-4">
            {cameraError && (
              <div className="text-red-500 text-sm bg-red-50 p-2 rounded w-full">
                {cameraError}
              </div>
            )}
            
            <div className="relative w-full max-w-md bg-black rounded-lg overflow-hidden">
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
              
              <canvas 
                ref={canvasRef}
                className="hidden" // Hidden canvas for capturing the image
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={capturePhoto}
                className="field-action-button bg-primary-600"
                aria-label="Capture photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <button
                onClick={() => setCaptureMode('upload')}
                className="field-action-button bg-gray-600"
                aria-label="Switch to upload"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Upload mode */}
        {captureMode === 'upload' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              
              <p className="text-sm text-gray-500 mb-4">
                Drag and drop an image here, or click to select a file
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
              />
              
              <label
                htmlFor="photo-upload"
                className="btn btn-primary cursor-pointer"
              >
                Select Image
              </label>
            </div>
            
            {cameraAvailable && (
              <button
                onClick={() => setCaptureMode('camera')}
                className="btn btn-secondary"
              >
                Switch to Camera
              </button>
            )}
          </div>
        )}
        
        {/* Preview mode */}
        {captureMode === 'preview' && imageDataUrl && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md bg-black rounded-lg overflow-hidden">
              <img 
                src={imageDataUrl} 
                alt="Captured" 
                className="w-full h-auto"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleRetake}
                className="btn btn-secondary"
              >
                Retake
              </button>
              
              <button
                onClick={handleProceedToAnnotate}
                className="btn btn-primary"
              >
                Use Photo
              </button>
            </div>
          </div>
        )}
        
        {/* Annotate mode */}
        {captureMode === 'annotate' && imageDataUrl && (
          <div className="flex flex-col space-y-4">
            {/* Annotation tools */}
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => selectAnnotationMode('text')}
                className={`p-2 rounded ${annotationMode === 'text' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}
                title="Text"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </button>
              
              <button
                onClick={() => selectAnnotationMode('arrow')}
                className={`p-2 rounded ${annotationMode === 'arrow' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}
                title="Arrow"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              
              <button
                onClick={() => selectAnnotationMode('rectangle')}
                className={`p-2 rounded ${annotationMode === 'rectangle' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}
                title="Rectangle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              
              <button
                onClick={() => selectAnnotationMode('circle')}
                className={`p-2 rounded ${annotationMode === 'circle' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}
                title="Circle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              <button
                onClick={() => selectAnnotationMode('freeform')}
                className={`p-2 rounded ${annotationMode === 'freeform' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}
                title="Freeform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              
              <button
                onClick={() => setAnnotations([])}
                className="p-2 rounded bg-red-100 text-red-800 ml-auto"
                title="Clear All"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            {/* Annotation canvas */}
            <div className="w-full max-w-md bg-black rounded-lg overflow-hidden">
              <canvas
                ref={annotationCanvasRef}
                onMouseDown={handleAnnotationStart}
                onMouseMove={handleAnnotationMove}
                onMouseUp={handleAnnotationEnd}
                onMouseLeave={handleAnnotationEnd}
                className="w-full h-auto cursor-crosshair"
              />
            </div>
            
            {/* Caption and metadata */}
            <div className="w-full space-y-3">
              <div>
                <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-1">
                  Caption
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="caption"
                    value={caption}
                    onChange={handleCaptionChange}
                    placeholder="Enter a caption for this photo"
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  <button
                    onClick={generateAICaption}
                    disabled={isProcessing}
                    className="btn btn-secondary flex items-center"
                  >
                    {isProcessing ? (
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    AI Caption
                  </button>
                </div>
                
                {aiGeneratedCaption && (
                  <div className="mt-1 text-sm text-gray-500">
                    AI suggestion: {aiGeneratedCaption}
                  </div>
                )}
              </div>
              
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={handleLocationChange}
                  placeholder="Enter the location"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1.5 inline-flex text-blue-400 hover:text-blue-600 focus:outline-none"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                
                {suggestedTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500">Suggested tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestedTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleAddTag(tag)}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Add a tag"
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTag(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Add a tag"]') as HTMLInputElement;
                      if (input && input.value) {
                        handleAddTag(input.value);
                        input.value = '';
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => setCaptureMode('preview')}
                className="btn btn-secondary"
              >
                Back
              </button>
              
              <button
                onClick={handleComplete}
                className="btn btn-primary"
              >
                Complete
              </button>
            </div>
          </div>
        )}
        
        {/* Processing mode */}
        {captureMode === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <svg className="animate-spin h-10 w-10 text-primary-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg text-primary-700">Processing your photo...</p>
          </div>
        )}
        
        {/* Complete mode */}
        {captureMode === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Photo Captured Successfully</h4>
            <p className="text-gray-500 mb-4">Your photo has been added to the field report.</p>
            <button
              onClick={onCancel}
              className="btn btn-primary"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoCapture;
