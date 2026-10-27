import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const entries = [
  ["d1","duas","Good in this life and the next","Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.","رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارَ","Qur’an 2:201",null,"Everyday"],
  ["d2","duas","A prayer for knowledge","My Lord, increase me in knowledge.","رَبِّ زِدْنِي عِلْمًا","Qur’an 20:114",null,"Learning"],
  ["d3","duas","For parents","My Lord, have mercy upon them as they brought me up when I was small.","رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا","Qur’an 17:24",null,"Family"],
  ["d4","duas","Ease and confidence","My Lord, expand for me my chest and ease for me my task.","رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي","Qur’an 20:25–26",null,"Everyday"],
  ["h1","hadiths","Easing another’s distress","A reminder to support people through difficulty and meet their needs.",null,"Sahih al-Bukhari 2442",null,"Compassion"],
  ["h2","hadiths","Leniency toward a debtor","A reflection on showing leniency to someone facing hardship.",null,"Sahih Muslim 1562a",null,"Compassion"],
  ["h3","hadiths","Time to repay","A reminder to give people time and treat them with fairness.",null,"Sahih al-Bukhari 2077",null,"Compassion"],
  ["q1","quotes","A page at a time","The habit of returning to a book matters more than the speed of finishing it.",null,"E-library original", "E-library", "Reading"],
  ["q2","quotes","Room to reflect","A note is a small place to keep a thought until it grows.",null,"E-library original", "E-library", "Reflection"],
  ["q3","quotes","Carry it forward","What we learn becomes useful when we carry it into daily life.",null,"E-library original", "E-library", "Learning"],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  for (const row of entries) {
    await client.query(
      `INSERT INTO catalog_entries(id,kind,title,text,arabic,source,author,category)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,text=excluded.text,
         arabic=excluded.arabic,source=excluded.source,author=excluded.author,category=excluded.category`, row);
  }
  await client.query("COMMIT");
  process.stdout.write(`Seeded ${entries.length} catalog entries.\n`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
