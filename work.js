var ENCHANTMENT2ID = {};
var ITEM2ENCHANTMENTS = {};
var ENCHANTMENT2WEIGHT = [];
var ENCHANTMENT2NAMESPACE = [];
var ITEM_NAMESPACES = [];
const MAXIMUM_MERGE_LEVELS = 39;

onmessage = function(event) {
    if (event.data.msg === "set_data") {
        const event_data = event.data.data;
        const enchantments_metadata = event_data.enchants;
        const item_namepace2style = event_data.items;

        for (let item_namespace in item_namepace2style) {
            ITEM2ENCHANTMENTS[item_namespace] = [];
        }

        var enchantment_id = 0;
        for (let enchantment_namespace in enchantments_metadata) {
            const enchantment_metadata = enchantments_metadata[enchantment_namespace];
            const enchantment_weight = enchantment_metadata["weight"];
            const enchantment_items = enchantment_metadata["items"];

            enchantment_items.forEach(item_namespace => {
                ITEM2ENCHANTMENTS[item_namespace].push(enchantment_namespace);
            });

            ENCHANTMENT2ID[enchantment_namespace] = enchantment_id;
            ENCHANTMENT2WEIGHT[enchantment_id] = enchantment_weight;
            enchantment_id++;
        }
        Object.freeze(ENCHANTMENT2WEIGHT);
        Object.freeze(ENCHANTMENT2ID);

        for (let item in ITEM2ENCHANTMENTS) {
            ITEM2ENCHANTMENTS[item].forEach((enchantment, index, dictionary) => {
                dictionary[index] = ENCHANTMENT2ID[enchantment];
            });
        }
        Object.freeze(ITEM2ENCHANTMENTS);
        ITEM_NAMESPACES = Object.keys(ITEM2ENCHANTMENTS);
    }

    if (event.data.msg === "process") {
        process(event.data.item, event.data.enchants);
    }
};

function process(item_namespace, enchantment_foundation) {
    const enchanted_item_objs = generateEnchantedItems(item_namespace, enchantment_foundation);
    const cheapest_item_obj = cheapestEnchantedItem(enchanted_item_objs);
    const instructions = cheapest_item_obj.getInstructions();

    postMessage({
        msg: "complete",
        item_obj: cheapest_item_obj,
        instructions: instructions
    });
}

function combinations(set, k) {
    var i, j, combs, head, tailcombs;

    // There is no way to take e.g. sets of 5 elements from
    // a set of 4.
    if (k > set.length || k <= 0) {
        return [];
    }

    // K-sized set has only one K-sized subset.
    if (k === set.length) {
        return [set];
    }

    // There is N 1-sized subsets in a N-sized set.
    if (k === 1) {
        combs = [];
        for (i = 0; i < set.length; i++) {
            combs.push([set[i]]);
        }
        return combs;
    }

    combs = [];
    for (i = 0; i < set.length - k + 1; i++) {
        // head is a list that includes only our current element.
        head = set.slice(i, i + 1);
        // We take smaller combinations from the subsequent elements
        tailcombs = combinations(set.slice(i + 1), k - 1);
        // For each (k-1)-combination we join it with the current
        // and store it to the set of k-combinations.
        for (j = 0; j < tailcombs.length; j++) {
            combs.push(head.concat(tailcombs[j]));
        }
    }
    return combs;
}

function isInt(obj) {
    return obj % 1 === 0;
}

function isNaturalNumber(obj) {
    const is_int = isInt(obj);
    const is_positive = obj >= 0;
    return is_int && is_positive;
}

function isPositiveInt(obj) {
    const is_int = isInt(obj);
    const is_positive = obj > 0;
    return is_int && is_positive;
}

