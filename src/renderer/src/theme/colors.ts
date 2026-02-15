// src/renderer/src/themes/colors.ts
export const colors = {
  primary: {
    dark: "rgb(83, 37, 99)",
    main: "rgb(180, 90, 211)",
    light: "rgb(220, 160, 235)",
    subtle: "rgb(83, 37, 99)",
  },
  neutral: {
    darker: "rgb(13, 17, 23)",
    dark: "rgb(36, 36, 36)",
    medium: "rgb(68, 68, 68)",
    light: "rgb(139, 148, 158)",
    lighter: "rgb(201, 209, 217)",
  },
  secondary: {
    cyan: "rgb(90, 206, 229)",
    cyanHover: "rgb(77, 156, 255)",
    pink: "rgb(252, 209, 216)",
  },
  semantic: {
    success: "rgb(46, 164, 79)",
    successHover: "rgb(35, 134, 54)",
    error: "rgb(248, 81, 73)",
    warning: "rgb(255, 191, 0)",
  },
  white: "rgb(255, 255, 255)",
  black: "rgb(0, 0, 0)",
} as const;
