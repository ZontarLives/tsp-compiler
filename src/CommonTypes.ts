// Todo: testing for this should be replaced by check for CommandDefinition.type === cmdType.entity
export const EntityTypes = {
    audio: "audio",
    fixed: "fixed",
    function: "function",
    item: "item",
    location: "location",
    npc: "npc",
    reference: "reference",
    rule: "rule",
    system: "system",
    value: "variable",
};

export type EntityType = keyof typeof EntityTypes;
