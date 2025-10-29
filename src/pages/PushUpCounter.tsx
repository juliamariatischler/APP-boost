import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, CameraOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";

export default function PushUpCounter() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const isDownRef = useRef(false);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const initializePoseDetection = async () => {
    try {
      setIsLoading(true);
      await tf.ready();
      
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      
      const poseDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        detectorConfig
      );
      
      setDetector(poseDetector);
      toast.success("Pose Erkennung geladen!");
      return poseDetector;
    } catch (error) {
      console.error("Error initializing pose detection:", error);
      toast.error("Fehler beim Laden der Pose Erkennung");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setIsLoading(true);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
      }

      setStream(mediaStream);
      
      let poseDetector = detector;
      if (!poseDetector) {
        poseDetector = await initializePoseDetection();
      }
      
      if (poseDetector) {
        setIsActive(true);
        detectPose(poseDetector);
        toast.success("Kamera gestartet! Beginne mit den Liegestützen!");
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Kamera-Zugriff verweigert");
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsActive(false);
  };

  const detectPose = async (poseDetector: poseDetection.PoseDetector) => {
    if (!videoRef.current || !canvasRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detect = async () => {
      if (!isActive || !video || video.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const poses = await poseDetector.estimatePoses(video);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (poses.length > 0) {
          const pose = poses[0];
          drawKeypoints(ctx, pose.keypoints);
          analyzePushUp(pose.keypoints);
        }
      } catch (error) {
        console.error("Error detecting pose:", error);
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  const drawKeypoints = (
    ctx: CanvasRenderingContext2D,
    keypoints: poseDetection.Keypoint[]
  ) => {
    keypoints.forEach((keypoint) => {
      if (keypoint.score && keypoint.score > 0.3) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#00ff00";
        ctx.fill();
      }
    });
  };

  const analyzePushUp = (keypoints: poseDetection.Keypoint[]) => {
    const leftShoulder = keypoints.find((kp) => kp.name === "left_shoulder");
    const rightShoulder = keypoints.find((kp) => kp.name === "right_shoulder");
    const leftElbow = keypoints.find((kp) => kp.name === "left_elbow");
    const rightElbow = keypoints.find((kp) => kp.name === "right_elbow");
    const leftWrist = keypoints.find((kp) => kp.name === "left_wrist");
    const rightWrist = keypoints.find((kp) => kp.name === "right_wrist");

    if (
      !leftShoulder || !rightShoulder ||
      !leftElbow || !rightElbow ||
      !leftWrist || !rightWrist
    ) return;

    const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const avgWristY = (leftWrist.y + rightWrist.y) / 2;

    const elbowBend = avgElbowY - avgShoulderY;
    const isDown = elbowBend > 30 && avgWristY < avgShoulderY;

    if (isDown && !isDownRef.current) {
      isDownRef.current = true;
    } else if (!isDown && isDownRef.current) {
      isDownRef.current = false;
      setCount((prev) => prev + 1);
      toast.success("Liegestütz gezählt!");
    }
  };

  const handleComplete = () => {
    stopCamera();
    toast.success(`${count} Liegestütze abgeschlossen!`);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopCamera();
              navigate(-1);
            }}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Liegestütz-Zähler</h1>
        </div>

        <Card className="p-6 mb-6">
          <div className="text-center mb-4">
            <h2 className="text-6xl font-bold text-primary mb-2">{count}</h2>
            <p className="text-muted-foreground">Liegestütze</p>
          </div>

          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto hidden"
            />
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: "60vh" }}
            />
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white text-lg">Kamera nicht aktiv</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!isActive ? (
              <Button
                onClick={startCamera}
                disabled={isLoading}
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                {isLoading ? "Wird geladen..." : "Kamera starten"}
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="destructive"
                className="flex-1"
              >
                <CameraOff className="mr-2 h-4 w-4" />
                Kamera stoppen
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-foreground">Anleitung:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Kamera starten und Position einnehmen</li>
              <li>• Stelle sicher, dass dein Oberkörper sichtbar ist</li>
              <li>• Führe Liegestütze aus - sie werden automatisch gezählt</li>
              <li>• Ziel: 20 Liegestütze</li>
            </ul>
          </Card>

          {count >= 20 && (
            <Button onClick={handleComplete} className="w-full" size="lg">
              Challenge abschließen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
