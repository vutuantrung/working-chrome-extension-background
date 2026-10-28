
export function findAllKeyValuePairs(jsonObject: any, key: string): { key: string; value: any }[] {
    let results: { key: string; value: any }[] = [];
    for (const [k, v] of Object.entries(jsonObject)) {
        if (k === key) {
            results.push({ key: k, value: v });
        }
        if (typeof v === "object" && v !== null) {
            results = results.concat(findAllKeyValuePairs(v, key));
        }
    }
    return results;
}