function memoizeHashFromArguments(arguments) {
    enchanted_item_objs = arguments[0];
    enchanted_item_hashes = new Array(enchanted_item_objs.length);

    enchanted_item_objs.forEach((enchanted_item_obj, enchanted_item_index) => {
        const enchantments_obj = enchanted_item_obj.enchantments_obj;
        const enchantment_objs = enchantments_obj.enchantment_objs;

        enchantment_objs_length = enchantment_objs.length;
        var enchantment_ids = new Array(enchantment_objs_length);
        var enchantment_levels = new Array(enchantment_objs_length);
        enchantment_objs.forEach((enchantment_obj, enchantment_index) => {
            enchantment_ids[enchantment_index] = enchantment_obj.id;
            enchantment_levels[enchantment_index] = enchantment_obj.level;
        });

        const sorted_ids = enchantment_ids.sort();
        var sorted_levels = new Array(enchantment_objs_length);

        sorted_ids.forEach((id, id_index) => {
            sorted_levels[id_index] = enchantment_ids[enchantment_ids.indexOf(id)];
        });

        enchanted_item_hashes[enchanted_item_index] = [
            enchanted_item_obj.item_namespace,
            sorted_ids,
            sorted_levels,
            enchanted_item_obj.prior_work,
            enchantments_obj.levels,
            enchantments_obj.merge_levels,
            enchanted_item_obj.cumulative_levels
        ];
    });

    return enchanted_item_hashes;
}

const memoizeCheapest = func => {
    var results = {};
    return (...arguments) => {
        const args_key = memoizeHashFromArguments(arguments);
        if (!results[args_key]) {
            results[args_key] = func(...arguments);
        }
        return results[args_key];
    };
};

function cheapestLevels(item_obj1, item_obj2) {
    let cumulative_levels1;
    try {
        cumulative_levels1 = item_obj1.cumulative_levels;
    } catch (error) {
        if (error instanceof TypeError) {
            return item_obj2;
        }
    }

    let cumulative_levels2;
    try {
        cumulative_levels2 = item_obj2.cumulative_levels;
    } catch (error) {
        if (error instanceof TypeError) {
            return item_obj1;
        }
    }

    if (cumulative_levels1 < cumulative_levels2) {
        return item_obj1;
    } else if (cumulative_levels1 === cumulative_levels2) {
        const prior_work1 = item_obj1.prior_work,
            prior_work2 = item_obj2.prior_work;
        if (prior_work1 <= prior_work2) {
            return item_obj1;
        }
    }

    return item_obj2;
}

function compareCheapest(item_obj1, item_obj2, cheap_definition = 0) {
    switch (cheap_definition) {
        case 0:
            return cheapestLevels(item_obj1, item_obj2);
    }
}

function cheapestEnchantedItem2(left_item_obj, right_item_obj) {
    let normal_item_obj, reversed_item_obj;

    try {
        normal_item_obj = combineEnchantedItem(left_item_obj, right_item_obj);
    } catch (error) {
        if (error instanceof BookNotOnRightError) {
            return combineEnchantedItem(right_item_obj, left_item_obj);
        } else {
            throw error;
        }
    }

    try {
        reversed_item_obj = combineEnchantedItem(right_item_obj, left_item_obj);
    } catch (error) {
        if (error instanceof BookNotOnRightError) {
            return normal_item_obj;
        } else {
            throw error;
        }
    }

    return compareCheapest(normal_item_obj, reversed_item_obj);
}

function cheapestEnchantedItemN(item_objs) {
    const item_count = item_objs.length;
    const max_item_subcount = Math.floor(item_count / 2) + 1;
    var cheapest_item_obj;

    for (let item_subcount = 1; item_subcount < max_item_subcount; item_subcount++) {
        combinations(item_objs, item_subcount).forEach(left_item_objs => {
            const right_item_objs = item_objs.filter(item_obj => !left_item_objs.includes(item_obj));

            try {
                const left_cheapest_item_obj = cheapestEnchantedItem(left_item_objs);
                const right_cheapest_item_obj = cheapestEnchantedItem(right_item_objs);
                const new_item_obj = cheapestEnchantedItem([left_cheapest_item_obj, right_cheapest_item_obj]);
                cheapest_item_obj = compareCheapest(cheapest_item_obj, new_item_obj);
            } catch (error) {
                if (error instanceof MergeLevelsTooExpensiveError) {
                } else {
                    throw error;
                }
            }
        });
    }

    return cheapest_item_obj;
}

