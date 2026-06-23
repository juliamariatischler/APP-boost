type CordovaHealthMethod =
  | "isAvailable"
  | "requestAuthorization"
  | "query"
  | "queryAggregated"
  | "openHealthSettings";

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

    const timeout = window.setTimeout(() => {
      reject("plugin_timeout");
    }, 20000);

    const finish = (callback: (value?: unknown) => void) => (value?: unknown) => {
      window.clearTimeout(timeout);
      callback(value);
    };

    fn.apply(plugin, [...args, finish(resolve as (value?: unknown) => void), finish(reject)]);
  });
};
