import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function SkillScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Skills</Text>
      <Text style={styles.description}>
        I specialize in React Native, JavaScript, TypeScript, and UI/UX design, crafting seamless digital experiences.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: height,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    color: "#cbd5e1",
    maxWidth: "80%",
  },
});
