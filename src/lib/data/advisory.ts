import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

const { commodities } = schema;

/** Every commodity the platform knows about, crops first, for the advisory selector. */
export async function getAllCommodities() {
  return db
    .select({
      code: commodities.code,
      nameEn: commodities.nameEn,
      nameRw: commodities.nameRw,
      category: commodities.category,
    })
    .from(commodities)
    .orderBy(asc(commodities.category), asc(commodities.nameEn));
}
