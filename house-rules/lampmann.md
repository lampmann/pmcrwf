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
| `?` | **Needs clarification before it can be classified.** |

Big Big Fish Dungeoneering Challenge rules are deliberately excluded — that's a
separate challenge-run ruleset, not part of the standing house rules.

---

## 1 · Campaign setup

Defaults the sheet should apply when creating a character under this ruleset.

| # | Rule | Kind |
| --- | --- | --- |
| S1 | **Ruleset: 2014.** All official content plus EGtW, including setting-specific content. (See §2 — the explicit book list is narrower than "all official"; flagged as **Q11**.) | `setup` `source` |
| S2 | **Ability scores: point buy.** Customizing Your Origin (TCE) allowed. | `setup` |
| S3 | **Average everything** — HP per level, starting gold, and anything else with a roll-or-average choice. | `setup` |
| S4 | **Multiclassing allowed.** | `setup` |
| S5 | **Feats allowed.** | `setup` |
| S6 | **Optional class/subclass features allowed** (TCE). | `setup` |
| S7 | **Starting at Higher Level** (DMG p38) used when applicable; **standard Starting Equipment** when applicable. | `setup` |
| S8 | **Item prices: XGtE, take the average; consumables halved.** | `setup` — formula confirmed? **Q10** |

## 2 · Allowed sources

The doc lists ~118 books explicitly. The full list is in `sources.md` alongside this file
(to be generated once **Q11** is settled). Structure:

- **Core** (3) — PHB, MM, DMG
- **Supplements** (10) — VGM, XGE, MTF, AI, TCE, FTD, MPMM, BGG, BMT, DMTCRG
- **Settings** (15) — SCAG, GGR, ERLW, EGW, MOT, VRGR, SCC, AAG, BAM, MPP, SatO, and 6 Plane Shift PDFs
- **Adventures** (~80) — LMoP through Red Dragon's Tale
- **Others** (10) — One Grung Above, Domains of Delight, Tarot Deck, etc.

**Notable absence:** Elemental Evil Player's Companion (EEPC) is not on the list, though
Princes of the Apocalypse — its companion adventure — is. EEPC is the only source for
Aarakocra, Genasi, Deep Gnome and a block of elemental spells, so its absence is
load-bearing rather than incidental. See **Q11**.

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

### 3.3 Items
| Entity | Kind |
| --- | --- |
| Blood of the Lycanthrope | `ban` — filed under "Items" not "Magic Items" in the original; distinction intentional? **Q9** |

### 3.4 Magic items
| Entity | Kind |
| --- | --- |
| Cube of Force | `ban` |
| Wave | `ban` |
| Bag of Beans | `ban` |
| Deck of Wonder | `ban` |
| Harkon's Bite | `ban` |

### 3.5 Rule-level bans
| Rule | Kind |
| --- | --- |
| Infinities in general | `ban` (social — no entity to filter) |
| Infinite money loops | `ban` (social) |
| Hirelings | `ban` |
| Feat/spell backgrounds | `ban` — backgrounds granting a feat or spell (Strixhaven, etc.)? **Q8** |
| Inheritor | `ban` — the SCAG background? Banned separately from "feat/spell backgrounds" why? **Q8** |
| This Is Your Life | `ban` — XGtE's random life-events tables. **Q8** |
| Fateful Moments | `ban` — source not identified. **Q8** |

## 4 · Rulings

Reference text. Grouped by subject rather than left in a flat 49-item list, because the
clusters are real — seven of these are Echo Knight alone.

### 4.1 Table & social
| # | Ruling | Kind |
| --- | --- | --- |
| H1 | If you correctly rules-lawyer the DM, you may grant one Inspiration to a character of your choice. | `ref` |
| H2 | Metagaming is based. Look up stat blocks of monsters you're fighting; read the module if you want. Creatively and transparently interfacing with the game's mechanics is a good thing. | `ref` |
| H3 | The DM does not fudge dice. | `ref` |
| R42 | Gentlemyowwas' agreement: no breaking terrain to make an open field and kiting 99% of encounters. | `ref` **Q6** |
| R23 | (Directed at a specific player) vomitberries / "f\*\*\*\* tech" are off the table. | `?` **Q1** |

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
| R47 | A spell cast with a bonus action must always use a bonus action to cast, regardless of whether you have already taken a bonus action this turn. | `track` — directly affects the Combat round tracker. **Q2** |
| H4 | Only one casting of Planar Binding per player character may be active at a time. | `track` |

