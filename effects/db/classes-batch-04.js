/* Bard class + College subclass features.

   Conversion policy used here (see effects/tools/conversion-guide.md):
   - `unsupported` marks a feature that changes a number on *your own* sheet
     (your rolls, saves, skills, AC, HP, speed, action economy) that the
     engine can't yet represent — these are the gaps worth surfacing in the
     effects strip's coverage counter.
   - Features that only act on *other* creatures (Cutting Words subtracting
     from an enemy's roll, Unsettling Words penalising an enemy save) are
     omitted entirely: nothing on this sheet would ever change, so an
     "⚠ not automated" marker would be noise rather than a gap.
   - Spell grants (Guiding Whispers, Magical Secrets, Additional Magical
     Secrets) are omitted — those are handled by class-library.js's
     grant plumbing, not the effects engine.

   Each `pick` choice gets its OWN id: renderEffectControls() draws one
   <select> per choice id and ignores `n`, so "choose two skills" must be
   two ids or the player can only ever record one of them. */
(function () {
  const SKILLS = ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history",
    "insight", "intimidation", "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"];

  registerEffects({
    // ===== Bard (base class) =====
    "class|bard|expertise": {
      name: "Expertise", sv: 1,
      choices: [
        { id: "exp3a", kind: "pick", n: 1, options: SKILLS, label: "Expertise 1 (3rd level)" },
        { id: "exp3b", kind: "pick", n: 1, options: SKILLS, label: "Expertise 2 (3rd level)" },
        { id: "exp10a", kind: "pick", n: 1, options: SKILLS, label: "Expertise 3 (10th level)" },
        { id: "exp10b", kind: "pick", n: 1, options: SKILLS, label: "Expertise 4 (10th level)" },
      ],
      effects: [
        { target: "skill-{choice:exp3a}", op: "expertise", activation: { kind: "choice", choice: "exp3a" } },
        { target: "skill-{choice:exp3b}", op: "expertise", activation: { kind: "choice", choice: "exp3b" } },
        { target: "skill-{choice:exp10a}", op: "expertise", activation: { kind: "choice", choice: "exp10a" }, when: { minLevel: 10 } },
        { target: "skill-{choice:exp10b}", op: "expertise", activation: { kind: "choice", choice: "exp10b" }, when: { minLevel: 10 } },
      ],
    },

    "class|bard|jack of all trades": {
      name: "Jack of All Trades", sv: 1,
      unsupported: [{ reason: "half proficiency bonus on ability checks that don't already include it; the engine has no \"only when not proficient\" condition", tags: ["ability-checks", "conditional"] }],
    },

    "class|bard|song of rest (d6)": {
      name: "Song of Rest (d6)", sv: 1,
      unsupported: [{ reason: "extra hit points regained from Hit Dice on a short rest; no HP-recovery model", tags: ["healing", "rest"] }],
    },

    "class|bard|font of inspiration": {
      name: "Font of Inspiration", sv: 1,
      unsupported: [{ reason: "changes Bardic Inspiration's recharge to a short rest; an entry can't modify another feature's uses spec", tags: ["uses", "cross-feature"] }],
    },

    "class|bard|countercharm": {
      name: "Countercharm", sv: 1,
      unsupported: [{ reason: "advantage on saves against being frightened or charmed; conditional advantage isn't modeled per-ability", tags: ["advantage", "condition"] }],
    },

    "class|bard|superior inspiration": {
      name: "Superior Inspiration", sv: 1,
      unsupported: [{ reason: "regains a use of Bardic Inspiration on initiative; no cross-feature use restoration", tags: ["uses", "cross-feature"] }],
    },

    // ===== College of Lore =====
    "subclass|bard|college of lore|bonus proficiencies": {
      name: "Bonus Proficiencies", sv: 1,
      choices: [
        { id: "prof1", kind: "pick", n: 1, options: SKILLS, label: "Skill proficiency 1" },
        { id: "prof2", kind: "pick", n: 1, options: SKILLS, label: "Skill proficiency 2" },
        { id: "prof3", kind: "pick", n: 1, options: SKILLS, label: "Skill proficiency 3" },
      ],
      effects: [
        { target: "skill-{choice:prof1}", op: "prof", activation: { kind: "choice", choice: "prof1" } },
        { target: "skill-{choice:prof2}", op: "prof", activation: { kind: "choice", choice: "prof2" } },
        { target: "skill-{choice:prof3}", op: "prof", activation: { kind: "choice", choice: "prof3" } },
      ],
    },

    "subclass|bard|college of lore|peerless skill": {
      name: "Peerless Skill", sv: 1,
      unsupported: [{ reason: "spend a Bardic Inspiration die to add it to your own ability check after rolling; no post-hoc roll modification", tags: ["ability-checks", "resource"] }],
    },

    // ===== College of Valor =====
    "subclass|bard|college of valor|bonus proficiencies": {
      name: "Bonus Proficiencies", sv: 1,
      unsupported: [{ reason: "medium armor, shield, and martial weapon proficiency; no proficiencies module", tags: ["proficiency", "equipment"] }],
    },

    "subclass|bard|college of valor|combat inspiration": {
      name: "Combat Inspiration", sv: 1,
      unsupported: [{ reason: "an ally adds your Bardic Inspiration die to damage or AC; affects another creature's sheet", tags: ["ally", "resource"] }],
    },

    "subclass|bard|college of valor|extra attack": {
      name: "Extra Attack", sv: 1,
      unsupported: [{ reason: "a second attack on the Attack action; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    "subclass|bard|college of valor|battle magic": {
      name: "Battle Magic", sv: 1,
      unsupported: [{ reason: "bonus-action weapon attack after casting; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    // ===== College of Creation =====
    "subclass|bard|college of creation|performance of creation": {
      name: "Performance of Creation", sv: 1,
      uses: { max: 1, per: "lr" },
      unsupported: [{ reason: "can also be used again by expending a 2nd-level or higher spell slot; the uses tracker has no spell-slot alternative", tags: ["uses", "spell-slots"] }],
    },

    "subclass|bard|college of creation|animating performance": {
      name: "Animating Performance", sv: 1,
      uses: { max: 1, per: "lr" },
      unsupported: [{ reason: "can also be used again by expending a 3rd-level or higher spell slot; the uses tracker has no spell-slot alternative", tags: ["uses", "spell-slots"] }],
    },

    // ===== College of Eloquence =====
    "subclass|bard|college of eloquence|silver tongue": {
      name: "Silver Tongue", sv: 2,
      // Named skills rather than Reliable Talent's "check-proficient": this one applies to two
      // specific checks whether or not you're proficient in them.
      effects: [
        { target: "skill-persuasion", op: "diefloor", value: 10 },
        { target: "skill-deception", op: "diefloor", value: 10 },
      ],
    },

    // ===== College of Spirits =====
    "subclass|bard|college of spirits|spiritual focus": {
      name: "Spiritual Focus", sv: 1,
      unsupported: [{ reason: "adds 1d6 to one damage or healing roll of a bard spell from 6th level; spell damage rolls aren't an effects target", tags: ["damage", "healing"] }],
    },

    // ===== College of Glamour =====
    "subclass|bard|college of glamour|mantle of inspiration": {
      name: "Mantle of Inspiration", sv: 1,
      unsupported: [{ reason: "grants allies temporary hit points and movement; affects other creatures' sheets", tags: ["ally", "temp-hp"] }],
    },

    // ===== College of Swords =====
    "subclass|bard|college of swords|bonus proficiencies": {
      name: "Bonus Proficiencies", sv: 1,
      unsupported: [{ reason: "medium armor and scimitar proficiency; no proficiencies module", tags: ["proficiency", "equipment"] }],
    },

    "subclass|bard|college of swords|fighting style": {
      name: "Fighting Style", sv: 1,
      unsupported: [{ reason: "Fighting Style options live in 5e.tools' optional-features file, which isn't imported yet", tags: ["optional-features"] }],
    },

    "subclass|bard|college of swords|blade flourish": {
      name: "Blade Flourish", sv: 1,
      unsupported: [{ reason: "+10 ft walking speed on the Attack action; speed isn't an effects target", tags: ["speed"] }],
    },

    "subclass|bard|college of swords|defensive flourish": {
      name: "Defensive Flourish", sv: 1,
      unsupported: [{ reason: "adds the Bardic Inspiration die to AC until your next turn; AC isn't an effects target", tags: ["ac", "resource"] }],
    },

    "subclass|bard|college of swords|extra attack": {
      name: "Extra Attack", sv: 1,
      unsupported: [{ reason: "a second attack on the Attack action; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    // ===== College of Whispers =====
    "subclass|bard|college of whispers|psychic blades": {
      name: "Psychic Blades", sv: 1,
      unsupported: [{ reason: "extra psychic damage stepping 2d6/3d6/5d6/8d6 at bard 1/5/10/15; `when` supports only minLevel, so a level *band* can't be expressed", tags: ["damage", "level-scaling"] }],
    },
  });
})();
