import Svg, { Circle } from 'react-native-svg';
import { SHOT_MARKER } from '../constants/camera';
import { Shot } from '../shotDetection';

type ShotOverlayProps = {
  shots: Shot[];
  width: number;
  height: number;
};

export function ShotOverlay({ shots, width, height }: ShotOverlayProps) {
  const latestShotId = shots.length > 0 ? shots[shots.length - 1].id : null;

  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', inset: 0 }} viewBox={`0 0 ${width} ${height}`}>
      {shots.map((shot) => (
        <Circle
          key={shot.id}
          cx={shot.x}
          cy={shot.y}
          r={SHOT_MARKER.radius}
          fill={shot.id === latestShotId ? SHOT_MARKER.latestColor : SHOT_MARKER.historyColor}
        />
      ))}
    </Svg>
  );
}
