import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Public Firebase config credentials for the applet
export const firebaseConfig = {
  projectId: "project-1d4ab4c7-951b-47ce-93b",
  appId: "1:268590524136:web:b2fe001dc64bd9d6f2cb5d",
  apiKey: "AIzaSyDjRwQe9QdMXlfaXCSfTiVVrFC4W2EtDs0",
  authDomain: "project-1d4ab4c7-951b-47ce-93b.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-659cf6e4-edb1-4e3e-a997-810a3cadd7b5",
  storageBucket: "project-1d4ab4c7-951b-47ce-93b.firebasestorage.app",
  messagingSenderId: "268590524136"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
