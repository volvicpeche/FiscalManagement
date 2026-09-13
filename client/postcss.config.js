export default {
  plugins: {
    // Tailwind v4 ships its own vendor-prefixing (Lightning CSS), so
    // autoprefixer is no longer needed alongside it.
    '@tailwindcss/postcss': {},
  },
};
