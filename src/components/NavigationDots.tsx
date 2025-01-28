import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

// Define valid screen routes
type RootStackParamList = {
  home: undefined;
  about: undefined;
  project: undefined;
  skill: undefined;
  career: undefined;
  contact: undefined;
};

export default function NavigationDots({ activeSection }: { activeSection: keyof RootStackParamList }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const sections: (keyof RootStackParamList)[] = ["home", "about", "project", "skill", "career", "contact"];

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <Pressable
          key={section}
          style={[styles.dot, activeSection === section && styles.activeDot]}
          onPress={() => navigation.navigate(section)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 20,
    top: "50%",
    transform: [{ translateY: -50 }],
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#c4b5fd",
    marginVertical: 8,
  },
  activeDot: {
    backgroundColor: "#7c3aed",
    transform: [{ scale: 1.2 }],
  },
});
