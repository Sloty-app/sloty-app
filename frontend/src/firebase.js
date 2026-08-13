// src/firebase.js
//
// Firebase client SDK setup, used specifically for Phone Authentication.
// Analytics is deliberately left out — it's unrelated to the OTP flow
// and adds nothing here except unused overhead.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD2t7Q16Fi6vrBdnNlqiD-MApj96Vcz61U",
  authDomain: "sloty-app-46545.firebaseapp.com",
  projectId: "sloty-app-46545",
  storageBucket: "sloty-app-46545.firebasestorage.app",
  messagingSenderId: "358817652539",
  appId: "1:358817652539:web:633c4126a0c51747d4611e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);