const cheapestEnchantedItem = memoizeCheapest(item_objs => {
    const item_count = item_objs.length;

    switch (item_count) {
        case 1: {
            return item_objs[0];
        }
        case 2: {
            const left_item_obj = item_objs[0],
                right_item_obj = item_objs[1];
            return cheapestEnchantedItem2(left_item_obj, right_item_obj);
        }
        default: {
            return cheapestEnchantedItemN(item_objs);
        }
    }
});

function combineEnchantment(left_enchantment_obj, right_enchantment_obj) {
    const left_enchantment_id = left_enchantment_obj.id,
        right_enchantment_id = right_enchantment_obj.id;

    if (left_enchantment_id === right_enchantment_id) {
        const left_level = left_enchantment_obj.level,
            right_level = right_enchantment_obj.level;

        let new_level;
        if (left_level === right_level) {
            new_level = left_level + 1;
        } else {
            new_level = Math.max(left_level, right_level);
        }

        const new_enchantment = new Enchantment(left_enchantment_id, new_level);
        const merge_levels = new_enchantment.levels;
        return new Enchantments([new_enchantment], merge_levels);
    } else {
        const merge_levels = right_enchantment_obj.levels;
        return new Enchantments([left_enchantment_obj, right_enchantment_obj], merge_levels);
    }
}

class Enchantment {
    constructor(enchantment_id, level) {
        this.id = enchantment_id;

        if (!ENCHANTMENT2WEIGHT.hasOwnProperty(enchantment_id)) {
            console.log(ENCHANTMENT2WEIGHT);
            console.log(enchantment_id);
            throw new Error("invalid enchantment name");
        }
        if (!isPositiveInt(level)) {
            throw new Error("level must be positive integer");
        }

        this.level = level;

        const weight = ENCHANTMENT2WEIGHT[enchantment_id];
        this.levels = level * weight;

        this.namespace = this.getNamespace();
    }

    getNamespace() {
        const enchantment_id = this.id;
        const enchantment_namespaces = Object.keys(ENCHANTMENT2ID);
        const enchantment_namespace = enchantment_namespaces.find(key => ENCHANTMENT2ID[key] === enchantment_id);
        return enchantment_namespace;
    }
}

function combineEnchantments(left_enchantments_obj, right_enchantments_obj) {
    var merge_levels = 0;
    var merged_enchantment_objs = [];

    const left_enchantment_objs = left_enchantments_obj.enchantment_objs;

    var left_enchantment_ids = new Array(left_enchantment_objs.length);
    left_enchantment_objs.forEach((enchantment_obj, enchantment_index) => {
        left_enchantment_ids[enchantment_index] = enchantment_obj.id;
    });
    Object.freeze(left_enchantment_ids);

    const right_enchantment_objs = right_enchantments_obj.enchantment_objs;

    var common_left_enchantments = [];
    right_enchantment_objs.forEach(right_enchantment_obj => {
        const right_enchantment_id = right_enchantment_obj.id;

        if (left_enchantment_ids.includes(right_enchantment_id)) {
            const left_enchantment_index = left_enchantment_ids.indexOf(right_enchantment_id);
            const left_enchantment_obj = left_enchantment_objs[left_enchantment_index];
            common_left_enchantments.push(left_enchantment_obj);

            const merged_enchantments_obj = combineEnchantment(left_enchantment_obj, right_enchantment_obj);
            merge_levels += merged_enchantments_obj.merge_levels;

            merged_enchantment_objs = merged_enchantment_objs.concat(merged_enchantments_obj.enchantment_objs);
        } else {
            merge_levels += right_enchantment_obj.levels;
            merged_enchantment_objs.push(right_enchantment_obj);
        }
    });

    left_enchantment_objs.forEach(enchantment_obj => {
        if (!common_left_enchantments.includes(enchantment_obj)) {
            merged_enchantment_objs.push(enchantment_obj);
        }
    });

    return new Enchantments(merged_enchantment_objs, merge_levels);
}

