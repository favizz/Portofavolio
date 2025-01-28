import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function CareerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Career</Text>
      <Text style={styles.description}>
        My professional journey includes working on various mobile and web applications, enhancing user experiences.
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
    color: "#f97316",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    color: "#cbd5e1",
    maxWidth: "80%",
  },
});
