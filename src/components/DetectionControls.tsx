import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type DetectionControlsProps = {
  shotCount: number;
  running: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
};

export function DetectionControls({ shotCount, running, onToggleRunning, onReset }: DetectionControlsProps) {
  return (
    <View style={styles.controls}>
      <Text style={styles.info}>Shots: {shotCount}</Text>
      <TouchableOpacity style={styles.button} onPress={onToggleRunning}>
        <Text style={styles.buttonText}>{running ? 'Pause detection' : 'Resume detection'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Reset shots</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    gap: 8,
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
