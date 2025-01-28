import React from "react";
import { View, Text, Image, StyleSheet, Pressable, Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hello! I am</Text>
      <Text style={styles.name}>Favian Izza</Text>
      <Text style={styles.role}>Front-End Developer</Text>

      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-UHyRZLGa4XJF3lzUtzyAu6JRZrVALp.png",
          }}
          style={styles.profileImage}
        />
      </View>

      <Pressable style={styles.cvButton}>
        <Text style={styles.cvButtonText}>View my CV here</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: height, // Correct usage of screen height
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  greeting: {
    fontSize: 24,
    color: "#06b6d4",
    marginBottom: 8,
  },
  name: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#06b6d4",
    marginBottom: 8,
  },
  role: {
    fontSize: 24,
    color: "#06b6d4",
    marginBottom: 32,
  },
  imageContainer: {
    width: 400,
    height: 400,
    borderRadius: 200,
    overflow: "hidden", // Correct value
    backgroundColor: "#0284c7",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cvButton: {
    marginTop: 32,
    backgroundColor: "#9333ea",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  cvButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
});
