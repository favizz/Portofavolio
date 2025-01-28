import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function ContactScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contact</Text>
      <Text style={styles.description}>
        Let's connect! Feel free to reach out to me via email or LinkedIn.
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
    color: "#06b6d4",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    color: "#cbd5e1",
    maxWidth: "80%",
  },
});
