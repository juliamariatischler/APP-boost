const avatarItemModules = import.meta.glob("../assets/avatar-items/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const getAsset = (filename: string) => avatarItemModules[`../assets/avatar-items/${filename}`] || "";

const avatarItemDefinitions = [
  { id: "abschluss", filename: "Abschluss.svg", name: "Abschluss", description: "Schicker Abschluss-Hut." },
  { id: "auge-links", filename: "Auge links.svg", name: "Linkes Auge", description: "Linkes Augen-Overlay." },
  { id: "auge-rechts", filename: "Auge rechts.svg", name: "Rechtes Auge", description: "Rechtes Augen-Overlay." },
  { id: "bandana", filename: "Bandana.svg", name: "Bandana", description: "Lässiges Bandana." },
  { id: "bandana-1", filename: "Bandana1.svg", name: "Bandana 2", description: "Zweite Bandana-Variante." },
  { id: "fliege", filename: "Fliege.svg", name: "Fliege", description: "Kleine Fliege für den Hals." },
  { id: "haube", filename: "Haube.svg", name: "Haube", description: "Kuschelige Haube." },
  { id: "helikoptermuetze", filename: "Helikoptermuetze.svg", name: "Helikoptermütze", description: "Mütze mit Propeller." },
  { id: "kappe", filename: "Kappe.svg", name: "Kappe", description: "Sportliche Kappe." },
  { id: "kette-1", filename: "Kette1.svg", name: "Kette", description: "Kette als Accessoire." },
  { id: "kravatte", filename: "Kravatte.svg", name: "Krawatte", description: "Formelles Outfit-Item." },
  { id: "masche", filename: "Masche.svg", name: "Masche", description: "Bunte Haarmasche." },
  { id: "mund", filename: "Mund.svg", name: "Mund", description: "Mund-Overlay." },
  { id: "muetze", filename: "Mütze.svg", name: "Mütze", description: "Warme Mütze." },
  { id: "party", filename: "Party1.svg", name: "Party", description: "Party-Accessoire." },
  { id: "perlenkette", filename: "Perlenkette.svg", name: "Perlenkette", description: "Perlenkette für den Avatar." },
  { id: "piratenauge", filename: "Piratenauge.svg", name: "Piratenauge", description: "Augenklappe im Piratenstil." },
  { id: "piratentuch", filename: "Piratentuch.svg", name: "Piratentuch", description: "Kopftuch im Piratenstil." },
  { id: "schal-1", filename: "Schal1.svg", name: "Schal 1", description: "Schal-Variante 1." },
  { id: "schal-2", filename: "Schal2.svg", name: "Schal 2", description: "Schal-Variante 2." },
  { id: "schal-3", filename: "Schal3.svg", name: "Schal 3", description: "Schal-Variante 3." },
  { id: "schal-4", filename: "Schal4.svg", name: "Schal 4", description: "Schal-Variante 4." },
  { id: "schnurrbart", filename: "Schnurbart.svg", name: "Schnurrbart", description: "Klassischer Schnurrbart." },
  { id: "sommerhut", filename: "Sommerhut.svg", name: "Sommerhut", description: "Leichter Sommerhut." },
  { id: "sonnenbrille-herz", filename: "Sonnenbrille Herz.svg", name: "Herzbrille", description: "Sonnenbrille mit Herzform." },
  { id: "stirnband-herz", filename: "Stirnband Herz.svg", name: "Herz-Stirnband", description: "Stirnband mit Herzdetail." },
  { id: "wangen", filename: "Wangen.svg", name: "Wangen", description: "Wangen-Overlay." },
] as const;

export type AvatarItemKey = (typeof avatarItemDefinitions)[number]["id"];
export type AvatarItemId = "none" | AvatarItemKey;

export const WEEKLY_AVATAR_ITEM_THRESHOLD = 100;
export const AVATAR_BASE_ASSET = getAsset("Blitz BASIS.svg");

export const AVATAR_ITEMS = Object.fromEntries(
  avatarItemDefinitions.map((item) => [
    item.id,
    {
      ...item,
      asset: getAsset(item.filename),
    },
  ]),
) as Record<
  AvatarItemKey,
  {
    id: AvatarItemKey;
    filename: string;
    name: string;
    description: string;
    asset: string;
  }
>;

export const AVATAR_ITEM_LIST = avatarItemDefinitions.map((item) => AVATAR_ITEMS[item.id]);

const storageKey = (userId: string) => `boost:avatar-item:${userId}`;

export const isAvatarItemId = (value: string): value is AvatarItemKey => value in AVATAR_ITEMS;

export const loadEquippedAvatarItem = (userId: string): AvatarItemId => {
  if (typeof window === "undefined") return "none";
  const value = window.localStorage.getItem(storageKey(userId));
  return value && isAvatarItemId(value) ? value : "none";
};

export const saveEquippedAvatarItem = (userId: string, itemId: AvatarItemId) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), itemId);
};
