/**
 * নাম দিয়ে map (ফাইল, branch, commit, কমান্ড) খোঁজা।
 *
 * `name in map` বা `map[name]` লিখলে "constructor", "toString" ধরনের নাম Object.prototype
 * থেকে পাওয়া যায়, যেন সেগুলো আগে থেকেই আছে। ব্যবহারকারী যেকোনো নাম লিখতে পারে, তাই
 * নাম দিয়ে খোঁজার সময় সবসময় এই দুটো ফাংশন ব্যবহার করুন।
 *
 * পুরোনো ব্রাউজারেও চলুক বলে Object.hasOwn-এর বদলে hasOwnProperty.call।
 */
export function has(map: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

export function get<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return has(map, key) ? map[key] : undefined;
}
