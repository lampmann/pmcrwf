/* ---------- Reference data ---------- */
const ABILITIES = [
  {key:"str", name:"Strength"}, {key:"dex", name:"Dexterity"}, {key:"con", name:"Constitution"},
  {key:"int", name:"Intelligence"}, {key:"wis", name:"Wisdom"}, {key:"cha", name:"Charisma"},
];
const SKILLS = [
  ["Acrobatics","dex"],["Animal Handling","wis"],["Arcana","int"],["Athletics","str"],
  ["Deception","cha"],["History","int"],["Insight","wis"],["Intimidation","cha"],
  ["Investigation","int"],["Medicine","wis"],["Nature","int"],["Perception","wis"],
  ["Performance","cha"],["Persuasion","cha"],["Religion","int"],["Sleight of Hand","dex"],
  ["Stealth","dex"],["Survival","wis"],
];

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const mod = score => Math.floor(((Number(score)||10) - 10) / 2);
const sign = n => (n >= 0 ? "+" : "") + n;
const num = el => Number(el && el.value) || 0;