### 4.4 Spells
| # | Ruling | Kind |
| --- | --- | --- |
| R4 | Spells do not unleash the caster's desired effect. | `ref` **Q7** |
| R13 | Dispel Magic can't dispel magical effects themselves, only spells "on" magical effects. | `ref` |
| R14 | Hunger of Hadar's "blackness" is not darkness. | `ref` |
| R15 | Animate Dead's target reads as "'a pile of bones' OR 'a corpse of a Medium or Small humanoid' within range" (prepositional phrase scope). | `ref` |
| R18 | The invisible condition ends on everything affected by that casting of Invisibility when the spell ends. | `ref` |
| R21 | "The die" in Guidance and Resistance refers to the d4 — so Guidance/Resistance stacking works even without the drop-concentration trick. | `track`? **Q3** |
| R22 | Death Ward stacking also works. | `track`? **Q3** |
| R24 | Expert Divination only lets you regain one spell slot per expended spell slot. | `ref` |
| R33 | Shapechange isn't considered a source of benefits for the purposes of itself. | `ref` |
| R46 | Wristpocket doesn't generate extra copies of the object. | `ref` |
| R48 | No passing Shadow Blades. | `ref` **Q7** |

### 4.5 Items & equipment
| # | Ruling | Kind |
| --- | --- | --- |
| R9 | Trinkets have a value of 0 gp. | `track` — item library value override |
| R10 | Trinkets do not have any mechanical properties. | `ref` |
| R11 | Spellwrought Tattoos vanish when you cast the spell using the tattoo, instead of at the end of the spell's duration. | `ref` |
| R8 | Genie's Vessels cannot function as anything other than a Genie's Vessel. | `ref` |
| R17 | Oversized weapons can be wielded by PCs. The suggestion that "a weapon sized for an attacker two or more sizes larger is too big for the creature to use at all" does not apply. | `track`? **Q4** |
| R35 | Unless explicitly stated, you must choose a mundane item when choosing an equipment. | `setup` — affects the creator's equipment step |
| R36 | Lifeberry works. | `?` **Q5** |
| R49 | You can't craft animals. | `ref` |

### 4.6 Class features
| # | Ruling | Kind |
| --- | --- | --- |
| R19 | You may concentrate on spells while raging in wild shape. | `ref` |
| R20 | Taking a Sorcerer level for the first time counts as gaining a sorcerer level. | `ref` |
| R37 | Cartomancer doesn't give you a free cast of the spell. | `ref` |
| R39 | If you choose to replace a Divine Magic spell, you must replace it with a spell from the cleric spell list, no matter when you replace it. | `ref` — Divine Soul Sorcerer's Divine Magic? **Q7** |
| R40 | You can't will yourself into becoming a half-dragon, or any other template. | `ref` |

### 4.7 Echo Knight
Seven rulings on one subclass — argues for subject tagging rather than a flat list.

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
| R25 | A Challenge Rating of "—" is not equal to itself. | `ref` **Q7** |
| R5 | Shemeshka never existed. | `?` **Q6** |
| R12 | Bears are fish. | `?` **Q6** |
| R3 | Ability checks are only called for when success or failure is meaningfully uncertain; otherwise the DM determines the outcome narratively. | `ref` |

---

## Open questions

Numbered to match the **Q** references above. See the chat message for the full text of
each; they are listed here so the file stands alone.

1. **Q1** — R23: what are "vomitberries" and the censored tech? Is this an implicit ban?
2. **Q2** — R47: does this mean a bonus-action spell is simply uncastable once your bonus action is spent?
3. **Q3** — R21/R22: is stacking something to track, and what is "the drop conc thing"?
4. **Q4** — R17: do oversized weapons change damage dice, or is it purely permission to wield?
5. **Q5** — R36: what is Lifeberry?
6. **Q6** — R5 / R12 / R42: binding rulings or in-jokes?
7. **Q7** — R4 / R25 / R39 / R48: confirm readings.
8. **Q8** — Ban list: Inheritor, This Is Your Life, Fateful Moments, feat/spell backgrounds.
9. **Q9** — Is "Items" vs "Magic Items" a meaningful split in the ban list?
10. **Q10** — S8: confirm the XGtE pricing formula.
11. **Q11** — Sources: allowlist or "all official except"? And is EEPC's absence deliberate?
