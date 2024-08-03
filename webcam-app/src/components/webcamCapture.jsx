import { useState, useRef, useEffect } from 'react';
import { FaCameraRetro, FaSync, FaPowerOff, FaShapes } from 'react-icons/fa';
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

const WebcamCapture = () => {
  const [videoStream, setVideoStream] = useState(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentShape, setCurrentShape] = useState('circle');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [shapeSize, setShapeSize] = useState({ radius: 200, radiusX: 200, radiusY: 250 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';

      try {
        await tf.setBackend('webgl');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        console.log('Models loaded successfully');
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();

    return () => {
      faceapi.nets.ssdMobilenetv1.dispose();
      faceapi.nets.faceLandmark68Net.dispose();
      faceapi.nets.faceRecognitionNet.dispose();
    };
  }, []);

  useEffect(() => {
    const setupCamera = async () => {
      if (cameraOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: isFrontCamera ? 'user' : 'environment',
              width: { ideal: window.innerWidth },
              height: { ideal: window.innerHeight }
            }
          });
          setVideoStream(stream);
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(error => console.error('Play error:', error));
          };

          console.log('Camera setup successfully');
        } catch (err) {
          console.error('Error accessing the camera:', err);
        }
      } else {
        if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
        }
      }
    };

    setupCamera();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isFrontCamera, cameraOn]);

  useEffect(() => {
    const detectFace = async () => {
      if (cameraOn && videoRef.current && modelsLoaded) {
        try {
          const detections = await faceapi.detectAllFaces(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptors();

          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          context.clearRect(0, 0, canvas.width, canvas.height);

          if (detections.length > 0) {
            const { x, y, width, height } = detections[0].detection.box;
            context.strokeStyle = 'red';
            context.lineWidth = 2;
            context.strokeRect(x, y, width, height);

            const shape = {
              x: (canvas.width / 2) - shapeSize.radius,
              y: (canvas.height / 2) - shapeSize.radius,
              width: shapeSize.radius * 2,
              height: shapeSize.radius * 2
            };

            const faceInShape =
              x >= shape.x &&
              y >= shape.y &&
              x + width <= shape.x + shape.width &&
              y + height <= shape.y + shape.height;

            setFaceDetected(faceInShape);
          } else {
            setFaceDetected(false);
          }
        } catch (error) {
          console.error('Error during face detection:', error);
        }
      }
    };

    const interval = setInterval(detectFace, 500);

    return () => clearInterval(interval);
  }, [cameraOn, modelsLoaded, shapeSize]);

  useEffect(() => {
    const handleResize = () => {
      const minWidth = 150; // minimum size for the shape
      const maxWidth = 200; // maximum size for the shape
      const newRadius = Math.max(minWidth, Math.min(maxWidth, window.innerWidth * 0.1));
      setShapeSize({ radius: newRadius, radiusX: newRadius, radiusY: newRadius * 1.25 });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleCamera = () => {
    setCameraOn(!cameraOn);
  };

  const flipCamera = () => {
    setIsFrontCamera(!isFrontCamera);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const shapeCanvas = document.createElement('canvas');
    const shapeContext = shapeCanvas.getContext('2d');
    shapeCanvas.width = canvas.width;
    shapeCanvas.height = canvas.height;

    shapeContext.globalCompositeOperation = 'source-over';
    shapeContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
    if (currentShape === 'circle') {
      shapeContext.beginPath();
      shapeContext.arc(canvas.width / 2, canvas.height / 2, shapeSize.radius, 0, Math.PI * 2);
      shapeContext.fill();
    } else if (currentShape === 'rect') {
      shapeContext.fillRect(canvas.width / 2 - shapeSize.radius, canvas.height / 2 - shapeSize.radius, shapeSize.radius * 2);
    } else if (currentShape === 'ellipse') {
      shapeContext.beginPath();
      shapeContext.ellipse(canvas.width / 2, canvas.height / 2, shapeSize.radiusX, shapeSize.radiusY, 0, 0, Math.PI * 2);
      shapeContext.fill();
    }

    context.globalCompositeOperation = 'source-in';
    context.drawImage(shapeCanvas, 0, 0);

    const imageData = canvas.toDataURL('image/png');
    console.log('Captured photo:', imageData);
  };

  const handleShapeChange = () => {
    setCurrentShape(prevShape => {
      if (prevShape === 'circle') {
        setShapeSize({ radius: 155, radiusX: 155, radiusY: 205 });
        return 'rect';
      }
      if (prevShape === 'rect') {
        setShapeSize({ radius: 150, radiusX: 150, radiusY: 200 });
        return 'ellipse';
      }
      setShapeSize({ radius: 150, radiusX: 150, radiusY: 200 });
      return 'circle';
    });
  };

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center sm:w-fit">
      <video
        ref={videoRef}
        className={`relative h-full w-full object-cover sm:w-fit ${!cameraOn && 'hidden'}`}
      />
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full"
      />
      <div className="absolute w-[300px] h-[300px] flex items-center justify-center">
        {currentShape === 'circle' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${shapeSize.radius * 2}px`,
              height: `${shapeSize.radius * 2}px`,
              borderRadius: '50%',
              border: `5px ${faceDetected ? 'solid green' : 'solid red'}`,
              pointerEvents: 'none'
            }}
          />
        )}
        {currentShape === 'rect' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${shapeSize.radius * 2}px`,
              height: `${shapeSize.radius * 2}px`,
              borderRadius: '0%',
              border: `5px ${faceDetected ? 'solid green' : 'solid red'}`,
              pointerEvents: 'none'
            }}
          />
        )}
        {currentShape === 'ellipse' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${shapeSize.radiusX * 2}px`,
              height: `${shapeSize.radiusY * 2}px`,
              borderRadius: '50%',
              border: `5px ${faceDetected ? 'solid green' : 'solid red'}`,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
      <div className="absolute bottom-5 flex space-x-2">
        <button
          onClick={capturePhoto}
          className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          <FaCameraRetro size={24} />
        </button>
        <button
          onClick={handleShapeChange}
          className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          <FaShapes size={24} />
        </button>
        <button
          onClick={flipCamera}
          className="p-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
        >
          <FaSync size={24} />
        </button>
        <button
          onClick={toggleCamera}
          className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          <FaPowerOff size={24} />
        </button>
      </div>
    </div>
  );
};

export default WebcamCapture;
