# Lampmann's House Rules

Reorganized from the original Google Doc for use as sheet data. Original numbering is
preserved in brackets so entries can be cross-referenced against the source document.

Every entry carries a **kind** tag describing what the sheet can actually do with it:

| Tag | Meaning |
| --- | --- |
| `setup` | A character-creation / campaign default the sheet can apply automatically. |
| `ban` | A blocklist entry — belongs in the Bans tab, filtered like 5e.tools. |
| `source` | Source (book) allow/deny — the Bans tab's source filter. |
| `track` | Something the sheet can actively track or enforce during play. |
| `ref` | Reference text. No automation possible or wanted; it exists to be read. |
| `defer` | Deliberately not implemented for now. |

Big Big Fish Dungeoneering Challenge rules are deliberately excluded — that's a
separate challenge-run ruleset, not part of the standing house rules.

---

## 1 · Campaign setup

Defaults the sheet should apply when creating a character under this ruleset.

| # | Rule | Kind |
| --- | --- | --- |
| S1 | **Ruleset: 2014.** Everything official and non-partnered is allowed (see §2). | `setup` `source` |
| S2 | **Ability scores: point buy.** Customizing Your Origin (TCE) allowed. | `setup` |
| S3 | **Average everything** — HP per level, starting gold, and anything else with a roll-or-average choice. | `setup` |
| S4 | **Multiclassing allowed.** | `setup` |
| S5 | **Feats allowed.** | `setup` |
| S6 | **Optional class/subclass features allowed** (TCE). | `setup` |
| S7 | **Starting at Higher Level** (DMG p38) used when applicable; **standard Starting Equipment** when applicable. | `setup` |
| S8 | **Magic item prices: the mean of XGtE's Asking Price roll**, halved for consumables. See §1.1. | `setup` |

### 1.1 Magic item price table (derived)

XGtE gives an Asking Price as a die expression per rarity. This table takes the **mean**
of that expression, so prices are fixed rather than rolled. Consumables (potions,
scrolls) are halved. Mundane item prices are unaffected — PHB rates apply as normal.

| Rarity | XGtE asking price | Mean | Consumable (½) |
| --- | --- | ---: | ---: |
| Common | (1d6 + 1) × 10 gp | **45 gp** | 22 gp 5 sp |
| Uncommon | 1d6 × 100 gp | **350 gp** | 175 gp |
| Rare | 2d10 × 1,000 gp | **11,000 gp** | 5,500 gp |
| Very rare | (1d4 + 1) × 10,000 gp | **35,000 gp** | 17,500 gp |
| Legendary | 2d6 × 25,000 gp | **175,000 gp** | 87,500 gp |

### 1.2 Oversized weapons (R17)

A three-way setting, because tables differ on this and the DMG offers the strictest
option as a suggestion rather than a rule.