class Enchantments {
    constructor(enchantment_objs, merge_levels = 0) {
        enchantment_objs.forEach(enchantment_obj => {
            if (!(enchantment_obj instanceof Enchantment)) {
                throw new TypeError("each enchantment must be of type Enchantment");
            }
        });

        this.enchantment_objs = enchantment_objs;
        this.merge_levels = merge_levels;

        var levels = 0;
        enchantment_objs.forEach(enchantment_obj => {
            levels += enchantment_obj.levels;
        });
        this.levels = levels;
    }
}

function combineEnchantedItem(left_item_obj, right_item_obj) {
    return new MergedEnchantedItem(left_item_obj, right_item_obj);
}

function experienceFromLevel(level) {
    if (level <= 16) {
        return level * level + 7;
    } else if (level <= 31) {
        return 2.5 * level * level - 40.5 * level + 360;
    } else {
        return 4.5 * level * level - 162.5 * level + 2220;
    }
}

function priorWork2Penalty(prior_work) {
    return 2 ** prior_work - 1;
}

class InvalidEnchantmentError extends Error {
    constructor(message = "enchantment incompatible for item namespace") {
        super(message);
        this.name = "IncompatibleEnchantmentError";
    }
}

class InvalidItemNameError extends Error {
    constructor(message = "invalid item name") {
        super(message);
        this.name = "InvalidItemNameError";
    }
}

class EnchantedItem {
    constructor(item_namespace, enchantments_obj, prior_work = 0, cumulative_levels = 0, cumulative_minimum_xp = 0) {
        if (!ITEM_NAMESPACES.includes(item_namespace)) {
            console.log(item_namespace);
            throw new InvalidItemNameError("invalid item namespace");
        }

        if (!(item_namespace === "book")) {
            const valid_enchantments = ITEM2ENCHANTMENTS[item_namespace];
            const enchantment_objs = enchantments_obj.enchantment_objs;

            enchantment_objs.forEach(enchantment_obj => {
                const enchantment_id = enchantment_obj.id;
                if (!valid_enchantments.includes(enchantment_id)) {
                    throw new InvalidEnchantmentError("invalid or incompatible enchantment for item namespace");
                }
            });
        }

        if (!isNaturalNumber(prior_work)) {
            throw new Error("prior work must be non-negative integer");
        }

        if (!isNaturalNumber(cumulative_levels)) {
            throw new Error("cumulative levels must be non-negative integer");
        }

        this.item_namespace = item_namespace;
        this.enchantments_obj = enchantments_obj;
        this.prior_work = prior_work;
        this.cumulative_levels = cumulative_levels;
        this.cumulative_minimum_xp = cumulative_minimum_xp;
        this.maximum_xp = experienceFromLevel(cumulative_levels);
    }
}

class IncompatibleItemsError extends Error {
    constructor(message = "(1) at least one item must be book or (2) both items must be same") {
        super(message);
        this.name = "IncompatibleItemsError";
    }
}

class BookNotOnRightError extends Error {
    constructor(message = "book must be on right if other item is not book") {
        super(message);
        this.name = "BookNotOnRightError";
    }
}

