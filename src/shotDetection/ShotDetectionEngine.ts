import * as base64js from 'base64-js';
import jpeg from 'jpeg-js';

export type Point = { x: number; y: number };

export type Shot = Point & {
  id: number;
  timestamp: number;
};

export type DetectionConfig = {
  diffThreshold: number;
  darkThreshold: number;
  minArea: number;
  minDistance: number;
  minTimeBetweenShotsMs: number;
};

export type FrameInput = {
  base64: string;
  width: number;
  height: number;
  timestamp: number;
};

const DEFAULT_CONFIG: DetectionConfig = {
  diffThreshold: 45,
  darkThreshold: 65,
  minArea: 50,
  minDistance: 20,
  minTimeBetweenShotsMs: 450,
};

export class ShotDetectionEngine {
  private previousGray: Uint8Array | null = null;
  private readonly config: DetectionConfig;
  private lastShotTimestamp = 0;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset() {
    this.previousGray = null;
    this.lastShotTimestamp = 0;
  }

  // Prepared for future OpenCV integration: keep a stable detect() API.
  detect(frame: FrameInput, existingShots: Shot[]): Shot | null {
    const gray = this.decodeToGray(frame.base64);
    if (!gray) {
      return null;
    }

    if (!this.previousGray || this.previousGray.length !== gray.length) {
      this.previousGray = gray;
      return null;
    }

    const diffMask = new Uint8Array(gray.length);
    let totalDiff = 0;

    for (let i = 0; i < gray.length; i += 1) {
      const diff = this.previousGray[i] - gray[i];
      const isNewDarkPixel = diff > this.config.diffThreshold && gray[i] < this.config.darkThreshold;
      if (isNewDarkPixel) {
        diffMask[i] = 1;
        totalDiff += 1;
      }
    }

    this.previousGray = gray;

    if (totalDiff < this.config.minArea) {
      return null;
    }

    const center = this.estimateCenter(diffMask, frame.width, frame.height);
    if (!center) {
      return null;
    }


    if (frame.timestamp - this.lastShotTimestamp < this.config.minTimeBetweenShotsMs) {
      return null;
    }

    const tooClose = existingShots.some((shot) => {
      const dx = shot.x - center.x;
      const dy = shot.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) < this.config.minDistance;
    });

    if (tooClose) {
      return null;
    }

    this.lastShotTimestamp = frame.timestamp;

    return {
      id: frame.timestamp,
      timestamp: frame.timestamp,
      x: center.x,
      y: center.y,
    };
  }

  private estimateCenter(mask: Uint8Array, width: number, height: number): Point | null {
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] === 0) {
        continue;
      }

      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      sumX += x;
      sumY += y;
    }

    if (count < this.config.minArea) {
      return null;
    }

    return {
      x: sumX / count,
      y: sumY / count,
    };
  }

  private decodeToGray(base64: string): Uint8Array | null {
    try {
      const jpegBytes = base64js.toByteArray(base64);
      const decoded = jpeg.decode(jpegBytes, { useTArray: true });
      const gray = new Uint8Array(decoded.width * decoded.height);

      for (let pixel = 0; pixel < gray.length; pixel += 1) {
        const offset = pixel * 4;
        const r = decoded.data[offset];
        const g = decoded.data[offset + 1];
        const b = decoded.data[offset + 2];
        gray[pixel] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      return gray;
    } catch {
      return null;
    }
  }
}
