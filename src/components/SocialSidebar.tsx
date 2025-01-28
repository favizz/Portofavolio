import React from "react";
import { View, StyleSheet, Pressable, Linking } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

export default function SocialSidebar() {
  const socials = [
    { icon: "github", url: "https://github.com" },
    { icon: "linkedin", url: "https://linkedin.com" },
    { icon: "twitter", url: "https://twitter.com" },
    { icon: "instagram", url: "https://instagram.com" },
  ];

  return (
    <View style={styles.sidebar}>
      {socials.map((social, index) => (
        <Pressable
          key={index}
          style={styles.iconContainer}
          onPress={() => Linking.openURL(social.url)}
        >
          <Icon name={social.icon} size={24} color="#c4b5fd" />
        </Pressable>
      ))}
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    left: 20,
    top: "50%",
    transform: [{ translateY: -50 }],
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2e1065",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  line: {
    width: 2,
    height: 100,
    backgroundColor: "#c4b5fd",
    marginTop: 16,
  },
});
