const commitlintConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "scaffold",
        "auth",
        "venues",
        "locations",
        "events",
        "participants",
        "entry",
        "seating",
        "admin",
        "db",
        "docker",
        "e2e",
        "deploy"
      ]
    ]
  }
};

export default commitlintConfig;
