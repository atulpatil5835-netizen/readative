import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, runTransaction, deleteDoc } from "firebase/firestore";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log("Initializing Firebase with project ID:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runTests() {
  const testUserId = "test_user_id_" + Date.now();
  const testPostId = "temp_post_" + Math.random().toString(36).slice(2, 11);

  console.log(`\n--- TEST: Transaction update on a NEW knowledge document (${testPostId}) ---`);
  const knowledgeRef = doc(db, "knowledge", testPostId);
  try {
    // Create the document first
    console.log("Creating new knowledge post...");
    await setDoc(knowledgeRef, {
      title: "Temporary Test Post",
      helpfulIds: [],
      helpfulCount: 0,
      createdAt: Date.now(),
    });
    console.log("Knowledge post created successfully!");

    console.log("Running transaction on the new post...");
    await runTransaction(db, async (transaction) => {
      console.log("Tx Callback Start");
      console.log("Tx Get KnowledgeRef...");
      const snap = await transaction.get(knowledgeRef);
      console.log("Tx Get KnowledgeRef Done. Exists:", snap.exists());
      if (!snap.exists()) throw new Error("no post");
      
      const currentHelpful = snap.data().helpfulIds || [];
      const nextHelpful = [...new Set([...currentHelpful, testUserId])];
      
      console.log("Tx Update KnowledgeRef...");
      transaction.update(knowledgeRef, {
        helpfulIds: nextHelpful,
        helpfulCount: nextHelpful.length,
      });
      console.log("Tx Callback End");
    });
    console.log("SUCCESS: Transaction on new post completed!");
  } catch (error: any) {
    console.error("FAILED transaction on new post:", error.code, "-", error.message);
  } finally {
    try {
      await deleteDoc(knowledgeRef);
      console.log("Cleaned up temporary knowledge post.");
    } catch (cleanupError: any) {
      console.warn(
        "FAILED cleanup for temporary knowledge post:",
        cleanupError.code,
        "-",
        cleanupError.message,
      );
    }
  }
}

runTests().catch(console.error);
