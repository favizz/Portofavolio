import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function ProjectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Projects</Text>
      <Text style={styles.description}>
        Here are some of my recent projects showcasing my skills in React Native and UI/UX design.
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
    color: "#eab308",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    color: "#cbd5e1",
    maxWidth: "80%",
  },
});
