/** @type {import("prettier").Config} */
const config = {
  quoteProps: "consistent",
  overrides: [
    {
      files: ["src/scripts/sd-tag-attributes.ts"],
      options: {
        printWidth: 160,
      },
    },
  ],
};

export default config;
