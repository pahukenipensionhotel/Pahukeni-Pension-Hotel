import type { User as FirebaseUser } from "firebase/auth";
import type { User } from "../../../shared/types/hotel";
import { fetchUserProfile, saveUserProfile } from "../../staff/repositories/usersRepository";
import { sanitizeText } from "../../../shared/validation/inputs";

function buildCustomerProfile(firebaseUser: FirebaseUser): Omit<User, "id"> {
  const email = firebaseUser.email || `guest_${firebaseUser.uid.slice(0, 8)}@pahukeni.com`;
  const username = firebaseUser.isAnonymous ? "guest" : email.split("@")[0];
  const displayName = firebaseUser.displayName || (firebaseUser.isAnonymous ? "Guest User" : username);

  return {
    username: sanitizeText(username, 60),
    name: sanitizeText(displayName, 80),
    role: "Customer",
    email,
  };
}

export async function resolveUserProfile(firebaseUser: FirebaseUser) {
  const userDoc = await fetchUserProfile(firebaseUser.uid, firebaseUser.email);

  if (userDoc.exists()) {
    const userData = userDoc.data() as Partial<User>;

    if (userDoc.id === firebaseUser.email) {
      const migratedData: Omit<User, "id"> = {
        username: sanitizeText(
          userData.username || (firebaseUser.email ? firebaseUser.email.split("@")[0] : "user"),
          60,
        ),
        name: sanitizeText(
          userData.name ||
            firebaseUser.displayName ||
            (firebaseUser.email ? firebaseUser.email.split("@")[0] : "User"),
          80,
        ),
        role: userData.role || "Customer",
        email: userData.email || firebaseUser.email || undefined,
      };

      await saveUserProfile(firebaseUser.uid, migratedData);
      return { id: firebaseUser.uid, ...migratedData } as User;
    }

    return { id: firebaseUser.uid, ...userData } as User;
  }

  const newCustomerData = buildCustomerProfile(firebaseUser);
  await saveUserProfile(firebaseUser.uid, newCustomerData);
  return { id: firebaseUser.uid, ...newCustomerData } as User;
}