class MergeLevelsTooExpensiveError extends Error {
    constructor(message = "merge levels is above maximum allowed") {
        super(message);
        this.name = "MergeLevelsTooExpensiveError";
    }
}
class MergedEnchantedItem extends EnchantedItem {
    constructor(left_item_obj, right_item_obj) {
        const left_item = left_item_obj.item_namespace,
            right_item = right_item_obj.item_namespace;
        const right_item_is_book = right_item === "book",
            right_item_is_left_item = right_item === left_item;

        if (!right_item_is_left_item) {
            if (!right_item_is_book) {
                const left_item_is_book = left_item === "book";
                if (!left_item_is_book) {
                    throw new IncompatibleItemsError();
                } else {
                    throw new BookNotOnRightError();
                }
            }
        }

        const enchantments = combineEnchantments(left_item_obj.enchantments_obj, right_item_obj.enchantments_obj);

        var merge_levels;
        if (right_item_is_book) {
            merge_levels = enchantments.merge_levels;
        } else {
            merge_levels = 2 * enchantments.merge_levels;
        }

        const left_prior_work = left_item_obj.prior_work,
            right_prior_work = right_item_obj.prior_work;
        const prior_work = Math.max(left_prior_work, right_prior_work) + 1;
        const prior_work_penalty = priorWork2Penalty(left_prior_work) + priorWork2Penalty(right_prior_work);

        merge_levels = merge_levels + prior_work_penalty;
        if (merge_levels > MAXIMUM_MERGE_LEVELS) {
            throw new MergeLevelsTooExpensiveError();
        }

        const left_cumulative_levels = left_item_obj.cumulative_levels,
            right_cumuluative_levels = right_item_obj.cumulative_levels;
        const cumulative_levels = left_cumulative_levels + right_cumuluative_levels + merge_levels;

        const left_cumulative_minimum_xp = left_item_obj.cumulative_minimum_xp,
            right_cumulative_minimum_xp = right_item_obj.cumulative_minimum_xp;
        const merge_minimum_xp = experienceFromLevel(merge_levels);
        const cumulative_minimum_xp = left_cumulative_minimum_xp + right_cumulative_minimum_xp + merge_minimum_xp;

        super(left_item, enchantments, prior_work, cumulative_levels, cumulative_minimum_xp);

        this.left_item_obj = left_item_obj;
        this.right_item_obj = right_item_obj;
        this.merge_levels = merge_levels;
        this.merge_xp = experienceFromLevel(merge_levels);
    }

    getInstructions() {
        const left_item_obj = this.left_item_obj,
            right_item_obj = this.right_item_obj;

        const child_item_objs = [left_item_obj, right_item_obj];
        var instructions = [];
        child_item_objs.forEach(child_item => {
            if (child_item instanceof MergedEnchantedItem) {
                const child_instructions = child_item.getInstructions();
                child_instructions.forEach(single_instruction => {
                    instructions.push(single_instruction);
                });
            }
        });

        const merge_levels = this.merge_levels;
        const merge_xp = this.merge_xp;
        const prior_work = this.prior_work;

        const single_instruction = [left_item_obj, right_item_obj, merge_levels, merge_xp, prior_work];
        instructions.push(single_instruction);
        return instructions;
    }
}

function generateEnchantedItems(item_namespace, enchantments, prior_work = 0) {
    var enchanted_item_objs = new Array(enchantments.length);
    const empty_enchantments_obj = new Enchantments([]);
    const enchanted_tool_obj = new EnchantedItem(
        item_namespace,
        empty_enchantments_obj,
        (this.prior_work = prior_work)
    );
    enchanted_item_objs[0] = enchanted_tool_obj;

    const book_namespace = "book";
    enchantments.forEach((enchantment, enchantment_index) => {
        const enchantment_namespace = enchantment[0];
        const enchantment_level = enchantment[1];
        const enchantment_id = ENCHANTMENT2ID[enchantment_namespace];

        const enchantment_obj = new Enchantment(enchantment_id, enchantment_level);
        const enchantments_obj = new Enchantments([enchantment_obj]);
        const enchanted_item_obj = new EnchantedItem(book_namespace, enchantments_obj, (this.prior_work = 0));
        enchanted_item_objs[enchantment_index + 1] = enchanted_item_obj;
    });

    return enchanted_item_objs;
}
