export type MapId = 'village' | 'forest' | 'factory' | 'mansion' | 'station' | 'custom';

export type MapTheme = 'village' | 'forest' | 'factory' | 'mansion' | 'station';

export type MonsterType =
  | 'evil_santa'
  | 'frozen_snowman'
  | 'naughty_elf'
  | 'christmas_shadow';

export type MenuTab =
  | 'play'
  | 'multiplayer'
  | 'maps'
  | 'shop'
  | 'leaderboard'
  | 'settings';

export type TileChar =
  | '.' // Walkable floor / snow path
  | '#' // Solid wall / cottage / building / rock
  | 'T' // Pine tree / pillar obstacle
  | 'H' // Hiding spot (Wardrobe / Snowdrift / Toy Crate / Iron Locker)
  | 'G' // Primary objective collectible (Gift / Track / Cog / Key / Coal)
  | 'C' // Bonus Candy Coin
  | 'P' // Interactive Puzzle station
  | 'L' // Streetlamp / industrial lantern
  | 'S' // Player spawn
  | 'M' // Monster spawn
  | 'E'; // Escape Gate / Polar Express Train

export interface MonsterConfig {
  id: MonsterType;
  name: string;
  title: string;
  description: string;
  ability: string;
  speed: number;
  chaseSpeed: number;
  sightRange: number;
  accentColor: string;
}

export interface MapDefinition {
  id: MapId;
  chapterNumber: number;
  title: string;
  subtitle: string;
  theme: MapTheme;
  storyline: string;
  objectiveLabel: string;
  puzzleTitle: string;
  puzzleHint: string;
  escapeLabel: string;
  imageUrl: string;
  monsters: MonsterType[];
  gridRows: string[];
  requiredCollectibles: number;
  rewardPoints: number;
  rewardCoins: number;
  customMapId?: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: 'gear' | 'consumable' | 'skin';
  price: number;
  description: string;
  effectSummary: string;
}

export interface GameSettings {
  playerName: string;
  masterVolume: number;
  mouseSensitivity: number;
  graphicsQuality: 'high' | 'medium';
  invertY: boolean;
  showControlsHint: boolean;
}

export interface UserProgression {
  displayName: string;
  points: number;
  candyCoins: number;
  unlockedItems: string[];
  equippedItems: string[];
  completedMaps: string[];
}

export interface LeaderboardEntry {
  entryId: string;
  uid: string;
  playerName: string;
  mapId: MapId;
  score: number;
  timeSeconds: number;
  giftsCollected: number;
  mode: 'solo' | 'coop';
  createdAt?: unknown;
}

export interface CustomMapData {
  mapId: string;
  ownerId: string;
  authorName: string;
  title: string;
  theme: MapTheme;
  monsterType: MonsterType;
  gridRows: string[];
  updatedAt?: unknown;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  battery: number;
  maxBattery: number;
  flashlightOn: boolean;
  sprinting: boolean;
  hiding: boolean;
  hidingSpotLabel: string;
  collectedCount: number;
  requiredCount: number;
  bonusCoinsCollected: number;
  puzzleSolved: boolean;
  escapeUnlocked: boolean;
  elapsedSeconds: number;
  nearestMonsterDist: number;
  nearestMonsterName: string | null;
  interactPrompt: string | null;
  interactAction: 'collect' | 'coin' | 'hide' | 'unhide' | 'puzzle' | 'escape' | null;
  pointerLocked: boolean;
  activeConsumableName: string | null;
  consumableUsesLeft: number;
  statusToast: string | null;
  freezeLevel: number;
  shadowStatic: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  skinId: string;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flashlightOn: boolean;
  sprinting: boolean;
  hiding: boolean;
  hp: number;
  escaped: boolean;
}

export interface RoomSummary {
  code: string;
  mapId: string;
  mapTitle: string;
  playerCount: number;
  hostName: string;
}

export interface ActiveRoom {
  code: string;
  hostId: string;
  mapId: string;
  mapTitle: string;
  started: boolean;
  collectedIds: string[];
  puzzleSolved: boolean;
  players: RemotePlayerState[];
}

export interface GameResult {
  victory: boolean;
  mapId: MapId;
  mapTitle: string;
  score: number;
  coinsEarned: number;
  timeSeconds: number;
  collectedCount: number;
  requiredCount: number;
  bonusCoins: number;
  killedBy: string | null;
  mode: 'solo' | 'coop';
}
