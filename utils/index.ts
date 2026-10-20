export async function hashStringArr(
  stringArr: string[],
): Promise<string | null> {
  if (Array.isArray(stringArr) && stringArr.length > 0) {
    const s = stringArr.join("_");
    // Create SHA-256 hash of the uniqueString
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(s),
    );

    // Convert the hash buffer to a hexadecimal string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256HexString = hashArray
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    // Use BigInt to safely handle large numbers and take the first 14 digits of the hexadecimal string
    const sha256IntBigInt = BigInt("0x" + sha256HexString);
    const sha256IntString = sha256IntBigInt.toString().slice(0, 14);

    return sha256IntString;
  }
  return null;
}
export function makeid(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function deletePropertiesByNames(obj: any, propNames: string[]): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deletePropertiesByNames(item, propNames);
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (propNames.includes(key)) {
          delete obj[key];
        } else {
          // Recurse into nested objects or arrays
          deletePropertiesByNames(obj[key], propNames);
        }
      }
    }
  }
}
