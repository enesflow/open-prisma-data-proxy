/**
 * @example
 * const query = headerWithCommasToRecord("a=1,b=2,c=3");
 * console.log(query); // {a: "1", b: "2", c: "3"}
 * @param query
 */
export function headerWithCommasToRecord(query: string) {
    return query.split(",").reduce((acc, cur) => {
        const [key, value] = cur.split("=");
        (acc as any)[key] = value;
        return acc;
    }, {}) as Record<string, string>;
}