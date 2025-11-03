import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import boostLogo from "@/assets/boost-logo.png";

const JumpingJacksCounter = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Modell wird geladen…");
  const [backendInfo, setBackendInfo] = useState("");
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"closed" | "open">("closed");
  const [feedback, setFeedback] = useState("Initialisiere…");
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);

  // Helper functions
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => 
    Math.hypot(a.x - b.x, a.y - b.y);

  const getKeypoint = (keypoints: any[], name: string) => 
    keypoints.find(k => k.name === name);

  const isReady = (k: any, threshold = 0.5) => 
    k && k.score > threshold;

  // Initialize TensorFlow backend
  const initBackend = async () => {
    try {
      await tf.setBackend("webgl");
      await tf.ready();
    } catch (e) {
      await tf.setBackend("cpu");
      await tf.ready();
    }
    setBackendInfo(`TFJS Backend: ${tf.getBackend()}`);
  };

  // Setup camera
  const setupCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera not supported by this browser.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      return new Promise((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve(true);
        }
      });
    }
  };

  // Load pose detection model
  const loadModel = async () => {
    const model = poseDetection.SupportedModels.MoveNet;
    const config = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };
    const det = await poseDetection.createDetector(model, config);
    setDetector(det);
  };

  // Draw keypoints and skeleton
  const drawKeypoints = (pose: any, ctx: CanvasRenderingContext2D) => {
    for (const kp of pose.keypoints) {
      if (kp.score > 0.5) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#10b981";
        ctx.fill();
      }
    }
  };

  const drawSkeleton = (pose: any, ctx: CanvasRenderingContext2D) => {
    const pairs = poseDetection.util.getAdjacentPairs(
      poseDetection.SupportedModels.MoveNet
    );
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    pairs.forEach(([a, b]: [number, number]) => {
      const k1 = pose.keypoints[a];
      const k2 = pose.keypoints[b];
      if (k1.score > 0.5 && k2.score > 0.5) {
        ctx.beginPath();
        ctx.moveTo(k1.x, k1.y);
        ctx.lineTo(k2.x, k2.y);
        ctx.stroke();
      }
    });
  };

  // Process jumping jack detection
  const processJumpingJack = (pose: any) => {
    const k = pose.keypoints;
    const ls = getKeypoint(k, "left_shoulder");
    const rs = getKeypoint(k, "right_shoulder");
    const la = getKeypoint(k, "left_ankle");
    const ra = getKeypoint(k, "right_ankle");
    const lw = getKeypoint(k, "left_wrist");
    const rw = getKeypoint(k, "right_wrist");
    const nose = getKeypoint(k, "nose");

    if (
      !(
        isReady(ls) &&
        isReady(rs) &&
        isReady(la) &&
        isReady(ra) &&
        isReady(lw) &&
        isReady(rw) &&
        isReady(nose)
      )
    ) {
      setFeedback("Position schlecht erkennbar – stell dich mittig hin.");
      return;
    }

    const shoulderWidth = Math.max(1, dist(ls, rs));
    const ankleDistNorm = dist(la, ra) / shoulderWidth;

    const wristsAboveHead = lw.y < nose.y && rw.y < nose.y;
    const wristsLow = lw.y > ls.y && rw.y > rs.y;

    const OPEN_LEGS = 1.2;
    const CLOSE_LEGS = 0.6;

    if (phase === "closed") {
      if (ankleDistNorm > OPEN_LEGS && wristsAboveHead) {
        setPhase("open");
        setFeedback("Oben – sauber!");
      } else {
        setFeedback("Arme hoch & Beine breiter!");
      }
    } else {
      if (ankleDistNorm < CLOSE_LEGS && wristsLow) {
        setPhase("closed");
        setCount((prev) => {
          const newCount = prev + 1;
          toast.success(`Jumping Jack ${newCount} gezählt!`);
          return newCount;
        });
        setFeedback("Super! Weiter so!");
      } else {
        setFeedback("Noch oben/weit!");
      }
    }
  };

  // Main detection loop
  const detectPose = async () => {
    if (!detector || !videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState !== 4) {
      requestAnimationFrame(detectPose);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const poses = await detector.estimatePoses(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (poses.length > 0) {
        const pose = poses[0];
        drawSkeleton(pose, ctx);
        drawKeypoints(pose, ctx);
        processJumpingJack(pose);
      }
    } catch (err) {
      console.error("Detection error:", err);
    }

    requestAnimationFrame(detectPose);
  };

  // Initialize everything
  useEffect(() => {
    const init = async () => {
      try {
        await initBackend();
        setLoadingMessage("Bitte Kamera erlauben…");
        await setupCamera();
        setLoadingMessage("Modell lädt…");
        await loadModel();
        setIsLoading(false);
        setFeedback("Bereit!");
      } catch (e) {
        const error = e as Error;
        setLoadingMessage(`Fehler: ${error.message}`);
        toast.error(`Fehler: ${error.message}`);
      }
    };
    init();
  }, []);

  // Start detection loop when detector is ready
  useEffect(() => {
    if (detector && !isLoading) {
      detectPose();
    }
  }, [detector, isLoading]);

  const handleReset = () => {
    setCount(0);
    setPhase("closed");
    setFeedback("Zurückgesetzt!");
    toast.info("Counter zurückgesetzt");
  };

  const handleFinish = () => {
    toast.success(`🎉 ${count} Jumping Jacks abgeschlossen!`);
    navigate("/challenge/daily");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/challenge/daily")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 pb-8">
        <h1 className="text-3xl font-bold mb-2 text-center">
          AI Jumping Jacks Counter
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          Stell dich zur Kamera, Füße zusammen, Arme seitlich – und los!
        </p>

        <Card className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px] gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div>
                <p className="font-semibold">{loadingMessage}</p>
                {backendInfo && (
                  <p className="text-sm text-muted-foreground">{backendInfo}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-[1fr_280px] gap-6">
              {/* Camera + Canvas */}
              <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full scale-x-[-1]"
                />
              </div>

              {/* Status Panel */}
              <div className="bg-card border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-bold text-center">Status</h2>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Count</p>
                  <p className="text-5xl font-bold text-primary">{count}</p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Phase</p>
                  <p className="text-xl font-bold text-accent uppercase">
                    {phase === "closed" ? "Geschlossen" : "Offen"}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Feedback</p>
                  <p className="text-sm font-semibold min-h-[40px]">
                    {feedback}
                  </p>
                </div>

                <div className="space-y-2">
                  <Button onClick={handleReset} variant="outline" className="w-full">
                    Reset
                  </Button>
                  <Button onClick={handleFinish} className="w-full">
                    Fertig
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default JumpingJacksCounter;
