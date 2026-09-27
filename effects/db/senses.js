/* Class features that grant a sense. "min" grants a range (the best grant wins, since senses don't
   stack); "add" extends one you already have from something else, which is how "you gain darkvision
   out to 60 feet; if you already have it, its range increases by 30 feet" is written. */
registerEffects({
  "subclass|ranger|gloom stalker|umbral sight": {
    name: "Umbral Sight", sv: 1,
    effects: [
      { target: "sense-darkvision", op: "min", value: 60 },
      { target: "sense-darkvision", op: "add", value: 30 },
      { target: "situational-advantage", op: "tag", value: "invisible to creatures relying on darkvision, while you're in darkness" },
    ],
  },
  "subclass|sorcerer|shadow magic|eyes of the dark": {
    name: "Eyes of the Dark", sv: 1,
    effects: [{ target: "sense-darkvision", op: "min", value: 120 }],
  },
  "class|rogue|blindsense": {
    name: "Blindsense", sv: 1,
    effects: [{ target: "sense-special", op: "tag", value: "Blindsense 10 ft (hidden and invisible creatures, while you can hear)" }],
  },
});
