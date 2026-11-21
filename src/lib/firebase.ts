import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CustomMapData, LeaderboardEntry, MapId, UserProgression } from '../types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function fetchOrCreateUserProfile(
  user: User,
  fallbackName: string,
): Promise<UserProgression> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        displayName: String(data.displayName || fallbackName).slice(0, 32),
        points: Number(data.points) || 0,
        candyCoins: Number(data.candyCoins) || 0,
        unlockedItems: Array.isArray(data.unlockedItems) ? data.unlockedItems : [],
        equippedItems: Array.isArray(data.equippedItems) ? data.equippedItems : [],
        completedMaps: Array.isArray(data.completedMaps) ? data.completedMaps : [],
      };
    }

    const cleanName = (user.displayName || fallbackName || 'Survivor').slice(0, 32);
    const initial: UserProgression = {
      displayName: cleanName,
      points: 0,
      candyCoins: 50,
      unlockedItems: [],
      equippedItems: [],
      completedMaps: [],
    };

    await setDoc(ref, {
      uid: user.uid,
      displayName: cleanName,
      points: initial.points,
      candyCoins: initial.candyCoins,
      unlockedItems: initial.unlockedItems,
      equippedItems: initial.equippedItems,
      completedMaps: initial.completedMaps,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return initial;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserProgression(
  user: User,
  progression: UserProgression,
): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    await updateDoc(ref, {
      displayName: progression.displayName.slice(0, 32) || 'Survivor',
      points: Math.max(0, Math.min(10000000, Math.floor(progression.points))),
      candyCoins: Math.max(0, Math.min(1000000, Math.floor(progression.candyCoins))),
      unlockedItems: progression.unlockedItems.slice(0, 32),
      equippedItems: progression.equippedItems.slice(0, 16),
      completedMaps: progression.completedMaps.slice(0, 16),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitLeaderboardEntry(
  user: User,
  entry: Omit<LeaderboardEntry, 'entryId' | 'uid' | 'createdAt'>,
): Promise<void> {
  const entryId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `leaderboard/${entryId}`;
  try {
    await setDoc(doc(db, 'leaderboard', entryId), {
      entryId,
      uid: user.uid,
      playerName: entry.playerName.slice(0, 32) || 'Survivor',
      mapId: entry.mapId,
      score: Math.max(0, Math.min(500000, Math.floor(entry.score))),
      timeSeconds: Math.max(5, Math.min(86400, Math.floor(entry.timeSeconds))),
      giftsCollected: Math.max(0, Math.min(100, Math.floor(entry.giftsCollected))),
      mode: entry.mode,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchLeaderboardEntries(mapFilter?: MapId | 'all'): Promise<LeaderboardEntry[]> {
  const path = 'leaderboard';
  try {
    const base = collection(db, 'leaderboard');
    const q =
      mapFilter && mapFilter !== 'all'
        ? query(base, where('mapId', '==', mapFilter), orderBy('score', 'desc'), limit(30))
        : query(base, orderBy('score', 'desc'), limit(40));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (error) {
    // Fallback if composite index for where+orderBy isn't built yet
    try {
      const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(50)));
      const all = snap.docs.map((d) => d.data() as LeaderboardEntry);
      return mapFilter && mapFilter !== 'all' ? all.filter((e) => e.mapId === mapFilter) : all;
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.LIST, path);
    }
  }
}

export async function saveCustomMapToCloud(
  user: User,
  mapData: Omit<CustomMapData, 'ownerId' | 'updatedAt'>,
): Promise<void> {
  const path = `customMaps/${mapData.mapId}`;
  try {
    const ref = doc(db, 'customMaps', mapData.mapId);
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        authorName: mapData.authorName.slice(0, 32) || 'Architect',
        title: mapData.title.slice(0, 48) || 'Haunted Wing',
        theme: mapData.theme,
        monsterType: mapData.monsterType,
        gridRows: mapData.gridRows,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        mapId: mapData.mapId,
        ownerId: user.uid,
        authorName: mapData.authorName.slice(0, 32) || 'Architect',
        title: mapData.title.slice(0, 48) || 'Haunted Wing',
        theme: mapData.theme,
        monsterType: mapData.monsterType,
        gridRows: mapData.gridRows,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCustomMapsFromCloud(): Promise<CustomMapData[]> {
  const path = 'customMaps';
  try {
    const q = query(collection(db, 'customMaps'), orderBy('updatedAt', 'desc'), limit(24));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CustomMapData);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCustomMapFromCloud(mapId: string): Promise<void> {
  const path = `customMaps/${mapId}`;
  try {
    await deleteDoc(doc(db, 'customMaps', mapId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
