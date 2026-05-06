type CordovaHealthMethod = "isAvailable" | "requestAuthorization" | "query" | "queryAggregated";

const getCordovaHealthPlugin = () => {
  if (typeof window === "undefined") return null;

  const win = window as any;
  return win.cordova?.plugins?.health || win.navigator?.health || null;
};

export const callCordovaHealth = <T = unknown>(method: CordovaHealthMethod, ...args: unknown[]) => {
  return new Promise<T>((resolve, reject) => {
    const plugin = getCordovaHealthPlugin();
    const fn = plugin?.[method];

    if (typeof fn !== "function") {
      reject("plugin_not_installed");
      return;
    }

    fn.apply(plugin, [...args, resolve, reject]);
  });
};
