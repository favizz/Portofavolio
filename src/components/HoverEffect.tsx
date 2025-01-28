import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';

export default function HoverEffect() {
  const [hovered, setHovered] = useState(false);

  return (
    <TouchableWithoutFeedback
      onPressIn={() => setHovered(true)}
      onPressOut={() => setHovered(false)}
    >
      <View style={[styles.card, hovered && styles.hovered]}>
        <Text style={styles.text}>Hover Over Me</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    margin: 10,
    backgroundColor: '#222',
    borderRadius: 10,
    alignItems: 'center',
  },
  hovered: {
    backgroundColor: '#8a2be2',
  },
  text: {
    color: '#fff',
  },
});
