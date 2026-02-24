import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DetectionControls } from '../components/DetectionControls';
import { ShotOverlay } from '../components/ShotOverlay';
import { CAMERA_FRAME_SIZE, FRAME_INTERVAL_MS } from '../constants/camera';
import { Shot, ShotDetectionEngine } from '../shotDetection';

export default function TargetPracticeScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [shots, setShots] = useState<Shot[]>([]);
  const [running, setRunning] = useState(true);

  const engine = useMemo(
    () =>
      new ShotDetectionEngine({
        minArea: 60,
        minDistance: 18,
        diffThreshold: 48,
        minTimeBetweenShotsMs: 400,
      }),
    []
  );

  const processFrame = useCallback(async (frame: CameraCapturedPicture) => {
    if (!frame.base64 || !frame.width || !frame.height) {
      return;
    }

    setShots((current) => {
      const shot = engine.detect(
        {
          base64: frame.base64!,
          width: frame.width,
          height: frame.height,
          timestamp: Date.now(),
        },
        current
      );

      if (!shot) {
        return current;
      }

      return [...current, shot];
    });
  }, [engine]);

  useEffect(() => {
    if (!running || !permission?.granted) {
      return;
    }

    let active = true;
    let processing = false;

    const interval = setInterval(async () => {
      if (!active || !cameraRef.current || processing) {
        return;
      }

      processing = true;
      try {
        const frame = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.2,
          skipProcessing: true,
        });
        await processFrame(frame);
      } finally {
        processing = false;
      }
    }, FRAME_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [permission?.granted, processFrame, running]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Camera permission is required for automatic shot detection.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        ratio="4:3"
        pictureSize={`${CAMERA_FRAME_SIZE.width}x${CAMERA_FRAME_SIZE.height}`}
      />

      <ShotOverlay shots={shots} width={CAMERA_FRAME_SIZE.width} height={CAMERA_FRAME_SIZE.height} />

      <DetectionControls
        shotCount={shots.length}
        running={running}
        onToggleRunning={() => setRunning((value) => !value)}
        onReset={() => {
          engine.reset();
          setShots([]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  info: {
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1e88e5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
