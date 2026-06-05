import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  type TextInputProps,
} from "react-native";
import { colors, space, radius } from "../theme/tokens";

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, style }: ScreenProps) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "ghost";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: ButtonProps) {
  const isGhost = variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonPrimary,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, isGhost && styles.buttonLabelGhost]}>
        {label}
      </Text>
    </Pressable>
  );
}

type TextFieldProps = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({ label, containerStyle, style, ...rest }: TextFieldProps) {
  return (
    <View style={[styles.fieldContainer, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.field, style]}
        {...rest}
      />
    </View>
  );
}

type PillProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Pill({ label, style, textStyle }: PillProps) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={[styles.pillText, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.sand,
    padding: space.xl,
    gap: space.md,
  },
  button: {
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.navy,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.navy,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  fieldContainer: {
    width: "100%",
    gap: space.xs,
  },
  fieldLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: "600",
  },
  field: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sand,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    fontSize: 15,
    color: colors.ink,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonLabelGhost: {
    color: colors.navy,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.teal100,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  pillText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
