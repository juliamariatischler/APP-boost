const avatarItemModules = import.meta.glob("../assets/avatar-items/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const getAsset = (filename: string) => avatarItemModules[`../assets/avatar-items/${filename}`] || "";

const avatarItemDefinitions = [
  { id: "abschluss", filename: "Abschluss.png", name: "Abschluss", description: "Schicker Abschluss-Hut." },
  { id: "auge-links", filename: "Auge links.png", name: "Linkes Auge", description: "Linkes Augen-Overlay." },
  { id: "auge-rechts", filename: "Auge rechts.png", name: "Rechtes Auge", description: "Rechtes Augen-Overlay." },
  { id: "bandana", filename: "Bandana.png", name: "Bandana", description: "Lässiges Bandana." },
  { id: "bandana-1", filename: "Bandana1.png", name: "Bandana 2", description: "Zweite Bandana-Variante." },
  { id: "fliege", filename: "Fliege.png", name: "Fliege", description: "Kleine Fliege für den Hals." },
  { id: "haube", filename: "Haube.png", name: "Haube", description: "Kuschelige Haube." },
  { id: "helikoptermuetze", filename: "Helikoptermuetze.png", name: "Helikoptermütze", description: "Mütze mit Propeller." },
  { id: "kappe", filename: "Kappe.png", name: "Kappe", description: "Sportliche Kappe." },
  { id: "kette-1", filename: "Kette1.png", name: "Kette", description: "Kette als Accessoire." },
  { id: "kravatte", filename: "Kravatte.png", name: "Krawatte", description: "Formelles Outfit-Item." },
  { id: "masche", filename: "Masche.png", name: "Masche", description: "Bunte Haarmasche." },
  { id: "mund", filename: "Mund.png", name: "Mund", description: "Mund-Overlay." },
  { id: "muetze", filename: "Mütze.png", name: "Mütze", description: "Warme Mütze." },
  { id: "party", filename: "Party1.png", name: "Party", description: "Party-Accessoire." },
  { id: "perlenkette", filename: "Perlenkette.png", name: "Perlenkette", description: "Perlenkette für den Avatar." },
  { id: "piratenauge", filename: "Piratenauge.png", name: "Piratenauge", description: "Augenklappe im Piratenstil." },
  { id: "piratentuch", filename: "Piratentuch.png", name: "Piratentuch", description: "Kopftuch im Piratenstil." },
  { id: "schal-1", filename: "Schal1.png", name: "Schal 1", description: "Schal-Variante 1." },
  { id: "schal-2", filename: "Schal2.png", name: "Schal 2", description: "Schal-Variante 2." },
  { id: "schal-3", filename: "Schal3.png", name: "Schal 3", description: "Schal-Variante 3." },
  { id: "schal-4", filename: "Schal4.png", name: "Schal 4", description: "Schal-Variante 4." },
  { id: "schnurrbart", filename: "Schnurbart.png", name: "Schnurrbart", description: "Klassischer Schnurrbart." },
  { id: "sommerhut", filename: "Sommerhut.png", name: "Sommerhut", description: "Leichter Sommerhut." },
  { id: "sonnenbrille-herz", filename: "Sonnenbrille Herz.png", name: "Herzbrille", description: "Sonnenbrille mit Herzform." },
  { id: "stirnband-herz", filename: "Stirnband Herz.png", name: "Herz-Stirnband", description: "Stirnband mit Herzdetail." },
  { id: "wangen", filename: "Wangen.png", name: "Wangen", description: "Wangen-Overlay." },
] as const;

export type AvatarItemKey = (typeof avatarItemDefinitions)[number]["id"];
export type AvatarItemId = "none" | AvatarItemKey;

/** Total accumulated points required per owned-item slot. */
export const AVATAR_ITEM_POINTS_THRESHOLD = 40;

/** How many item slots a user has unlocked based on their total points. */
export const computeMaxItemSlots = (totalPoints: number): number =>
  Math.floor(totalPoints / AVATAR_ITEM_POINTS_THRESHOLD);
export const AVATAR_BASE_ASSET = getAsset("Blitz BASIS.png");

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
