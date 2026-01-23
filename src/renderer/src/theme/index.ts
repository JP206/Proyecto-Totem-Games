import { colors } from "./colors";
import { typography } from "./typography";

export { colors, typography };

export const injectTheme = () => {
  const root = document.documentElement;

  root.style.setProperty("--color-primary-dark", colors.primary.dark);
  root.style.setProperty("--color-primary-main", colors.primary.main);
  root.style.setProperty("--color-primary-light", colors.primary.light);
  root.style.setProperty("--color-primary-subtle", colors.primary.subtle);

  root.style.setProperty("--color-neutral-darker", colors.neutral.darker);
  root.style.setProperty("--color-neutral-dark", colors.neutral.dark);
  root.style.setProperty("--color-neutral-medium", colors.neutral.medium);
  root.style.setProperty("--color-neutral-light", colors.neutral.light);
  root.style.setProperty("--color-neutral-lighter", colors.neutral.lighter);

  root.style.setProperty("--color-secondary-cyan", colors.secondary.cyan);
  root.style.setProperty(
    "--color-secondary-cyan-hover",
    colors.secondary.cyanHover,
  );
  root.style.setProperty("--color-secondary-pink", colors.secondary.pink);

  root.style.setProperty("--color-success", colors.semantic.success);
  root.style.setProperty("--color-success-hover", colors.semantic.successHover);
  root.style.setProperty("--color-error", colors.semantic.error);
  root.style.setProperty("--color-warning", colors.semantic.warning);

  root.style.setProperty("--color-white", colors.white);
  root.style.setProperty("--color-black", colors.black);

  root.style.setProperty("--font-title", typography.fontFamily.title);
  root.style.setProperty("--font-subtitle", typography.fontFamily.subtitle);
  root.style.setProperty("--font-body", typography.fontFamily.body);
  root.style.setProperty("--text-xs", typography.fontSize.xs);
  root.style.setProperty("--text-sm", typography.fontSize.sm);
  root.style.setProperty("--text-base", typography.fontSize.base);
  root.style.setProperty("--text-lg", typography.fontSize.lg);
  root.style.setProperty("--text-xl", typography.fontSize.xl);
  root.style.setProperty("--text-2xl", typography.fontSize["2xl"]);
  root.style.setProperty("--text-3xl", typography.fontSize["3xl"]);
  root.style.setProperty("--text-4xl", typography.fontSize["4xl"]);
};
