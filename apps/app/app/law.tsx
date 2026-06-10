import { View, Text } from "react-native";
import { useT } from "../lib/i18n";

export default function Law() {
  const { t } = useT();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1F3A5C" }}>
      <Text style={{ color: "#F1ECE0", fontSize: 22, fontWeight: "700" }}>{t("law.title")}</Text>
      <Text style={{ color: "#9fb0c3", marginTop: 8 }}>{t("law.soon")}</Text>
    </View>
  );
}
