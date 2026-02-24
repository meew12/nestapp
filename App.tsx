import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Shot, ShotDetectionEngine } from './src/shotDetection/ShotDetectionEngine';

const FRAME_INTERVAL_MS = 300;
const CAMERA_FRAME_SIZE = { width: 320, height: 240 };

export default function App() {
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
      }),
    []
  );

  const processFrame = useCallback(
    async (frame: CameraCapturedPicture) => {
      if (!frame.base64 || !frame.width || !frame.height) {
        return;
      }

      const shot = engine.detect(
        {
          base64: frame.base64,
          width: frame.width,
          height: frame.height,
          timestamp: Date.now(),
        },
        shots
      );

      if (!shot) {
        return;
      }

      setShots((current) => [...current, shot]);
    },
    [engine, shots]
  );

  useEffect(() => {
    if (!running || !permission?.granted) {
      return;
    }

    let active = true;
    const interval = setInterval(async () => {
      if (!active || !cameraRef.current) {
        return;
      }

      const frame = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
      });
      await processFrame(frame);
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

  const latestShotId = shots.length ? shots[shots.length - 1].id : null;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        ratio="4:3"
        pictureSize={`${CAMERA_FRAME_SIZE.width}x${CAMERA_FRAME_SIZE.height}`}
      />

      <Svg pointerEvents="none" style={styles.overlay} viewBox={`0 0 ${CAMERA_FRAME_SIZE.width} ${CAMERA_FRAME_SIZE.height}`}>
        {shots.map((shot) => (
          <Circle
            key={shot.id}
            cx={shot.x}
            cy={shot.y}
            r={6}
            fill={shot.id === latestShotId ? '#FF0000' : '#1E66F5'}
          />
        ))}
      </Svg>

      <View style={styles.controls}>
        <Text style={styles.info}>Shots: {shots.length}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setRunning((value) => !value);
          }}
        >
          <Text style={styles.buttonText}>{running ? 'Pause detection' : 'Resume detection'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            engine.reset();
            setShots([]);
          }}
        >
          <Text style={styles.buttonText}>Reset shots</Text>
        </TouchableOpacity>
      </View>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    gap: 8,
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
