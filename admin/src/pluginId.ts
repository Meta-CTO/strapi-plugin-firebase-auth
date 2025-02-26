import pluginPkg from "../../package.json";
const pluginId = pluginPkg.name.match(/strapi-plugin-(.+)/);
const result = pluginId ? pluginId[1] : 'firebase-auth';

export default result;
