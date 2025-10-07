import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";
import { prefixPluginTranslations } from "./utils/prefixPluginTranslations";
import { PERMISSIONS } from "./permissions";
import { getTranslation } from "./utils/getTranslation";

// Global style to fix scrollbar and layout issues
// Prevents horizontal scroll and ensures single vertical scrollbar (inner white one)
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      overflow-x: hidden !important;
      overflow-y: hidden !important;
      max-width: 100vw !important;
      height: 100vh !important;
    }
    #strapi {
      overflow-x: hidden !important;
      overflow-y: auto !important;
      max-width: 100vw !important;
      height: 100vh !important;
    }
  `;
  document.head.appendChild(style);
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.page.title`,
        defaultMessage: PLUGIN_ID,
      },
      Component: () =>
        import("./pages/App").then((mod) => ({
          default: mod.App,
        })),
      permissions: PERMISSIONS["menu-link"],
    });

    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: {
          id: getTranslation("SettingsNav.section-label"),
          defaultMessage: "Firebase-Authentication Plugin",
        },
      },
      [
        {
          intlLabel: {
            id: getTranslation("Settings.firebase-authentication.plugin.title"),
            defaultMessage: "Settings",
          },
          id: "settings",
          to: `/settings/${PLUGIN_ID}`,
          async Component() {
            const component = await import("./pages/Settings/index");
            return component.default;
          },
          permissions: PERMISSIONS["menu-link"],
        },
      ]
    );

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => {
            return {
              data: prefixPluginTranslations(data, PLUGIN_ID),
              locale,
            };
          })
          .catch(() => {
            return {
              data: {},
              locale,
            };
          });
      })
    );

    return Promise.resolve(importedTrads);
  },
};
