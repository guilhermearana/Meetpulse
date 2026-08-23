import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined
);

export interface FirebaseMeeting {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  hostName: string;
  createdAt: string;
  createdAtTimestamp?: Timestamp;
  status: 'active' | 'ended' | 'scheduled';
  isInstant: boolean;
  participantCount?: number;
  lastActiveAt?: string;
}

export interface FirebaseMeetingHistory {
  id: string;
  roomId: string;
  meetingTitle: string;
  userName: string;
  joinedAt: string;
  leftAt?: string;
  durationSeconds?: number;
}

/**
 * Save or register a new created meeting in Firestore
 */
export async function saveMeetingToFirestore(meeting: {
  roomId: string;
  title: string;
  description?: string;
  hostName: string;
  isInstant?: boolean;
}): Promise<void> {
  try {
    const meetingRef = doc(db, 'meetings', meeting.roomId);
    await setDoc(
      meetingRef,
      {
        id: meeting.roomId,
        roomId: meeting.roomId,
        title: meeting.title || `Reunião #${meeting.roomId}`,
        description: meeting.description || '',
        hostName: meeting.hostName || 'Anfitrião',
        createdAt: new Date().toISOString(),
        createdAtTimestamp: serverTimestamp(),
        status: 'active',
        isInstant: meeting.isInstant ?? true,
        participantCount: 1,
        lastActiveAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firebase] Failed to save meeting to Firestore:', err);
  }
}

/**
 * Update meeting active participants or status
 */
export async function updateMeetingInFirestore(
  roomId: string,
  data: Partial<Omit<FirebaseMeeting, 'id' | 'roomId'>>
): Promise<void> {
  try {
    const meetingRef = doc(db, 'meetings', roomId);
    await updateDoc(meetingRef, {
      ...data,
      lastActiveAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firebase] Failed to update meeting in Firestore:', err);
  }
}

/**
 * Delete a meeting from Firestore
 */
export async function deleteMeetingFromFirestore(roomId: string): Promise<void> {
  try {
    const meetingRef = doc(db, 'meetings', roomId);
    await deleteDoc(meetingRef);
  } catch (err) {
    console.warn('[Firebase] Failed to delete meeting from Firestore:', err);
  }
}

/**
 * Subscribe to recent/active meetings created in Firestore
 */
export function subscribeToSavedMeetings(
  callback: (meetings: FirebaseMeeting[]) => void,
  maxItems = 20
) {
  try {
    const meetingsColl = collection(db, 'meetings');
    const q = query(meetingsColl, orderBy('createdAt', 'desc'), limit(maxItems));

    return onSnapshot(
      q,
      (snapshot) => {
        const meetings: FirebaseMeeting[] = [];
        snapshot.forEach((docSnap) => {
          meetings.push(docSnap.data() as FirebaseMeeting);
        });
        callback(meetings);
      },
      (error) => {
        console.warn('[Firebase] Snapshot listener error on meetings:', error);
      }
    );
  } catch (err) {
    console.warn('[Firebase] Failed to setup meetings subscription:', err);
    return () => {};
  }
}

/**
 * Record a user joining a meeting in the history
 */
export async function recordMeetingHistory(
  paramsOrRoomId:
    | string
    | {
        roomId: string;
        userName: string;
        meetingTitle?: string;
        role?: 'host' | 'participant' | string;
        device?: 'mobile' | 'desktop' | string;
      },
  maybeMeetingTitle?: string,
  maybeUserName?: string
): Promise<string> {
  try {
    let roomId = '';
    let userName = '';
    let meetingTitle = '';
    let role = 'participant';
    let device = 'desktop';

    if (typeof paramsOrRoomId === 'object') {
      roomId = paramsOrRoomId.roomId;
      userName = paramsOrRoomId.userName;
      meetingTitle = paramsOrRoomId.meetingTitle || `Reunião #${roomId}`;
      role = paramsOrRoomId.role || 'participant';
      device = paramsOrRoomId.device || 'desktop';
    } else {
      roomId = paramsOrRoomId;
      meetingTitle = maybeMeetingTitle || `Reunião #${roomId}`;
      userName = maybeUserName || 'Participante';
    }

    const historyId = `${roomId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const historyRef = doc(db, 'meeting_history', historyId);
    await setDoc(historyRef, {
      id: historyId,
      roomId,
      meetingTitle,
      userName,
      role,
      device,
      joinedAt: new Date().toISOString(),
    });
    return historyId;
  } catch (err) {
    console.warn('[Firebase] Failed to record meeting history:', err);
    return '';
  }
}
