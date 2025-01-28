"use client";

import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Header from "./src/components/Header";
import SocialSidebar from "./src/components/SocialSidebar";
import NavigationDots from "./src/components/NavigationDots";
import HomeScreen from "./src/screens/HomeScreen";
import AboutScreen from "./src/screens/AboutScreen";
import ProjectScreen from "./src/screens/ProjectScreen";
import SkillScreen from "./src/screens/SkillScreen";
import CareerScreen from "./src/screens/CareerScreen";
import ContactScreen from "./src/screens/ContactScreen";

export default function App() {
  const [activeSection, setActiveSection] = useState("home");
  const [showTabMenu, setShowTabMenu] = useState(false);

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.y;
    const windowHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    // Show tab menu when near bottom
    setShowTabMenu(scrollPosition + windowHeight > contentHeight - 100);

    // Detect active section
    const sectionHeight = windowHeight;
    const currentSection = Math.floor(scrollPosition / sectionHeight);
    const sections = ["home", "about", "project", "skill", "career", "contact"];
    setActiveSection(sections[currentSection] || "home");
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <View style={styles.container}>
          <Header />
          <SocialSidebar />
          <NavigationDots activeSection={activeSection} />
          <ScrollView style={styles.content} onScroll={handleScroll} scrollEventThrottle={16}>
            <HomeScreen />
            <AboutScreen />
            <ProjectScreen />
            <SkillScreen />
            <CareerScreen />
            <ContactScreen />
          </ScrollView>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1438",
  },
  content: {
    flex: 1,
  },
});
