import { View, Text, StyleSheet } from "react-native";
import { Screen, Card, Button, Pill } from "../components/ui";
import { colors, space } from "../theme/tokens";

export default function Home() {
  return (
    <Screen>
      <Card>
        <Pill label="MONTENEGRO" />
        <Text style={styles.wordmark}>Kluch</Text>
        <Text style={styles.title}>Kluch — your keys to Montenegro</Text>
        <Text style={styles.body}>
          Find, book, and unlock your stay on the Adriatic coast. A calmer way
          to discover places worth returning to.
        </Text>
        <View style={styles.actions}>
          <Button label="Explore stays" onPress={() => {}} />
          <Button label="Learn more" variant="ghost" onPress={() => {}} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.body,
  },
  actions: {
    marginTop: space.sm,
    gap: space.sm,
  },
});
