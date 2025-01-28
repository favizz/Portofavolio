import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

// Define valid navigation routes
type RootStackParamList = {
  Home: undefined;
  "About Me": undefined;
  Project: undefined;
  Skill: undefined;
  Career: undefined;
  Contact: undefined;
};

export default function Header() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.header}>
      <Text style={styles.logo}>Favian.</Text>
      <View style={styles.nav}>
        {Object.keys({
          Home: undefined,
          "About Me": undefined,
          Project: undefined,
          Skill: undefined,
          Career: undefined,
          Contact: undefined,
        }).map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => navigation.navigate(item as keyof RootStackParamList)}
            style={styles.navLink}
          >
            <Text style={styles.navText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#4c1d95",
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  nav: {
    flexDirection: "row",
    gap: 32,
  },
  navLink: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  navText: {
    color: "#fff", // Moved color styling here
    fontSize: 16,
  },
});
