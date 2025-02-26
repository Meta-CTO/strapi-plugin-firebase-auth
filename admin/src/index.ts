type TradOptions = Record<string, string>;

const prefixPluginTranslations = (
  trad: TradOptions,
  pluginId: string
): TradOptions => {
  if (!pluginId) {
    throw new TypeError("pluginId can't be empty");
  }
  return Object.keys(trad).reduce((acc, current) => {
    acc[`${pluginId}.${current}`] = trad[current];
    return acc;
  }, {} as TradOptions);
};



import pluginPkg from "../../package.json";
import pluginId from "./pluginId";
import { Initializer } from "./components/Initializer/Initializer";
import PluginIcon from "./components/PluginIcon";
import pluginPermissions from "./utils/permissions";
import getTrad from "./utils/getTrad";

const name = pluginPkg.strapi.name;

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: `Firebase Auth`,
      },
      Component: async () => {
        const component = await import("./pages/App");
        return component.default;  // Add .default here
      },
      permissions: pluginPermissions.main,
    });

    app.createSettingSection(
      {
        id: pluginId,
        intlLabel: {
          id: getTrad("SettingsNav.section-label"),
          defaultMessage: "Firebase-Auth Plugin",
        },
      },
      [
        {
          intlLabel: {
            id: getTrad("Settings.firebase-auth.plugin.title"),
            defaultMessage: "Settings",
          },
          id: "settings",
          to: `/settings/${pluginId}`,
          async Component() {
            const component = await import("./pages/Settings");
            return component.default;  // Add .default here
          },
          permissions: pluginPermissions.settings,
        },
      ]
    );

    const plugin = {
      id: pluginId,
      initializer: Initializer,
      isReady: false,
      name,
    };

    app.registerPlugin(plugin);
  },

  bootstrap(app: any) {},

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => {
            return {
              data: prefixPluginTranslations(data, pluginId),
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