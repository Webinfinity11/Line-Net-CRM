/**
 * Example service catalogue for Line Net. Run once on a fresh install:
 *   npm run db:seed-services
 * Existing names are skipped, so it is safe to re-run. Prices are starting points:
 * the company edits them in პარამეტრები → სერვისები.
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

const SERVICES = [
  // CCTV
  ["CCTV კამერის მონტაჟი", "cctv", "ცალი", 120, "კრონშტეინი, კაბელის გაყვანა, პოზიციონირება და ფოკუსირება"],
  ["ჩამწერის (NVR/DVR) მონტაჟი და კონფიგურაცია", "cctv", "ცალი", 250, "მონტაჟი, დისკის დაყენება, ჩაწერის გრაფიკი"],
  ["CCTV სისტემის დიაგნოსტიკა", "cctv", "გამოძახება", 80, "კამერების, ჩამწერისა და კვების შემოწმება"],
  ["დისტანციური წვდომის დაყენება", "cctv", "ცალი", 60, "მობილურზე და კომპიუტერზე ჩართვა"],
  // Fire safety
  ["სახანძრო დეტექტორის მონტაჟი", "fire", "ცალი", 45, "ბაზა, დეტექტორი და ხაზზე მიერთება"],
  ["სახანძრო პანელის მონტაჟი და პროგრამირება", "fire", "ცალი", 450, "ზონების კონფიგურაცია და ტესტირება"],
  ["სახანძრო სისტემის ყოველთვიური შემოწმება", "fire", "გამოძახება", 150, "პანელი, დეტექტორები, სირენები, ჟურნალი"],
  ["ხელით ამძრავის (ღილაკის) მონტაჟი", "fire", "ცალი", 55, ""],
  // Access control
  ["კარის კონტროლერის მონტაჟი", "access", "ცალი", 180, "კონტროლერი, კვება, ბლოკირება"],
  ["ელექტრომაგნიტური საკეტის მონტაჟი", "access", "ცალი", 140, ""],
  ["ბარათების პროგრამირება", "access", "ცალი", 8, "ბარათის დამატება სისტემაში"],
  ["დომოფონის მონტაჟი", "access", "ცალი", 200, ""],
  // Network / IT
  ["ქსელის წერტილის გაყვანა (UTP)", "network", "წერტილი", 45, "კაბელი, არხი, როზეტი, ტესტირება"],
  ["სერვერული კარადის აწყობა", "network", "ცალი", 350, "პაჩ-პანელი, ორგანაიზერები, მარკირება"],
  ["WiFi წვდომის წერტილის მონტაჟი", "network", "ცალი", 110, "მონტაჟი და კონფიგურაცია"],
  ["ქსელის დიაგნოსტიკა და გამართვა", "network", "საათი", 70, ""],
  // Electrical
  ["როზეტის/ჩამრთველის მონტაჟი", "electrical", "ცალი", 25, ""],
  ["ელექტროფარის აწყობა", "electrical", "ცალი", 400, "ავტომატები, დიფები, მარკირება"],
  ["კაბელის გაყვანა (ძალური)", "electrical", "მეტრი", 12, "არხში ან გოფრირებულ მილში"],
  ["ელექტროსისტემის შემოწმება", "electrical", "გამოძახება", 100, "დატვირთვა, დამიწება, კავშირები"],
  // Lighting and trays
  ["სანათის მონტაჟი", "lighting", "ცალი", 30, ""],
  ["საევაკუაციო განათების მონტაჟი", "lighting", "ცალი", 65, "ბატარეის ტესტით"],
  ["კაბელგაყვანილობის ლოტოკის მონტაჟი", "cable_trays", "მეტრი", 22, "სამაგრებით"],
  // Automation and design
  ["BMS სისტემის კონფიგურაცია", "automation", "საათი", 90, ""],
  ["პროექტის მომზადება", "design", "ცალი", 500, "სქემები, სპეციფიკაცია, შეთანხმება"],
  // General
  ["გამოძახება და დიაგნოსტიკა", null, "გამოძახება", 50, "ობიექტზე გასვლა და მიზეზის დადგენა"],
  ["სამონტაჟო სამუშაო (ხელოსნის საათი)", null, "საათი", 40, ""],
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  let added = 0;
  for (const [name, system, unit, price, description] of SERVICES) {
    const res = await pool.query(
      `insert into services (name, system_type, unit, price, description, sort)
       select $1, $2::system_type, $3, $4, nullif($5, ''), $6
       where not exists (select 1 from services where name = $1)`,
      [name, system, unit, String(price), description, added],
    );
    added += res.rowCount ?? 0;
  }
  const { rows } = await pool.query("select count(*)::int as n from services");
  console.log(`services: ${added} added, ${rows[0].n} total`);
} finally {
  await pool.end();
}
