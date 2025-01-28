import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function AnimatedScroll() {
  const scrollY = new Animated.Value(0);

  return (
    <Animated.ScrollView
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      )}
    >
      <View style={styles.container}>
        <Text style={styles.text}>Scroll to see the animation!</Text>
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    color: '#fff',
  },
});
