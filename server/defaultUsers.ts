import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { users, type userRoles } from "../drizzle/schema";

export type DefaultUserRole = (typeof userRoles)[number];

export interface DefaultUserSeed {
  openId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  password: string;
  role: DefaultUserRole;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.pop() ?? fullName;
  return { firstName: parts.join(" ") || lastName, lastName };
}

function makeUser(openId: string, name: string, email: string, password: string, role: DefaultUserRole): DefaultUserSeed {
  return { openId, ...splitName(name), name, email, password, role };
}

/** Uygulamayla birlikte gelen varsayılan hesaplar (kullanıcı adı, şifre, isim, rol). */
export const DEFAULT_USERS: DefaultUserSeed[] = [
  makeUser("local:admin-zaferonder", "Admin Yönetici", "admin@zaferonder.com", "Admin12345!", "ADMIN"),
  makeUser("local:lcw-zafer-onder", "Zafer ÖNDER", "zafer.onder@lcwaikiki.com", "zafer.onder", "TRAINING_MANAGER"),
  makeUser("local:lcw-pinar-tuncsav", "Pınar TUNÇSAV", "pinar.tuncsav@lcwaikiki.com", "pinar.tuncsav", "TRAINING_MANAGER"),
  makeUser("local:lcw-seyda-topcu", "Şeyda TOPÇU", "seyda.topcu@lcwaikiki.com", "seyda.topcu", "TRAINING_MANAGER"),
  makeUser("local:lcw-nazire-erton", "Nazire Erton", "nazire.erton@lcwaikiki.com", "nazire.erton", "TRAINING_MANAGER"),
  makeUser("local:lcw-fatma-cardak", "Fatma ÇARDAK", "fatma.cardak@lcwaikiki.com", "fatma.cardak", "TRAINING_MANAGER"),
  makeUser("local:lcw-selinmerve-agca", "Selin Merve AĞCA", "selinmerve.agca@lcwaikiki.com", "selinmerve.agca", "TRAINING_MANAGER"),
  makeUser("local:lcw-yesim-sandikci", "Yeşim SANDIKÇI", "yesim.sandikci@lcwaikiki.com", "yesim.sandikci", "TRAINING_MANAGER"),
  makeUser("local:lcw-tuba-tapar", "Tuba TAPAR", "tuba.tapar@lcwaikiki.com", "tuba.tapar", "TRAINING_MANAGER"),
  makeUser("local:lcw-ebru-celik", "Ebru ÇELİK", "ebru.celik@lcwaikiki.com", "ebru.celik", "TRAINING_MANAGER"),
  makeUser("local:lcw-onur-izbul", "Onur İZBUL", "onur.izbul@lcwaikiki.com", "onur.izbul", "EVALUATOR"),
  makeUser("local:lcw-ibrahim-gunes", "İbrahim GÜNEŞ", "ibrahim.gunes@lcwaikiki.com", "ibrahim.gunes", "TRAINING_MANAGER"),
  makeUser("local:lcw-seda-say", "Seda SAY", "seda.say@lcwaikiki.com", "seda.say", "TRAINING_MANAGER"),
  makeUser("local:lcw-bedriye-kosan", "Bedriye KOŞAN", "bedriye.kosan@lcwaikiki.com", "bedriye.kosan", "TRAINING_MANAGER"),
];

/** Eksik olan varsayılan hesapları veritabanına ekler; var olanların şifresini değiştirmez. */
export async function seedDefaultUsers(db: ReturnType<typeof drizzle>) {
  const created: string[] = [];
  for (const user of DEFAULT_USERS) {
    const existing = (await db.select({ id: users.id }).from(users).where(eq(users.email, user.email)).limit(1))[0];
    if (existing) continue;
    const passwordHash = await bcrypt.hash(user.password, 12);
    await db.insert(users).values({
      openId: user.openId,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      passwordHash,
      loginMethod: "password",
      role: user.role,
      isActive: true,
      mustChangePassword: false,
    });
    created.push(user.email);
  }
  return created;
}
