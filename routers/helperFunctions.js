// Taken from KC's CombineUtil
global.specialCombines = {
    "aDD": ["DE","DD"],
    "aCL": ["CL","CLT"],
    "aDDCL": ["DD","DE","CL"],
    "aC": ["CL","CLT","CA","CAV","FBB","BB","BBV"],
    "aCA": ["CA","CAV"],
    "aBB": ["FBB","BB","BBV"],
    "aCV": ["CVL","CV","CVB"],
    "aCVnoL": ["CV","CVB"],
    "aBBnoV": ["FBB","BB"],
    "aSS": ["SS","SSV"],
    "aBBnoF": ["BB","BBV"],
    "aBBCV": ["CVL","CV","CVB","FBB","BB","BBV"],
    "aBBCVnoL": ["CV","CVB","FBB","BB","BBV"],
};
/*
===============================================================================

                                HELPER FUNCTIONS                                

===============================================================================
*/

/*
Map routing table with both stype AND count for passed entries.
Will make looking for specific ship effects easier (Still hard if there's a multi requirement)
*/
global.advancedStypeCounter = (entry, stypeCount, edge) => {
    for(let stype of Object.keys(stypeCount)) {
        if(!routing[stype])
            routing[stype] = {};
        if(!routing[stype][stypeCount[stype]])
            routing[stype][stypeCount[stype]] = {};

        let rs = routing[stype][stypeCount[stype]];
        if(!rs[edge]) rs[edge] = 0;
        rs[edge] = (rs[edge]||0) + 1;
    }
}

/*
Get unordered fleet composition, order of fleet doesn't matter
Pass #getStypeCount().XXX through
Example return: "1 CL 3 BB 2 CVB"
Original fleet's order doesn't matter.
Order of stype based on id
*/
global.getUnorderedFleetComp = (stypeCount) => {
    return Object.keys(stypeCount).filter((key) => stypeCount[key]).map((key) => stypeCount[key] + " " + key).join(" ");
}

/*
Get ordered fleet composition, order of fleet matters
Pass full entry through. (requires fleet1 (and fleet2 if available))
Example return: "FBB FBB DD CA CA DD"
*/
global.getOrderedFleetComp = (entry) => {
    if(entry.fleet2 && entry.fleet2.length)
        return entry.fleet1.map((ship) => stype[ship.type]).join(" ") + " | " + entry.fleet2.map((ship) => stype[ship.type]).join(" ");
    return entry.fleet1.map((ship) => stype[ship.type]).join(" ");
}

/*
Get ordered fleet composition, order of fleet matters
Pass full entry through. (requires fleet1 (and fleet2 if available))
Example return: "朝潮改二 Nelson改 満潮改二 荒潮改二 山雲改 夕雲改"
*/
global.getOrderedShipComp = (entry) => {
    if(entry.fleet2 && entry.fleet2.length)
        return entry.fleet1.map((ship) => ship.name).join(" ") + " | " + entry.fleet2.map((ship) => ship.name).join(" ");
    return entry.fleet1.map((ship) => ship.name).join(" ");
}

/*
Returns object with counts of stype's
Returns 3 objects with each count of every stype.
- fleet1: Main fleet
- fleet2: Escort fleet
- all: Sum of both
*/
global.getStypeCount = (entry) => {
    let stypeCount = {"all": {}, "fleet1": {}, "fleet2": {}};
    for(let i = 1; i < stype.length; i++) {
        let stypeName = stype[i];
        stypeCount.fleet1[stypeName] = entry.fleet1.filter((ship) => ship.type == i).length
        stypeCount.fleet2[stypeName] = (entry.fleet2) ? entry.fleet2.filter((ship) => ship.type == i).length : 0;
        stypeCount.all[stypeName] = stypeCount.fleet1[stypeName] + stypeCount.fleet2[stypeName];
    }
    return stypeCount;
}

/*
Convert stypeCount of getStypeCount to special combines, these are special presets for quick use. 
(Example: aBB = BB + FBB + BBV)
*/
global.getSpecialCombines = (stypeCount) => {
    let specialCount = {};
    for(let type in global.specialCombines)
        specialCount[type] = global.specialCombines[type].map((type) => stypeCount[type]).reduce((a,b) => a+b);
    return specialCount;
}

/*
Get count of ships that have a specific item
*/
global.getShipWithItemCount = (entry, id) => {
    return entry.fleet1.filter((ship) => ship.equip.filter((eId) => eId == id).length).length;
}
/*
Get count of ships that have any item in list
*/
global.getShipWithItemsCount = (entry, ids) => {
    if(entry.fleet2 && entry.fleet2.length)
        return entry.fleet1.filter((ship) => ship.equip.filter((eId) => ids.includes(eId)).length > 0).length + entry.fleet2.filter((ship) => ship.equip.filter((eId) => ids.includes(eId)).length > 0).length;
    return entry.fleet1.filter((ship) => ship.equip.filter((eId) => ids.includes(eId)).length > 0).length
}

/*
Get count of item
*/
global.getItemCount = (entry, id) => {
    return entry.fleet1.map((ship) => ship.equip.filter((eId) => eId == id).length).reduce((a, b) => a + b);
}

/*
Get LoS for an entry given a Cn
*/
global.getLoS = (entry, Cn) => {
    return entry.los[0] + (entry.los[1] - entry.los[0]) * (Cn - 1);
}

/*
Get difficulty, returns either '?' when unknown, otherwise '丁', '丙', '乙' or '甲'
*/
global.getDifficulty = (entry) => {
    return ['?', '丁', '丙', '乙', '甲'][entry.difficulty||0];
}

/*
Count historicals of an entry, returns something like stypecounter
*/
global.getHistoricalCount = (entry) => {
    let stypeCount = {"all": {}, "fleet1": {}, "fleet2": {}};
    entry.fleet1.concat(entry.fleet2).forEach((ship) => {
        if(idtobasename[ship.id] == undefined) {
            console.warn(`\x1b[33m!! Unknown base name for ship id ${ship.id} (${ship.name})\x1b[0m`);
            idtobasename[ship.id] = "?"; // Prevent duplicate lines
        }
    });

    for(let historicalName in historicalFleets) {
        let fleet = historicalFleets[historicalName];
        let filter = (ship) => fleet.find((nameid) => typeof nameid == 'string' ? nameid == idtobasename[ship.id] : ship.id == nameid);
        stypeCount.fleet1[historicalName] = entry.fleet1.filter(filter).length;
        stypeCount.fleet2[historicalName] = entry.fleet2.filter(filter).length;
        stypeCount.all[historicalName] = stypeCount.fleet1[historicalName] + stypeCount.fleet2[historicalName];
    }
    return stypeCount;
}

global.pad = (n, width = 3, z = ' ') => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
