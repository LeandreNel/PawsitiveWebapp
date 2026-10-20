import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCTfTAk9onbVUGMODqM3Zb442yCMne5KuE",
  authDomain: "project-d970a4c5-3b03-4517-b3b.firebaseapp.com",
  projectId: "project-d970a4c5-3b03-4517-b3b",
  storageBucket: "project-d970a4c5-3b03-4517-b3b.firebasestorage.app",
  messagingSenderId: "574671242595",
  appId: "1:574671242595:web:5bf86a5ff864e60d833f56",
  measurementId: "G-PLE3K9RXPJ",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const analytics = isSupported().then((supported) =>
  supported ? getAnalytics(firebaseApp) : null,
);
