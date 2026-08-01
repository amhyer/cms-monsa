"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  // useTheme returns "system" by default; with ThemeProvider installed this is safe.
  // Guard against undefined during SSR/first paint.
  const themeResult = useTheme();
  const theme = (themeResult?.theme ?? "light") as ToasterProps["theme"];

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
