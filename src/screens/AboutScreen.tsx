import React from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About Me</Text>
      <Text style={styles.description}>
        I am a passionate Front-End Developer with experience in React Native and modern UI/UX design.
        I love building sleek, responsive, and user-friendly applications.
      </Text>

      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-UHyRZLGa4XJF3lzUtzyAu6JRZrVALp.png",
          }}
          style={styles.profileImage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: height, // Same height as HomeScreen
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#9333ea",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    color: "#cbd5e1",
    marginBottom: 24,
    maxWidth: "80%",
  },
  imageContainer: {
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: "hidden",
    backgroundColor: "#4c1d95",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});
