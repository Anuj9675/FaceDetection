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
  const [shapePosition, setShapePosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
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
              x: shapePosition.x - shapeSize.radius,
              y: shapePosition.y - shapeSize.radius,
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
  }, [cameraOn, modelsLoaded, shapePosition, shapeSize]);

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
      shapeContext.arc(shapePosition.x, shapePosition.y, shapeSize.radius, 0, Math.PI * 2);
      shapeContext.fill();
    } else if (currentShape === 'rect') {
      shapeContext.fillRect(shapePosition.x - shapeSize.radius, shapePosition.y - shapeSize.radius, shapeSize.radius * 2, shapeSize.radius * 2);
    } else if (currentShape === 'ellipse') {
      shapeContext.beginPath();
      shapeContext.ellipse(shapePosition.x, shapePosition.y, shapeSize.radiusX, shapeSize.radiusY, 0, 0, Math.PI * 2);
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
        setShapeSize({ radius: 175, radiusX: 175, radiusY: 225 });
        return 'rect';
      }
      if (prevShape === 'rect') {
        setShapeSize({ radius: 175, radiusX: 175, radiusY: 225 });
        return 'ellipse';
      }
      setShapeSize({ radius: 175, radiusX: 175, radiusY: 225 });
      return 'circle';
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900 flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        className={`absolute top-0 left-0 w-full h-full object-cover ${!cameraOn && 'hidden'}`}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
      <div className="absolute top-0 left-0 w-full h-full">
        {currentShape === 'circle' && (
          <div
            style={{
              position: 'absolute',
              top: `${shapePosition.y - shapeSize.radius}px`,
              left: `${shapePosition.x - shapeSize.radius}px`,
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
              top: `${shapePosition.y - shapeSize.radius}px`,
              left: `${shapePosition.x - shapeSize.radius}px`,
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
              top: `${shapePosition.y - shapeSize.radiusY}px`,
              left: `${shapePosition.x - shapeSize.radiusX}px`,
              width: `${shapeSize.radiusX * 2}px`,
              height: `${shapeSize.radiusY * 2}px`,
              borderRadius: '50%',
              border: `5px ${faceDetected ? 'solid green' : 'solid red'}`,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full flex justify-center gap-4 p-4">
        <button
          onClick={capturePhoto}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <FaCameraRetro />
          
        </button>
        <button
          onClick={handleShapeChange}
          className="bg-yellow-500 text-white py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <FaShapes />
          
        </button>
        <button
          onClick={toggleCamera}
          className={`bg-${cameraOn ? 'red' : 'green'}-500 text-white py-2 px-4 rounded-lg flex items-center gap-2`}
        >
          <FaPowerOff />
          {cameraOn ? 'Turn Off' : 'Turn On'}
        </button>
        <button
          onClick={flipCamera}
          className="bg-purple-500 text-white py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <FaSync />
        
        </button>
      </div>
    </div>
  );
};

export default WebcamCapture;