| Option | Effect |
| --- | --- |
| **Fully allow** *(this ruleset's default)* | Any oversized weapon may be wielded. Disadvantage applies when the weapon is sized for a larger attacker. |
| **Two-size limit** | The DMG's optional clause applies: a weapon sized for an attacker two or more sizes larger cannot be used at all. Disadvantage still applies within the limit. |
| **Fully banned** | PCs cannot wield oversized weapons. |

The extra damage dice are a property of the weapon, not the wielder — a greataxe sized
for a Large creature deals 2d12 for anyone who can lift it.

## 2 · Allowed sources

**Model: denylist, not allowlist.** Everything official and non-partnered is permitted;
the source filter starts fully enabled and only excludes what is named. The ~118-book
list in the original document was an enumeration of what was available at the time, not
a curated allowlist, and does not need to be maintained by hand.

- **Elemental Evil Player's Companion (EEPC) is allowed** — its omission from the
  original list was an oversight, not a ruling. (It is the only source for Aarakocra,
  Genasi, Deep Gnome and a block of elemental spells.)
- Excluded by category: Unearthed Arcana, third-party content.
- Excluded by name: see §3.6 — the Shemeshka content ban is a source-level exclusion in
  everything but name.

## 3 · Bans

Everything here belongs in the Bans tab. Named entities filter like 5e.tools; the
rule-level bans are toggles.

### 3.1 Spells
| Entity | Kind |
| --- | --- |
| Nystul's Magic Aura | `ban` |
| Fabricate | `ban` |

### 3.2 Subclasses
| Entity | Kind |
| --- | --- |
| Conjuration Wizard | `ban` |
| Creation Bard | `ban` |

### 3.3 Mundane items
| Entity | Kind |
| --- | --- |
| Blood of the Lycanthrope | `ban` — an injury poison, hence filed apart from magic items |

The mundane/magic split is meaningful and the ban filter must respect item type.

### 3.4 Magic items
| Entity | Kind |
| --- | --- |
| Cube of Force | `ban` |
| Wave | `ban` |
| Bag of Beans | `ban` |
| Deck of Wonder | `ban` |
| Harkon's Bite | `ban` |

### 3.5 Character-creation options
| Entity | Source | Kind |
| --- | --- | --- |
| Inheritor | Van Richten's Guide to Ravenloft | `ban` — starts you with a Ring of Three Wishes or similar |
| Fateful Moments | Explorer's Guide to Wildemount | `ban` |
| This Is Your Life | Xanathar's Guide to Everything | `ban` |
| Feat/spell backgrounds | various | `ban` — any background granting a feat or a spell |

### 3.6 Content bans
| Rule | Kind |
| --- | --- |
| **[R5] Shemeshka never existed.** She is the proprietor of the Fortune's Wheel — a roulette wheel that can be spammed until it makes you a deity — and of a hyperbolic time chamber. Declaring her non-canon removes both. | `ban` (content, not a stat block) |

### 3.7 Rule-level bans
| Rule | Kind |
| --- | --- |
| Infinities in general | `ban` (social — no entity to filter) |
| Infinite money loops | `ban` (social) |
| Hirelings | `ban` |

## 4 · Rulings

Reference text. Grouped by subject rather than left in a flat 49-item list, because the
clusters are real — seven of these are Echo Knight alone.

### 4.1 Table & social
| # | Ruling | Kind |
| --- | --- | --- |
| H1 | If you correctly rules-lawyer the DM, you may grant one Inspiration to a character of your choice. | `ref` |
| H2 | Metagaming is based. Look up stat blocks of monsters you're fighting; read the module if you want. Creatively and transparently interfacing with the game's mechanics is a good thing. | `ref` |
| H3 | The DM does not fudge dice. | `ref` |
| R42 | The gentlemyowwas' agreement ("gentlemen and women"): no breaking terrain to make an open field and kiting 99% of encounters. | `ref` |
| R23 | Directed at a specific player; no mechanical content. | `ref` |

### 4.2 Physics, space & targeting
| # | Ruling | Kind |
| --- | --- | --- |
| R1 | No creature, object, magical force, or image may move through a wall or solid object unless explicitly stated. | `ref` |
| R2 | Total Cover applies to all effects, not just attacks and spells. | `ref` |
| R16 | Unless otherwise specified, any given creature only has two hands. | `ref` |
| R41 | You may not target objects worn, carried, or held by a creature. | `ref` |
| R44 | Anything that has an unspecified range has a range of 5 ft. | `ref` |
| R34 | **Definition of magical.** Something is magical if any of: (a) it is a magic item; (b) it is a spell; (c) it lets you create the effects of a spell mentioned in its description; (d) it is a spell attack; (e) it is fueled by the use of spell slots; (f) its description refers to it as magical. | `ref` (good candidate for a pinned reference card) |

### 4.3 Action economy & timing
| # | Ruling | Kind |
| --- | --- | --- |
| R7 | Use group initiative for summons and monsters. | `ref` |
| R38 | Stealth (to determine surprise) is rolled immediately before initiative. | `ref` |
| R43 | Turns exist outside of combat. | `ref` |
| R45 | An untriggered Ready action ends right before initiative is rolled. | `ref` |
| R47 | **A bonus-action spell always costs a bonus action.** PHB reads "You must use a bonus action on your turn to cast the spell, *provided that you haven't already taken a bonus action this turn*." The rejected argument is that once you *have* taken a bonus action, the "must use a bonus action" requirement lapses and the spell becomes free. It does not: with your bonus action spent, a bonus-action spell is simply uncastable. | `track` |
| H4 | Only one casting of Planar Binding per player character may be active at a time. | `track` |

### 4.4 Spells
| # | Ruling | Kind |
| --- | --- | --- |
| R4 | **Spells do not unleash the caster's desired effect.** The PHB's flavor text ("releases them to unleash the desired effect") is not a mechanical grant — a spell does only what its description says. Rejects "I cast Fire Bolt, with the desired effect of killing all my enemies." | `ref` |
| R13 | Dispel Magic can't dispel magical effects themselves, only spells "on" magical effects. | `ref` |
| R14 | Hunger of Hadar's "blackness" is not darkness. | `ref` |
| R15 | Animate Dead's target reads as "'a pile of bones' OR 'a corpse of a Medium or Small humanoid' within range" (prepositional phrase scope). | `ref` |
| R18 | The invisible condition ends on everything affected by that casting of Invisibility when the spell ends. | `ref` |
| R21 | **Guidance/Resistance stacking works.** "The die" refers to the d4, so stacking does not require the drop-concentration maneuver. See §4.9. | `track` — implemented |
| R22 | **Death Ward stacking also works.** | `track` — implemented |
| R24 | Expert Divination only lets you regain one spell slot per expended spell slot. | `ref` |
| R33 | Shapechange isn't considered a source of benefits for the purposes of itself. | `ref` |
| R46 | Wristpocket doesn't generate extra copies of the object. | `ref` |
| R48 | **No passing Shadow Blades.** Passing an item is not a thing in 5e — you would have to drop or throw it for someone else to pick up, and either dissipates the blade. | `ref` |

### 4.5 Items & equipment
| # | Ruling | Kind |
| --- | --- | --- |
| R9 | Trinkets have a value of 0 gp. | `track` — item library value override |
| R10 | Trinkets do not have any mechanical properties. | `ref` |
| R11 | Spellwrought Tattoos vanish when you cast the spell using the tattoo, instead of at the end of the spell's duration. | `ref` |
| R8 | Genie's Vessels cannot function as anything other than a Genie's Vessel. | `ref` |
| R17 | **Oversized weapons can be wielded by PCs.** The extra damage dice belong to the *weapon* — a greataxe sized for a Large creature deals 2d12 whoever swings it. The *wielder's* size determines only the penalty: disadvantage on attack rolls with a weapon sized for a larger attacker. The DMG's optional "two or more sizes larger is too big to use at all" clause does not apply by default. | `setup` — three-way setting, see §1.2 |
| R35 | Unless explicitly stated, you must choose a mundane item when choosing an equipment. | `setup` — affects the creator's equipment step |
| R36 | **Lifeberry works** — Goodberry cast by a Life Domain cleric gets Disciple of Life, so each berry heals 2 + spell level rather than 1. | `ref` |
| R49 | You can't craft animals. | `ref` |

### 4.6 Class features
| # | Ruling | Kind |
| --- | --- | --- |
| R19 | You may concentrate on spells while raging in wild shape. | `ref` |
| R20 | Taking a Sorcerer level for the first time counts as gaining a sorcerer level. | `ref` |
| R37 | Cartomancer doesn't give you a free cast of the spell. | `ref` |
| R39 | If you choose to replace a Divine Magic spell, you must replace it with a spell from the cleric spell list, no matter when you replace it. | `defer` — original rationale not recalled; not implemented |
| R40 | You can't will yourself into becoming a half-dragon, or any other template. | `ref` |

### 4.7 Echo Knight
Seven rulings on one subclass — the argument for subject tagging rather than a flat list.

| # | Ruling | Kind |
| --- | --- | --- |
| R26 | An Echo Knight's Echo can only be moved by them once per round. | `ref` |
| R27 | You cannot attack through Echo Avatar. | `ref` |
| R28 | The Echo is neither a creature nor an object. | `ref` |
| R29 | The Echo can move in any direction, including up. | `ref` |
| R30 | The Echo's pseudo-opportunity attack can trigger on forced movement. | `ref` |
| R31 | When attacking through your Echo while out of line of sight, you're an unseen attacker. | `ref` |
| R32 | You may attack as if you are in the Echo's space, meaning you may make melee attacks through the Echo. | `ref` |

### 4.8 Creatures & stat blocks
| # | Ruling | Kind |
| --- | --- | --- |
| R6 | Contracts, Pacts, Blessings, and Charms can only be given by willing and unthreatened entities not controlled by the players. | `ref` |
| R25 | **A Challenge Rating of "—" is not equal to itself**, so it never satisfies a CR comparison. Without this, a Druid could wild shape into a Nystul'd Mighty Servant of Leuk-o and similar. This overlaps the Nystul's Magic Aura ban deliberately — there are ways to summon CR 0 creatures without Nystul's, so both are load-bearing. | `ref` |
| R12 | "Bears are fish" — a joke recording a real ruling: the Trident of Fish Command affects beasts with an innate swimming speed, which includes polar bears and cave bears. | `ref` |
| R3 | Ability checks are only called for when success or failure is meaningfully uncertain; otherwise the DM determines the outcome narratively. | `ref` |

### 4.9 Guidance / Resistance stacking — the mechanism

Why R21 holds, per *A Guide to Guidance Stacking*:

1. Two Guidances land on the same target. Per **Combining Magical Effects** (PHB p205)
   the same spell with overlapping durations does not stack — the most recent applies
   and the earlier is *suppressed*.
2. A spell's block of information lists name, level, school, casting time, range,
   components and duration; **the rest of the entry is its effect**. Guidance's end
   condition ("Once before the spell ends… The spell then ends") is not part of its
   duration, so it is part of its *effect*.
3. Therefore the suppressed Guidance's **end condition is suppressed too**.
4. Expend Guidance 2 → it ends → Guidance 1 is no longer suppressed and comes into
   effect. "After making the ability check" is still satisfied, so Guidance 1 can be
   expended on the same check.

The "drop concentration" variant — dropping concentration on Guidance 2 the moment it is
expended rather than letting it end on its own — is a way to reach the same result.
R21 says it is unnecessary: stacking works either way.

**Sheet support — implemented** (`src/boons.js`, see DOCS' Boons section):
- Guidance and Resistance are **counts**, not toggles, and fold `+Nd4` into the matching rolls —
  Guidance on ability checks and initiative, Resistance on saving throws. A roll spends every
  active die of that kind and logs what it added.
- A **Death Ward counter** beside HP. It fires on the transition to 0 HP, leaving you at 1, spending
  one ward and logging it.
- Guidance and Resistance end on any rest; Death Ward survives a short rest and ends on a long one.

---

## Implementation summary

What each part becomes in the app.

| Part | Surface | Notes |
| --- | --- | --- |
| §1 setup | Campaign settings | 8 defaults; drives the creator |
| §1.1 prices | Item library | Fixed price per rarity, halved for consumables |
| §2 sources | Bans tab → source filter | Denylist; starts fully enabled |
| §3 bans | Bans tab | 9 named entities, 4 creation options, 1 content ban, 3 rule toggles |
| §4 rulings | House rules reference | ~50 entries, subject-tagged, searchable |

**Mechanizable rulings** (everything else is reference): R21/R22 stacking (**done** — `src/boons.js`),
R9 trinket value, R35 mundane starting equipment, R47 bonus-action spells, H4 Planar Binding limit.
